// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@flarenetwork/flare-periphery-contracts/coston2/IWeb2Json.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@stargatefinance/stg-evm-v2/src/interfaces/IStargate.sol";
import "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
// Import SendParam, MessagingFee, and OFTReceipt directly from IOFT.sol
import { IOFT, SendParam, MessagingFee, OFTReceipt } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

// Link OptionsBuilder to the bytes type
using OptionsBuilder for bytes;

// Stargate Router on Flare
address constant STARGATE_ROUTER_FLARE = 0x45d417612e177672958dC0537C45a8f8d754Ac2E;
// Polygon Composer contract
address constant POLYGON_COMPOSER = 0xCECA34B92DbBAf1715De564172c61A4782248CCD;
// Polygon Endpoint ID
uint32 constant POLYGON_EID = 30111;

contract CarbonOffset {
    address public stargateBridge;
    address public usdcToken;

    struct CarbonOffsetData {
        address recipientAddress;
        uint256 recipientGas;
        uint256 rate;
    }

    constructor(address _stargateBridge, address _usdcToken) {
        stargateBridge = _stargateBridge;
        usdcToken = _usdcToken;
    }

    function carbonOffset(
        bytes memory proof,
        uint256 rate,
        address recipientAddress,
        uint256 maxAmountReceived
    ) public {
        // Calculate the amount of USDC needed
        uint256 amountUSDCneeded = calculateUSDCNeeded(proof, rate);

        // Ensure the amount is within the max allowed
        require(
            amountUSDCneeded <= maxAmountReceived,
            "Amount exceeds max allowed"
        );

        // Interact with the Stargate bridge to send USDC
        bridgeUSDC(amountUSDCneeded, recipientAddress);
    }

    function calculateUSDCNeeded(
        bytes memory proof,
        uint256 rate
    ) internal pure returns (uint256) {
        // Implement your logic to calculate the USDC needed
        return 0.01 * 10 ** 6;
    }

    function bridgeUSDC(uint256 amount, address recipient) internal {
        // Implement the logic to interact with the Stargate bridge
    }

    event DebugQuoteOFT(uint256 amountReceivedLD);
    event DebugQuoteOFTAttemptSucceeded();
    event DebugSendParam(SendParam sendParam);
    event QuoteOFTFailed(string reason);
    event QuoteOFTFailedGeneric();

    /**
     * @notice Bridges USDT from Flare to Polygon and triggers a swap on Polygon via Stargate/LayerZero composability.
     * @param amountUSDT Amount of USDT to bridge (in 6 decimals)
     * @param finalRecipientOnPolygon Address to receive the swapped tokens on Polygon
     * @param minCharOutputOnPolygon Minimum amount of target token to receive on Polygon (mocked as 1 for now)
     */
    function bridgeAndSwapOnPolygon(
        uint256 amountUSDT,
        address finalRecipientOnPolygon,
        uint256 minCharOutputOnPolygon
    ) public payable { 
        IERC20(usdcToken).approve(STARGATE_ROUTER_FLARE, amountUSDT);

        bytes memory actualComposeMsg = abi.encode(msg.sender, finalRecipientOnPolygon, minCharOutputOnPolygon);
        bytes memory actualExtraOptions = OptionsBuilder.newOptions().addExecutorLzComposeOption(0, 200000, 0);

        SendParam memory debugSendParam = SendParam({
            dstEid: POLYGON_EID,
            to: addressToBytes32(POLYGON_COMPOSER),
            amountLD: amountUSDT,
            minAmountLD: amountUSDT, 
            extraOptions: bytes(""), 
            composeMsg: bytes(""),   
            oftCmd: "" 
        });
        emit DebugSendParam(debugSendParam);

        IStargate stargateRouter = IStargate(STARGATE_ROUTER_FLARE);
        
        // Attempt to call quoteOFT and catch any revert
        try stargateRouter.quoteOFT(debugSendParam) {
            // If this point is reached, quoteOFT did NOT revert with debugSendParam
            // We can't easily get the return values here without potential linter issues again,
            // but knowing it didn't revert is the primary goal of this specific test.
            emit DebugQuoteOFTAttemptSucceeded(); 
        } catch Error(string memory reason) {
            emit QuoteOFTFailed(reason);
            revert(reason);
        } catch {
            emit QuoteOFTFailedGeneric();
            revert("quoteOFT(debugSendParam) reverted without reason (generic catch)");
        }

        // The rest of the function remains commented out for this specific debug step.
        // If DebugQuoteOFTAttemptSucceeded is emitted, the next step would be to try quoteOFT
        // with the *actual* composeMsg and extraOptions, or to try and get its return values more carefully.
        /* 
        // ... (original logic with actualSendParam, quoteSend, sendToken) ...
        */
    }

    // Helper: address to bytes32
    function addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }
}
