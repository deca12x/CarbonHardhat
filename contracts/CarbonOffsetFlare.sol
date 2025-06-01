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
    IOFT public immutable stargateUsdtOFT;       // USDT OFT on Flare (e.g., 0x1C1...)
    IERC20 public immutable usdtTokenOnFlare;  // ERC20 USDT on Flare (e.g., 0x0B3...)
    address public immutable polygonComposerContract; // Your contract on Polygon

    // Stargate Polygon Endpoint ID
    uint32 constant POLYGON_EID = 30109;

    // --- Start: FDC and Carbon Offset Additions ---
    // Decimals for rate calculations
    // Example: If rate is in (tonnes_CO2 * 10^6) per gas_unit, RATE_DECIMALS = 6.
    // If actual rate is 0.0025, it will be stored as 2500 in the FDC proof.
    uint256 constant RATE_DECIMALS = 6; 
    // USDT typically has 6 decimals.
    uint256 constant USDT_DECIMALS = 6; 

    struct CarbonOffsetData {
        address recipientAddress; // Address that spent the gas (for record-keeping, not directly used as bridge recipient)
        uint256 recipientGas;     // Gas units spent
        uint256 rate;             // Scaled carbon emission rate (e.g., (tonnes_CO2 * 10^RATE_DECIMALS) / gas_unit)
    }
    // --- End: FDC and Carbon Offset Additions ---

    // FDC Proof and Carbon Offset State (Original fields - fdcStargateBridge & fdcUsdcToken might be for a separate USDC flow)
    address public fdcStargateBridge; // Stargate bridge address for USDC (FDC flow)
    address public fdcUsdcToken;      // USDC token address for FDC flow

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
        address _polygonComposerContractAddress
    ) {
        // Initialize LayerZero OFT related state
        stargateUsdtOFT = IOFT(_stargateUsdtOFTAddress);
        usdtTokenOnFlare = IERC20(_erc20UsdtTokenAddress);
        polygonComposerContract = _polygonComposerContractAddress;

        // Initialize FDC Carbon Offset related state with placeholder values
        // These are kept for potential future USDC flows but not used in current implementation
        fdcStargateBridge = address(0);
        fdcUsdcToken = address(0);
    }

    function addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    // --- LayerZero OFT Bridging Functions (Existing - Kept as is for direct USDT bridging) ---

    /**
     * @notice Estimates LayerZero fee for bridging USDT and executing a compose message.
     * @param _amountUSDT Amount of USDT to bridge (atomic units, e.g., 6 decimals).
     * @param _flareInitiator The address initiating this on Flare (will be part of composeMsg).
     * @param _finalEoaRecipientOnPolygon EOA on Polygon for final benefit (part of composeMsg).
     * @param _minOutputOrOtherParam Third parameter for composeMsg (e.g., min tokens out from swap).
     * @param _composeGasLimit Gas for lzCompose on the Polygon contract.
     * @return nativeFee Estimated native FLR fee for LayerZero.
     * @return lzTokenFee Estimated ZRO token fee for LayerZero (usually 0).
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
            minAmountLD: _amountUSDT, 
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
     * @notice Bridges USDT from the caller, sends it to Polygon composer, with a compose message.
     * @dev Caller must have approved this contract to spend _amountUSDT of their USDT.
     * @param _amountUSDT Amount of USDT to bridge (atomic units).
     * @param _finalEoaRecipientOnPolygon EOA on Polygon for final benefit of compose message.
     * @param _minOutputOrOtherParam Third parameter for composeMsg (e.g., min tokens out from swap).
     * @param _composeGasLimit Gas for lzCompose execution on the Polygon contract.
     */
    function bridgeAndExecuteOnPolygon(
        uint256 _amountUSDT,
        address _finalEoaRecipientOnPolygon, 
        uint256 _minOutputOrOtherParam,      
        uint256 _composeGasLimit           
    ) public payable {
        // This function assumes USDT is transferred *from the msg.sender* to the OFT contract.
        // The approval should be done by msg.sender for their USDT to the OFT contract, or
        // if the USDT is intended to come *from this contract's balance*, then this function needs adjustment.
        // Based on original `usdtTokenOnFlare.approve`, it seems like it was intended to pull from *this contract*.
        // However, for a direct bridge by a user, they'd approve OFT and call OFT directly or this contract would pull from them.
        // Clarification: The original script transfers USDT to this contract first, then calls this.
        // So, this contract needs to approve the OFT.
        usdtTokenOnFlare.approve(address(stargateUsdtOFT), _amountUSDT);


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
            address(this) // refundAddress for FLR
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

    // --- Start: New FDC Carbon Offset Functions ---

    /**
     * @notice Calculates the amount of USDT (scaled by USDT_DECIMALS) needed for carbon offsetting.
     * @param _recipientGas Gas units spent by the user (from FDC proof).
     * @param _rateFromProofData Scaled carbon emission rate from FDC proof (e.g., (tonnes_CO2 * 10^RATE_DECIMALS) / gas_unit).
     * @param _charRateScaled Scaled CHAR-USDT rate (e.g., (USDT_atomic_units * 10^USDT_DECIMALS) / tonne_CO2).
     * @return usdtAmount The amount of USDT (in its atomic unit, e.g., 6 decimals) needed for the offset.
     */
    function getUsdtAmountForOffset(
        uint256 _recipientGas,
        uint256 _rateFromProofData, 
        uint256 _charRateScaled     
    ) public pure returns (uint256 usdtAmount) {
        // carbonTonnes_X_Precision = recipientGas * rateFromProofData
        // This result is scaled by 10^RATE_DECIMALS
        uint256 carbonTonnesScaled = _recipientGas * _rateFromProofData;
        
        // usdtAmount = (carbonTonnesScaled * charRateScaled) / (10^RATE_DECIMALS)
        // charRateScaled is (USDT_atomic_units / tonne_CO2)
        // Resulting usdtAmount will be in atomic units of USDT (e.g., scaled by 10^USDT_DECIMALS)
        if (RATE_DECIMALS == 0) { // Avoid division by zero if rate is not scaled
             return carbonTonnesScaled * _charRateScaled;
        }
        return (carbonTonnesScaled * _charRateScaled) / (10**RATE_DECIMALS);
    }

    /**
     * @notice Verifies FDC proof, calculates USDT needed for offset, and bridges it using LayerZero.
     * @dev The calling script/user must ensure:
     *      1. `getUsdtAmountForOffset` is called off-chain to determine `usdtAmountToBridge`.
     *      2. `usdtAmountToBridge` of USDT is transferred to THIS contract's address.
     *      3. `getFeeForBridgeAndExecute` is called (with `usdtAmountToBridge` and other params) to determine `nativeFee`.
     *      4. This function is then called with the FDC `_proof`, `_charRateScaled`, bridging parameters,
     *         and the calculated `nativeFee` sent as `msg.value`.
     * @param _proof The FDC `IWeb2Json.Proof` object containing `CarbonOffsetData` in its `responseBody.abiEncodedData`.
     * @param _charRateScaled Scaled CHAR-USDT rate (e.g., (USDT_atomic_units * 10^USDT_DECIMALS) / tonne_CO2).
     * @param _finalEoaRecipientOnPolygon EOA on Polygon for final benefit of the compose message (e.g., receives swapped tokens).
     * @param _minOutputOrOtherParam Third parameter for the composeMsg (e.g., minimum tokens out from a swap on Polygon).
     * @param _composeGasLimit Gas limit for the `lzCompose` execution on the Polygon contract.
     */
    function offsetAndBridge(
        IWeb2Json.Proof calldata _proof,
        uint256 _charRateScaled,
        address _finalEoaRecipientOnPolygon,
        uint256 _minOutputOrOtherParam,
        uint256 _composeGasLimit
    ) public payable {
        require(isJsonApiProofValid(_proof), "Invalid FDC proof");

        CarbonOffsetData memory data = abi.decode(
            _proof.data.responseBody.abiEncodedData,
            (CarbonOffsetData)
        );

        // Recalculate usdtAmountToBridge on-chain using verified proof data for security
        uint256 usdtAmountToBridge = getUsdtAmountForOffset(data.recipientGas, data.rate, _charRateScaled);
        require(usdtAmountToBridge > 0, "Offset amount must be greater than zero");

        // Ensure this contract has enough USDT (which the script should have transferred to it beforehand)
        require(usdtTokenOnFlare.balanceOf(address(this)) >= usdtAmountToBridge, "Contract lacks required USDT for offset");

        // Approve the OFT contract to spend USDT from *this contract's* balance
        usdtTokenOnFlare.approve(address(stargateUsdtOFT), usdtAmountToBridge);

        // Prepare LayerZero message parameters. msg.sender of this `offsetAndBridge` call is the initiator on Flare.
        bytes memory actualComposeMsg = abi.encode(msg.sender, _finalEoaRecipientOnPolygon, _minOutputOrOtherParam);
        bytes memory actualExtraOptions = OptionsBuilder.newOptions().addExecutorLzComposeOption(0, uint128(_composeGasLimit), 0);

        // Quote OFT to get minAmountLD for the send operation, ensuring slippage protection
        SendParam memory initialSendParamForQuote = SendParam({
            dstEid: POLYGON_EID,
            to: addressToBytes32(polygonComposerContract),
            amountLD: usdtAmountToBridge,
            minAmountLD: usdtAmountToBridge, // Initial placeholder, will be refined by oftReceipt.amountReceivedLD
            extraOptions: actualExtraOptions,
            composeMsg: actualComposeMsg,
            oftCmd: bytes("")
        });

        (, , OFTReceipt memory oftReceiptForMinAmount) = stargateUsdtOFT.quoteOFT(initialSendParamForQuote);
        emit QuotedOFTInfo(oftReceiptForMinAmount.amountSentLD, oftReceiptForMinAmount.amountReceivedLD);

        // Prepare final SendParam for the bridge, using the refined minAmountLD from the quote
        SendParam memory finalSendParam = SendParam({
            dstEid: POLYGON_EID,
            to: addressToBytes32(polygonComposerContract),
            amountLD: usdtAmountToBridge,
            minAmountLD: oftReceiptForMinAmount.amountReceivedLD, // Use refined minAmountLD from quoteOFT
            extraOptions: actualExtraOptions,
            composeMsg: actualComposeMsg,
            oftCmd: bytes("")
        });

        // Quote the send fee (primarily to get lzTokenFee and for event emission; native fee is from msg.value)
        MessagingFee memory feeInfo = stargateUsdtOFT.quoteSend(finalSendParam, false);
        uint256 nativeFeeExpectedByLZ = feeInfo.nativeFee; // This is what LZ estimates
        uint256 lzTokenFeeToPay = feeInfo.lzTokenFee;
        emit QuotedSendFee(nativeFeeExpectedByLZ, lzTokenFeeToPay);

        // msg.value is the native FLR fee paid by the caller (script), 
        // which should be >= nativeFeeExpectedByLZ from a prior call to getFeeForBridgeAndExecute.
        require(msg.value >= nativeFeeExpectedByLZ, "Insufficient FLR for LZ fee (paid vs estimated)");

        // Execute the LayerZero send operation
        try stargateUsdtOFT.send{value: msg.value}( // Use actual msg.value as it's what the user sent
            finalSendParam,
            MessagingFee({ nativeFee: msg.value, lzTokenFee: lzTokenFeeToPay }), // Use msg.value for nativeFee here
            address(this) // refundAddress for FLR
        ) returns (MessagingReceipt memory msgReceipt, OFTReceipt memory sendOFTReceipt) {
            emit USDTBridgedAndComposed(
                msgReceipt.guid,
                sendOFTReceipt.amountSentLD,
                sendOFTReceipt.amountReceivedLD,
                polygonComposerContract,
                actualComposeMsg,
                msg.value // Log the actual native FLR fee paid
            );
        } catch Error(string memory reason) {
            emit BridgeAndComposeFailed(reason);
            revert(reason);
        } catch {
            emit BridgeAndComposeFailed("Unknown: offsetAndBridge reverted");
            revert("Unknown: offsetAndBridge reverted");
        }
    }
    
    /**
     * @notice Verifies the FDC JSON API proof.
     * @param _proof The FDC `IWeb2Json.Proof` object.
     * @return True if the proof is valid, false otherwise.
     */
    function isJsonApiProofValid(
        IWeb2Json.Proof calldata _proof
    ) private view returns (bool) {
        // This assumes ContractRegistry.getFdcVerification() is correctly set up/available
        // in the deployment environment and returns the FDC Verification contract interface.
        // On Coston2, ContractRegistry is typically at a known address.
        return ContractRegistry.getFdcVerification().verifyJsonApi(_proof);
    }

    // --- End: New FDC Carbon Offset Functions ---

    // --- Original FDC Proof and Carbon Offset Functions (Review if still needed or how they integrate) ---
    // The following functions (carbonOffset, calculateUSDCNeeded, bridgeUSDC, addCarbonOffset)
    // seem to be part of a different or earlier design, possibly for a USDC-based FDC flow or a different data structure.
    // If the new `offsetAndBridge` flow for USDT is the primary FDC use case, these might be deprecated,
    // removed, or refactored to avoid confusion or conflict with the CarbonOffsetData struct used above.

    /**
     * @notice Original function for carbon offset, seems to be for a USDC flow.
     * @dev The 'proof' parameter here is generic bytes, not IWeb2Json.Proof.
     *      The 'rate' here might have a different meaning/scale than the one in CarbonOffsetData.
     */
    function carbonOffset(
        bytes memory proof, 
        uint256 rate,
        address recipientAddress,
        uint256 maxAmountReceived // This suggests an amount check for USDC received.
    ) public {
        // Note: The 'proof' parameter here doesn't seem to be used in calculateUSDCNeeded
        // and is different from the FDC IWeb2Json.Proof used in the new `offsetAndBridge` flow.
        // Clarify its purpose if it's intended to be validated.
        uint256 amountUSDCneeded = calculateUSDCNeeded(proof, rate);

        require(
            amountUSDCneeded <= maxAmountReceived,
            "Amount exceeds max allowed"
        );

        bridgeUSDC(amountUSDCneeded, recipientAddress);
    }

    /**
     * @notice Original function to calculate USDC needed.
     * @dev 'proof' and 'rate' parameters are currently unused in this placeholder logic.
     *      This function likely needs to be connected to a specific FDC data source or logic if used.
     */
    function calculateUSDCNeeded(
        bytes memory proof, // This 'proof' parameter is currently unused.
        uint256 rate        // This 'rate' parameter is currently unused.
    ) internal pure returns (uint256) {
        // Placeholder logic: returns 0.01 USDC (assuming 6 decimals for USDC)
        // Consider if 'proof' or 'rate' should influence this calculation if this flow is active.
        return 0.01 * 10 ** 6;
    }

    /**
     * @notice Original placeholder for bridging USDC via Stargate.
     * @dev Needs actual Stargate integration for USDC if this flow is to be used.
     */
    function bridgeUSDC(uint256 amount, address recipient) internal {
        // TODO: Implement the logic to interact with the Stargate bridge (fdcStargateBridge for USDC).
        // This would involve:
        // 1. Approving fdcUsdcToken to fdcStargateBridge for 'amount'.
        // 2. Calling the appropriate Stargate function to bridge 'amount' of fdcUsdcToken
        //    to 'recipient' on the destination chain.
        // Example (conceptual, actual Stargate API will differ):
        // IERC20(fdcUsdcToken).approve(fdcStargateBridge, amount);
        // IStargateRouter(fdcStargateBridge).swap(... parameters for USDC bridging ...);
    }

    /**
     * @notice Original function to add carbon offset data using an FDC proof.
     * @dev This decodes `CarbonOffsetData` from an `IWeb2Json.Proof`.
     *      If this is part of a separate FDC flow (e.g., for USDC or just logging data),
     *      ensure the `CarbonOffsetData` struct aligns with its needs, or use a distinct struct.
     *      The current top-level `CarbonOffsetData` is tailored for the `offsetAndBridge` USDT flow.
     */
    function addCarbonOffset(IWeb2Json.Proof calldata proof) public {
        require(isJsonApiProofValid(proof), "Invalid proof");

        // This will now use the top-level `CarbonOffsetData` struct.
        // If this function was intended for a different data structure from FDC for a different purpose,
        // a separate struct specific to that purpose should be defined and used here.
        CarbonOffsetData memory data = abi.decode(
            proof.data.responseBody.abiEncodedData,
            (CarbonOffsetData) 
        );

        // Use data.recipientAddress, data.recipientGas, and data.rate as decoded.
        // Implement your business logic here if this function serves a purpose distinct from `offsetAndBridge`.
        // For example, if it's for a USDC offset based on the same FDC data structure:
        // uint256 usdcToOffset = calculateUSDCNeededWithFDCData(data.rate, data.recipientGas); // A new calculation function
        // bridgeUSDC(usdcToOffset, data.recipientAddress); // (after ensuring contract has/gets USDC)
    }
}