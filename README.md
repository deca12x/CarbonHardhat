# CarbonHardhat: Flare Network Smart Contracts for LayerGreen

This repository contains the Solidity smart contracts deployed on the Flare Network that form the backend of the [LayerGreen platform](https://github.com/deca12x/CarbonOffset/). These contracts are responsible for initiating the cross-chain process to acquire tokenized carbon credits on the Polygon network.

**Our Vision:** To provide a secure and efficient on-chain mechanism on Flare to facilitate carbon offsetting via cross-chain interactions, powered by LayerZero.

## Overview

The primary contract in this repository, `CarbonOffsetFlare.sol`, is designed to facilitate cross-chain interactions for carbon offsetting. This contract may involve direct Stargate router interaction or integration with Flare Data Connector (FDC) for more complex on-chain logic.

## Key Features

- **Cross-Chain Bridging:** Leverages LayerZero and Stargate's OFT standard to facilitate cross-chain interactions.
- **Flare Network Integration:** Operates natively on the Flare Network, utilizing its infrastructure for transaction execution and fee payments (in FLR).
- **Secure Asset Handling:** Interacts with approved Stargate OFT contracts for token bridging.
- **Gas Fee Estimation:** Includes functionality to estimate LayerZero messaging fees required for cross-chain operations.
- **Composability:** Designed to work in conjunction with a composer contract on the destination chain (Polygon) to perform subsequent actions like token swaps.

## Contracts

### `CarbonOffsetFlare.sol`

This contract represents the primary mechanism for cross-chain interactions. Future development may explore features like on-chain carbon calculation using FDC.

## Technical Details

- **Solidity Version:** `^0.8.0` (specifically `0.8.28` as per `hardhat.config.ts`)
- **Framework:** Hardhat
- **Key Dependencies:**
  - `@openzeppelin/contracts`
  - `@layerzerolabs/lz-evm-oapp-v2` (for IOFT interfaces)
- **Target Network:** Flare Mainnet (Chain ID: 14)
- **Bridging Mechanism:** LayerZero Omnichain Fungible Token (OFT) standard, interacting with Stargate's deployed OFT contracts.

## Project Repositories

This project is part of a larger ecosystem:

- 🌍 **`CarbonOffset`:** The frontend application providing the user interface.
  - [https://github.com/deca12x/CarbonOffset/](https://github.com/deca12x/CarbonOffset/)
- 🔥 **`CarbonHardhat` (This Repository):** Flare-side smart contracts for initiating the bridge.
  - [https://github.com/deca12x/CarbonHardhat](https://github.com/deca12x/CarbonHardhat)
- 🔄 **`carbonswap`:** Polygon-side smart contract for swapping bridged assets into NCT.
  - [https://github.com/frosimanuel/carbonswap](https://github.com/frosimanuel/carbonswap)

## Setup and Usage

### Prerequisites

- Node.js (v18 or later recommended)
- Yarn or npm
- Hardhat: `npm install -g hardhat` or `yarn global add hardhat` (if not already installed)

### Environment Variables

Create a `.env` file in the root of the `CarbonHardhat` directory by copying `.env.example` (if it exists, otherwise create it manually). Add the following:

```env
FLARE_RPC_URL="your_flare_rpc_url"
PRIVATE_KEY="your_deployer_private_key"
# FLARESCAN_API_KEY="your_flarescan_api_key" # Optional: for contract verification
```

- `FLARE_RPC_URL`: Your RPC endpoint for the Flare network (e.g., from Ankr, Flare official, or other providers).
- `PRIVATE_KEY`: The private key of the account you'll use for deployment and interaction. **Never commit this file with a real private key to a public repository.**
- `FLARESCAN_API_KEY`: (Optional) Your API key for FlareScan (or compatible Blockscout instance) if you intend to verify contracts.

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

## Future Enhancements

- **Flare Data Connector (FDC) Integration:** Explore using FDC for on-chain carbon footprint calculations or attestations, potentially integrating this logic into `CarbonOffsetFlare.sol`.
- **Generalized Bridging:** Abstract the bridge contract further to support other tokens or destination chains if needed.
- **Automated Fee Handling:** More sophisticated mechanisms for handling LayerZero fees.

---

Powering transparent, cross-chain climate action from the Flare Network.
