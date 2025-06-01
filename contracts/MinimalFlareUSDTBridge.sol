// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// Importing necessary structs from your local IOFT.sol version
// OFTReceipt from your local version does NOT have messageFee.
// MessagingFee is returned by quoteSend.
import { IOFT, SendParam, MessagingFee, OFTReceipt, MessagingReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

// Polygon Endpoint ID from LayerZero documentation / Stargate configuration
uint32 constant POLYGON_EID = 30109; // Common Stargate EID for Polygon

contract MinimalFlareUSDTBridge {
    IOFT public immutable stargateUsdtOFT; // Renamed for clarity: this is the specific USDT OFT contract
    IERC20 public immutable usdtToken;       // The USDT token contract address on Flare

    event USDTBridged(uint256 amountSentLD, uint256 amountReceivedLD, uint32 dstEid, bytes32 to, uint256 lzNativeFee);
    event BridgeFailed(string reason);
    event QuotedOFTInfo(uint256 amountSentLD, uint256 amountReceivedLD);
    event QuotedSendFee(uint256 nativeFee, uint256 lzTokenFee);
    // Debug event for getFeeEstimate
    event DebugGetFeeEstimateQuoteOFTSuccess(uint256 amountSent, uint256 amountReceived);

    constructor(address _stargateUsdtOFTAddress, address _usdtTokenAddress) {
        stargateUsdtOFT = IOFT(_stargateUsdtOFTAddress);
        usdtToken = IERC20(_usdtTokenAddress);
    }

    // Helper to convert address to bytes32 for SendParam.to
    function addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    /**
     * @notice Estimates the LayerZero fee for bridging USDT using quoteSend.
     * @param _amountLD The amount of USDT to bridge (in token's decimals).
     * @param _recipientOnPolygon The EVM address of the recipient on Polygon.
     * @return nativeFee The estimated native fee (FLR) for the LayerZero message.
     * @return lzTokenFee The estimated fee in ZRO (if applicable, usually 0 when paying with native).
     */
    function getFeeEstimate(
        uint256 _amountLD,
        address _recipientOnPolygon
    ) public view returns (uint256 nativeFee, uint256 lzTokenFee) {
        SendParam memory initialSendParam = SendParam({
            dstEid: POLYGON_EID,
            to: addressToBytes32(_recipientOnPolygon),
            amountLD: _amountLD,
            minAmountLD: _amountLD, // Initial minAmountLD
            extraOptions: bytes(""),
            composeMsg: bytes(""),
            oftCmd: bytes("")
        });

        // Call quoteOFT to get OFTReceipt, which contains amountReceivedLD for slippage setting
        // According to your local IOFT.sol, OFTReceipt does not have messageFee directly.
        (, , OFTReceipt memory oftReceipt) = stargateUsdtOFT.quoteOFT(initialSendParam);

        // Prepare final SendParam with minAmountLD from the quoteOFT call
        SendParam memory finalSendParam = SendParam({
            dstEid: POLYGON_EID,
            to: addressToBytes32(_recipientOnPolygon),
            amountLD: _amountLD,
            minAmountLD: oftReceipt.amountReceivedLD, // Use amountReceivedLD for slippage
            extraOptions: bytes(""),
            composeMsg: bytes(""),
            oftCmd: bytes("")
        });

        // Call quoteSend to get the MessagingFee (nativeFee and lzTokenFee)
        // This is consistent with your local IOFT.sol where quoteSend returns MessagingFee directly.
        MessagingFee memory fee = stargateUsdtOFT.quoteSend(finalSendParam, false); // false for _payInLzToken
        return (fee.nativeFee, fee.lzTokenFee);
    }

    /**
     * @notice Bridges USDT from Flare to a recipient on Polygon.
     * @param _amountLD The amount of USDT to bridge (in token's decimals, e.g., 6 for USDT).
     * @param _recipientOnPolygon The EVM address of the recipient on Polygon.
     *
     * This function requires msg.value to be sent to cover the LayerZero native fee.
     * Call getFeeEstimate() first to determine the required msg.value.
     */
    function bridgeUSDTToPolygon(
        uint256 _amountLD,
        address _recipientOnPolygon
    ) public payable {
        // Approve the specific USDT OFT contract to spend this bridge contract's USDT
        usdtToken.approve(address(stargateUsdtOFT), _amountLD);

        // Step 1: Use quoteOFT to get the actual amountReceivedLD for minAmountLD
        SendParam memory initialSendParam = SendParam({
            dstEid: POLYGON_EID,
            to: addressToBytes32(_recipientOnPolygon),
            amountLD: _amountLD,
            minAmountLD: _amountLD, // Placeholder, will be updated by oftReceipt.amountReceivedLD
            extraOptions: bytes(""),
            composeMsg: bytes(""),
            oftCmd: bytes("")
        });

        (, , OFTReceipt memory oftReceiptForMinAmount) = stargateUsdtOFT.quoteOFT(initialSendParam);
        emit QuotedOFTInfo(oftReceiptForMinAmount.amountSentLD, oftReceiptForMinAmount.amountReceivedLD);

        // Step 2: Prepare final SendParam with refined minAmountLD
        SendParam memory finalSendParam = SendParam({
            dstEid: POLYGON_EID,
            to: addressToBytes32(_recipientOnPolygon),
            amountLD: _amountLD,
            minAmountLD: oftReceiptForMinAmount.amountReceivedLD, // Set minAmountLD based on quoteOFT
            extraOptions: bytes(""),
            composeMsg: bytes(""),
            oftCmd: bytes("")
        });

        // Step 3: Get the LayerZero messaging fee using quoteSend
        MessagingFee memory fee = stargateUsdtOFT.quoteSend(finalSendParam, false); // false for _payInLzToken
        uint256 nativeFeeToPay = fee.nativeFee;
        uint256 lzTokenFeeToPay = fee.lzTokenFee;
        emit QuotedSendFee(nativeFeeToPay, lzTokenFeeToPay);

        require(msg.value >= nativeFeeToPay, "Insufficient FLR: msg.value too low for LZ fee");

        // Step 4: Execute the send operation
        try stargateUsdtOFT.send{value: nativeFeeToPay}(
            finalSendParam,
            MessagingFee({ nativeFee: nativeFeeToPay, lzTokenFee: lzTokenFeeToPay }),
            address(this) // refundAddress
        ) returns (MessagingReceipt memory msgReceipt, OFTReceipt memory sendOFTReceipt) {
            emit USDTBridged(sendOFTReceipt.amountSentLD, sendOFTReceipt.amountReceivedLD, POLYGON_EID, addressToBytes32(_recipientOnPolygon), nativeFeeToPay);
        } catch Error(string memory reason) {
            emit BridgeFailed(reason);
            revert(reason);
        } catch {
            emit BridgeFailed("Unknown: bridgeUSDTToPolygon reverted");
            revert("Unknown: bridgeUSDTToPolygon reverted");
        }
    }
} 