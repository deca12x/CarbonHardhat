// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IOFT, SendParam, MessagingFee, OFTReceipt, MessagingReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";

contract CarbonOffsetFlare {
    using OptionsBuilder for bytes;

    IOFT public immutable stargateUsdtOFT;       // USDT OFT on Flare (0x1C1...)
    IERC20 public immutable usdtTokenOnFlare;  // ERC20 USDT on Flare (0x0B3...)
    address public immutable polygonComposerContract; // Your contract on Polygon (0xCEC...)

    // Stargate Polygon Endpoint ID
    uint32 constant POLYGON_EID = 30109;

    event USDTBridgedAndComposed(
        bytes32 indexed guid,
        uint256 amountSentLD,
        uint256 amountReceivedLD,
        address indexed destinationContract,
        bytes composeMsgSent,
        uint256 lzNativeFee
    );
    event BridgeAndComposeFailed(string reason);
    event QuotedOFTInfo(uint256 amountSentLD, uint256 amountReceivedLD);
    event QuotedSendFee(uint256 nativeFee, uint256 lzTokenFee);

    constructor(
        address _stargateUsdtOFTAddress,    // e.g., 0x1C10CC06DC6D35970d1D53B2A23c76ef370d4135
        address _erc20UsdtTokenAddress,   // e.g., 0x0B38e83B86d491735fEaa0a791F65c2B99535396
        address _polygonComposerContractAddress // e.g., 0xCECA34B92DbBAf1715De564172c61A4782248CCD
    ) {
        stargateUsdtOFT = IOFT(_stargateUsdtOFTAddress);
        usdtTokenOnFlare = IERC20(_erc20UsdtTokenAddress);
        polygonComposerContract = _polygonComposerContractAddress;
    }

    function addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    /**
     * @notice Estimates LayerZero fee for bridgeAndExecuteOnPolygon.
     * @param _amountUSDT Amount of USDT to bridge (6 decimals).
     * @param _flareInitiator The address initiating this on Flare (will be part of composeMsg).
     * @param _finalEoaRecipientOnPolygon EOA on Polygon for final benefit (part of composeMsg).
     * @param _minOutputOrOtherParam Third parameter for composeMsg.
     * @param _composeGasLimit Gas for lzCompose on Polygon.
     * @return nativeFee Estimated native FLR fee.
     * @return lzTokenFee Estimated ZRO fee (usually 0).
     */
    function getFeeForBridgeAndExecute(
        uint256 _amountUSDT,
        address _flareInitiator, 
        address _finalEoaRecipientOnPolygon,
        uint256 _minOutputOrOtherParam, 
        uint256 _composeGasLimit
    ) public view returns (uint256 nativeFee, uint256 lzTokenFee) {
        bytes memory actualComposeMsg = abi.encode(_flareInitiator, _finalEoaRecipientOnPolygon, _minOutputOrOtherParam);
        bytes memory actualExtraOptions = OptionsBuilder.newOptions().addExecutorLzComposeOption(0, uint128(_composeGasLimit),0);

        SendParam memory initialSendParam = SendParam({
            dstEid: POLYGON_EID,
            to: addressToBytes32(polygonComposerContract),
            amountLD: _amountUSDT,
            minAmountLD: _amountUSDT, // Placeholder, refined by oftReceipt.amountReceivedLD
            extraOptions: actualExtraOptions,
            composeMsg: actualComposeMsg,
            oftCmd: bytes("")
        });

        (, , OFTReceipt memory oftReceipt) = stargateUsdtOFT.quoteOFT(initialSendParam);

        SendParam memory finalSendParam = SendParam({
            dstEid: POLYGON_EID,
            to: addressToBytes32(polygonComposerContract),
            amountLD: _amountUSDT,
            minAmountLD: oftReceipt.amountReceivedLD,
            extraOptions: actualExtraOptions,
            composeMsg: actualComposeMsg,
            oftCmd: bytes("")
        });

        MessagingFee memory fee = stargateUsdtOFT.quoteSend(finalSendParam, false);
        return (fee.nativeFee, fee.lzTokenFee);
    }

    /**
     * @notice Bridges USDT, sends to Polygon composer, with compose message.
     */
    function bridgeAndExecuteOnPolygon(
        uint256 _amountUSDT,
        address _finalEoaRecipientOnPolygon, // EOA for final benefit on Polygon
        uint256 _minOutputOrOtherParam,      // Third param for composeMsg, adjust as needed
        uint256 _composeGasLimit           // Gas for lzCompose on Polygon contract
    ) public payable {
        usdtTokenOnFlare.approve(address(stargateUsdtOFT), _amountUSDT);

        // Pass msg.sender as the _flareInitiator for the composeMsg
        bytes memory actualComposeMsg = abi.encode(msg.sender, _finalEoaRecipientOnPolygon, _minOutputOrOtherParam);
        bytes memory actualExtraOptions = OptionsBuilder.newOptions().addExecutorLzComposeOption(0, uint128(_composeGasLimit), 0);

        SendParam memory initialSendParam = SendParam({
            dstEid: POLYGON_EID,
            to: addressToBytes32(polygonComposerContract),
            amountLD: _amountUSDT,
            minAmountLD: _amountUSDT,
            extraOptions: actualExtraOptions,
            composeMsg: actualComposeMsg,
            oftCmd: bytes("")
        });

        (, , OFTReceipt memory oftReceiptForMinAmount) = stargateUsdtOFT.quoteOFT(initialSendParam);
        emit QuotedOFTInfo(oftReceiptForMinAmount.amountSentLD, oftReceiptForMinAmount.amountReceivedLD);

        SendParam memory finalSendParam = SendParam({
            dstEid: POLYGON_EID,
            to: addressToBytes32(polygonComposerContract),
            amountLD: _amountUSDT,
            minAmountLD: oftReceiptForMinAmount.amountReceivedLD,
            extraOptions: actualExtraOptions,
            composeMsg: actualComposeMsg,
            oftCmd: bytes("")
        });

        MessagingFee memory fee = stargateUsdtOFT.quoteSend(finalSendParam, false);
        uint256 nativeFeeToPay = fee.nativeFee;
        uint256 lzTokenFeeToPay = fee.lzTokenFee;
        emit QuotedSendFee(nativeFeeToPay, lzTokenFeeToPay);

        require(msg.value >= nativeFeeToPay, "Insufficient FLR for LZ fee");

        try stargateUsdtOFT.send{value: nativeFeeToPay}(
            finalSendParam,
            MessagingFee({ nativeFee: nativeFeeToPay, lzTokenFee: lzTokenFeeToPay }),
            address(this) // refundAddress
        ) returns (MessagingReceipt memory msgReceipt, OFTReceipt memory sendOFTReceipt) {
            emit USDTBridgedAndComposed(
                msgReceipt.guid,
                sendOFTReceipt.amountSentLD,
                sendOFTReceipt.amountReceivedLD,
                polygonComposerContract,
                actualComposeMsg,
                nativeFeeToPay
            );
        } catch Error(string memory reason) {
            emit BridgeAndComposeFailed(reason);
            revert(reason);
        } catch {
            emit BridgeAndComposeFailed("Unknown: bridgeAndExecuteOnPolygon reverted");
            revert("Unknown: bridgeAndExecuteOnPolygon reverted");
        }
    }
}
