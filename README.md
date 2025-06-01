# CarbonHardhat: Flare Network Smart Contracts for CarbonOffset

This repository contains the Solidity smart contracts deployed on the Flare Network that form the backend of the [CarbonOffset platform](https://github.com/deca12x/CarbonOffset/). These contracts are responsible for initiating the cross-chain process to acquire tokenized carbon credits on the Polygon network.

**Our Vision:** To provide a secure and efficient on-chain mechanism on Flare to facilitate carbon offsetting via cross-chain interactions, powered by LayerZero.

## Overview

The primary contract in this repository, `MinimalFlareUSDTBridge.sol`, enables users to bridge USDT (specifically, Stargate's USDT OFT - Omnichain Fungible Token) from the Flare Network to Polygon. This is a crucial step in the CarbonOffset user flow, where funds originating from Flare are used to purchase NCT (Nature Carbon Tonne) tokens on Polygon.

This system is designed to:
1.  Receive USDT from a user (or a contract acting on their behalf) on Flare.
2.  Utilize LayerZero's omnichain messaging and Stargate's OFT infrastructure to transfer these USDT tokens to a specified recipient address on the Polygon network.
3.  The recipient on Polygon is typically the `TokenSwapComposer` contract from our [`carbonswap` repository](https://github.com/frosimanuel/carbonswap), which then swaps the received USDT for NCT.

## Key Features

*   **Cross-Chain Bridging:** Leverages LayerZero and Stargate's OFT standard to seamlessly transfer USDT from Flare to Polygon.
*   **Flare Network Integration:** Operates natively on the Flare Network, utilizing its infrastructure for transaction execution and fee payments (in FLR).
*   **Secure Asset Handling:** Interacts with approved Stargate OFT contracts for token bridging.
*   **Gas Fee Estimation:** Includes functionality to estimate LayerZero messaging fees required for the cross-chain operation.
*   **Composability:** Designed to work in conjunction with a composer contract on the destination chain (Polygon) to perform subsequent actions like token swaps.

## Contracts

### `MinimalFlareUSDTBridge.sol`

This is the core contract responsible for the bridging process.

*   **Constructor:** Initializes with the addresses of the Stargate USDT OFT contract and the standard ERC20 USDT token contract on Flare.
*   **`getFeeEstimate(uint256 _amountLD, address _recipientOnPolygon)`:**
    *   Calculates the LayerZero messaging fee (in native FLR) required to send a specified amount of USDT to a recipient on Polygon.
    *   It uses `quoteOFT` to determine the `amountReceivedLD` for slippage protection and then `quoteSend` to get the actual `MessagingFee`.
*   **`bridgeUSDTToPolygon(uint256 _amountLD, address _recipientOnPolygon)`:**
    *   The main function to initiate the bridge.
    *   Requires the caller to send FLR (msg.value) to cover the LayerZero native fee (obtained from `getFeeEstimate`).
    *   Approves the Stargate USDT OFT contract to spend the bridge contract's USDT.
    *   Calls the `send` function on the Stargate USDT OFT contract, providing parameters for the destination (Polygon EID, recipient address), amount, and messaging fees.
    *   Emits events for successful bridging or failures.

### `CarbonOffsetFlare.sol` (Exploratory/Alternative)

This contract represents an earlier exploration or an alternative approach that might involve direct Stargate router interaction or integration with Flare Data Connector (FDC) for more complex on-chain logic. The current primary bridging mechanism is handled by `MinimalFlareUSDTBridge.sol`. Future development may revisit `CarbonOffsetFlare.sol` for features like on-chain carbon calculation using FDC.

## Technical Details

*   **Solidity Version:** `^0.8.0` (specifically `0.8.28` as per `hardhat.config.ts`)
*   **Framework:** Hardhat
*   **Key Dependencies:**
    *   `@openzeppelin/contracts`
    *   `@layerzerolabs/lz-evm-oapp-v2` (for IOFT interfaces)
*   **Target Network:** Flare Mainnet (Chain ID: 14)
*   **Bridging Mechanism:** LayerZero Omnichain Fungible Token (OFT) standard, interacting with Stargate's deployed OFT contracts.

## Project Repositories

This project is part of a larger ecosystem:

*   🌍 **`CarbonOffset`:** The frontend application providing the user interface.
    *   [https://github.com/deca12x/CarbonOffset/](https://github.com/deca12x/CarbonOffset/)
*   🔥 **`CarbonHardhat` (This Repository):** Flare-side smart contracts for initiating the bridge.
    *   [https://github.com/deca12x/CarbonHardhat](https://github.com/deca12x/CarbonHardhat)
*   🔄 **`carbonswap`:** Polygon-side smart contract for swapping bridged assets into NCT.
    *   [https://github.com/frosimanuel/carbonswap](https://github.com/frosimanuel/carbonswap)

## Setup and Usage

### Prerequisites

*   Node.js (v18 or later recommended)
*   Yarn or npm
*   Hardhat: `npm install -g hardhat` or `yarn global add hardhat` (if not already installed)

### Environment Variables

Create a `.env` file in the root of the `CarbonHardhat` directory by copying `.env.example` (if it exists, otherwise create it manually). Add the following:

```env
FLARE_RPC_URL="your_flare_rpc_url"
PRIVATE_KEY="your_deployer_private_key"
# FLARESCAN_API_KEY="your_flarescan_api_key" # Optional: for contract verification
```

*   `FLARE_RPC_URL`: Your RPC endpoint for the Flare network (e.g., from Ankr, Flare official, or other providers).
*   `PRIVATE_KEY`: The private key of the account you'll use for deployment and interaction. **Never commit this file with a real private key to a public repository.**
*   `FLARESCAN_API_KEY`: (Optional) Your API key for FlareScan (or compatible Blockscout instance) if you intend to verify contracts.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/deca12x/CarbonHardhat.git
    cd CarbonHardhat
    ```
2.  Install dependencies:
    ```bash
    npm install
    # or
    yarn install
    ```

### Compilation

Compile the smart contracts:
```bash
npx hardhat compile
```

### Deployment and Bridging (`MinimalFlareUSDTBridge.sol`)

The `scripts/deployAndBridge.ts` script handles both deploying the `MinimalFlareUSDTBridge.sol` contract and initiating a test bridge transaction.

**Before running:**
1.  Ensure your `.env` file is correctly configured with `FLARE_RPC_URL` and `PRIVATE_KEY`.
2.  The deployer account must have sufficient FLR for deployment and to cover LayerZero messaging fees.
3.  The deployer account must have sufficient Stargate USDT on Flare to transfer to the bridge contract and then bridge.
4.  Review and update the configuration constants within `scripts/deployAndBridge.ts` if necessary:
    *   `flareUsdtAddress`: Address of the ERC20 USDT token on Flare.
    *   `flareUsdtOFTAddress`: Address of the Stargate USDT OFT contract on Flare.
    *   `amountUSDTToBridge`: The amount of USDT (in its 6 decimal format) to bridge.
    *   `polygonRecipientAddress`: The address on Polygon that will receive the USDT.

**To run the script:**

```bash
npx hardhat run scripts/deployAndBridge.ts --network flare
```

This script will:
1.  Deploy `MinimalFlareUSDTBridge.sol` to the Flare network.
2.  Transfer the specified `amountUSDTToBridge` from the deployer's wallet to the newly deployed `MinimalFlareUSDTBridge` contract.
3.  Estimate the LayerZero native fee (FLR) required for the bridge operation.
4.  Call `bridgeUSDTToPolygon` on the `MinimalFlareUSDTBridge` contract, sending the estimated native fee as `msg.value`.
5.  Output transaction hashes and relevant information, including a link to LayerZeroScan to track the cross-chain message.

## Future Enhancements

*   **Flare Data Connector (FDC) Integration:** Explore using FDC for on-chain carbon footprint calculations or attestations, potentially integrating this logic into `CarbonOffsetFlare.sol`.
*   **Generalized Bridging:** Abstract the bridge contract further to support other tokens or destination chains if needed.
*   **Automated Fee Handling:** More sophisticated mechanisms for handling LayerZero fees.

---

Powering transparent, cross-chain climate action from the Flare Network.
