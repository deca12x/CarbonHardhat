// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IOFT, SendParam, MessagingFee, OFTReceipt, MessagingReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import { OptionsBuilder } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

contract CarbonOffsetFlare {
    using OptionsBuilder for bytes;

    // LayerZero OFT Bridging State
    IOFT public immutable stargateUsdtOFT;       // USDT OFT on Flare (0x1C1...)
    IERC20 public immutable usdtTokenOnFlare;  // ERC20 USDT on Flare (0x0B3...)
    address public immutable polygonComposerContract; // Your contract on Polygon

    // Stargate Polygon Endpoint ID
    uint32 constant POLYGON_EID = 30109;

    // FDC Proof and Carbon Offset State
    address public fdcStargateBridge; // Stargate bridge address for USDC (FDC flow)
    address public fdcUsdcToken;      // USDC token address for FDC flow

    struct CarbonOffsetData {
        address recipientAddress;
        uint256 recipientGas;
        uint256 rate;
    }

    // Events for LayerZero OFT Bridging
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

    // Events for FDC Carbon Offset (Optional, can be added if needed)
    // event FDCProofVerified(...);
    // event USDCCarbonOffsetInitiated(...);

    constructor(
        // LayerZero OFT parameters
        address _stargateUsdtOFTAddress,
        address _erc20UsdtTokenAddress,
        address _polygonComposerContractAddress,
        // FDC Carbon Offset parameters
        address _fdcStargateBridge,
        address _fdcUsdcToken
    ) {
        // Initialize LayerZero OFT related state
        stargateUsdtOFT = IOFT(_stargateUsdtOFTAddress);
        usdtTokenOnFlare = IERC20(_erc20UsdtTokenAddress);
        polygonComposerContract = _polygonComposerContractAddress;

        // Initialize FDC Carbon Offset related state
        fdcStargateBridge = _fdcStargateBridge;
        fdcUsdcToken = _fdcUsdcToken;
    }

    function addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    // --- LayerZero OFT Bridging Functions ---

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

    // --- FDC Proof and Carbon Offset Functions ---

    function carbonOffset(
        bytes memory proof, // This proof is not FDC proof, seems like custom or unused
        uint256 rate,
        address recipientAddress,
        uint256 maxAmountReceived
    ) public {
        // Note: The 'proof' parameter here doesn't seem to be used in calculateUSDCNeeded
        // and is different from the FDC IWeb2Json.Proof used in addCarbonOffset.
        // Clarify its purpose if it's intended to be validated.
        uint256 amountUSDCneeded = calculateUSDCNeeded(proof, rate);

        require(
            amountUSDCneeded <= maxAmountReceived,
            "Amount exceeds max allowed"
        );

        bridgeUSDC(amountUSDCneeded, recipientAddress);
    }

    function calculateUSDCNeeded(
        bytes memory proof, // This 'proof' parameter is currently unused in the logic
        uint256 rate        // This 'rate' parameter is currently unused in the logic
    ) internal pure returns (uint256) {
        // Placeholder logic: returns 0.01 USDC (assuming 6 decimals for USDC)
        // Consider if 'proof' or 'rate' should influence this calculation.
        return 0.01 * 10 ** 6;
    }

    function bridgeUSDC(uint256 amount, address recipient) internal {
        // TODO: Implement the logic to interact with the Stargate bridge (fdcStargateBridge)
        // This would involve:
        // 1. Approving fdcUsdcToken to fdcStargateBridge for 'amount'.
        // 2. Calling the appropriate Stargate function to bridge 'amount' of fdcUsdcToken
        //    to 'recipient' on the destination chain.
        // This is a placeholder and needs actual Stargate integration for USDC.
        // Example (conceptual, actual Stargate API will differ):
        // IERC20(fdcUsdcToken).approve(fdcStargateBridge, amount);
        // IStargateRouter(fdcStargateBridge).swap(... parameters for USDC bridging ...);
    }

    function addCarbonOffset(IWeb2Json.Proof calldata proof) public {
        require(isJsonApiProofValid(proof), "Invalid proof");

        // Assuming CarbonOffsetData struct is defined as shown in your original contract
        CarbonOffsetData memory data = abi.decode(
            proof.data.responseBody.abiEncodedData,
            (CarbonOffsetData)
        );

        // Use data.recipientAddress, data.recipientGas, and data.rate
        // Implement your business logic here for FDC-based carbon offsetting
        // This might involve calling calculateUSDCNeeded with data.rate
        // and then bridgeUSDC with the result and data.recipientAddress.
        // For example:
        // uint256 usdcNeeded = calculateUSDCNeeded(bytes(""), data.rate); // Pass empty bytes if proof not used in calc
        // bridgeUSDC(usdcNeeded, data.recipientAddress);
    }

    function isJsonApiProofValid(
        IWeb2Json.Proof calldata _proof
    ) private view returns (bool) {
        // Get the contract registry address (this might need to be configured or fetched)
        // For Coston2, the FDC Verification contract address is usually obtained via ContractRegistry.
        // Ensure ContractRegistry is correctly set up or its address is known.
        // address contractRegistryAddress = 0x...; // Address of ContractRegistry on Coston2
        // IContractRegistry registry = IContractRegistry(contractRegistryAddress);
        // IFdcVerification fdcVerification = IFdcVerification(registry.getContractAddressByName("FdcVerification"));
        // return fdcVerification.verifyJsonApi(_proof);
        
        // Direct call if ContractRegistry.getFdcVerification() returns the verification contract directly
        // This depends on how flare-periphery-contracts is structured and initialized in your environment.
        // The original code `ContractRegistry.getFdcVerification().verifyJsonApi(_proof)` implies
        // that `ContractRegistry` is a contract instance or library that provides `getFdcVerification`.
        // If `ContractRegistry` is an import for a library or a contract you deploy/reference,
        // ensure it's correctly linked or its address is known.
        // For now, assuming ContractRegistry.getFdcVerification() works as intended in your setup.
        return ContractRegistry.getFdcVerification().verifyJsonApi(_proof);
    }
}
