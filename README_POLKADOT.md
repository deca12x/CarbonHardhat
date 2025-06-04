# Carbon Offset Contract - Polkadot Deployment Guide

## Overview

This project demonstrates the migration of a carbon offset smart contract from Flare Network to Polkadot's EVM environment. The contract allows users to offset carbon emissions based on their gas usage by purchasing carbon credits with USDT.

## Contract Addresses (Paseo Testnet)

> **Note**: Update these addresses after deployment

- **CarbonOffsetPolkadot**: `TBD`
- **MockUSDT**: `TBD`
- **MockCarbonCredit**: `TBD`

## Prerequisites

1. **Node.js** (v16 or later)
2. **npm** or **yarn**
3. **DOT tokens** for Paseo testnet
4. **Private key** with DOT balance

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd CarbonHardhat

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

## Environment Configuration

Create a `.env` file with the following variables:

```env
PRIVATE_KEY=your_private_key_here
PASEO_RPC_URL=https://paseo.rpc.dwellir.com
MOONBASE_RPC_URL=https://rpc.api.moonbase.moonbeam.network
```

## Deployment

### 1. Deploy to Paseo Testnet

```bash
# Compile contracts
npx hardhat compile

# Deploy to Paseo testnet
npx hardhat run scripts/deployPolkadot.js --network paseo
```

### 2. Alternative: Deploy to Moonbase Alpha (Moonbeam Testnet)

```bash
# Deploy to Moonbase Alpha (more stable EVM environment)
npx hardhat run scripts/deployPolkadot.js --network moonbase
```

## Contract Features

### 1. Carbon Offset Calculation

```solidity
function getUsdtAmountForOffset(
    uint256 _recipientGas,
    uint256 _rateFromProofData, 
    uint256 _charRateScaled     
) public pure returns (uint256 usdtAmount)
```

**Purpose**: Calculates USDT needed for carbon offsetting based on gas usage.

### 2. Simple Carbon Offset

```solidity
function offsetCarbon(
    uint256 _gasUsed,
    bytes32 _txHash
) external
```

**Purpose**: One-step carbon offsetting for a transaction.

### 3. Batch Carbon Offset

```solidity
function batchOffsetCarbon(
    uint256[] calldata _gasUsedArray,
    bytes32[] calldata _txHashArray
) external
```

**Purpose**: Offset carbon emissions for multiple transactions in a single call.

### 4. Request-Based Offsetting

```solidity
function createOffsetRequest(uint256 _gasUsed, bytes32 _txHash) external returns (bytes32 requestId)
function processOffsetRequest(bytes32 _requestId) external
```

**Purpose**: Two-step process for more complex offsetting scenarios.

## Usage Examples

### 1. Basic Carbon Offset

```javascript
const { ethers } = require("hardhat");

async function offsetCarbonExample() {
    // Connect to deployed contract
    const carbonOffset = await ethers.getContractAt(
        "CarbonOffsetPolkadot", 
        "CONTRACT_ADDRESS"
    );
    
    // Parameters
    const gasUsed = 21000; // Standard ETH transfer
    const txHash = ethers.keccak256(ethers.toUtf8Bytes("example_tx"));
    
    // Calculate required USDT
    const usdtNeeded = await carbonOffset.getUsdtAmountForOffset(
        gasUsed,
        await carbonOffset.carbonEmissionRate(),
        await carbonOffset.charUsdtRate()
    );
    
    console.log("USDT needed:", ethers.formatUnits(usdtNeeded, 6));
    
    // Approve USDT spending
    const usdtToken = await ethers.getContractAt("MockERC20", "USDT_ADDRESS");
    await usdtToken.approve(carbonOffset.target, usdtNeeded);
    
    // Perform offset
    await carbonOffset.offsetCarbon(gasUsed, txHash);
    
    console.log("Carbon offset completed!");
}
```

### 2. Batch Offset

```javascript
async function batchOffsetExample() {
    const carbonOffset = await ethers.getContractAt(
        "CarbonOffsetPolkadot", 
        "CONTRACT_ADDRESS"
    );
    
    const gasAmounts = [21000, 50000, 75000]; // Multiple transactions
    const txHashes = gasAmounts.map((_, i) => 
        ethers.keccak256(ethers.toUtf8Bytes(`tx_${i}`))
    );
    
    // Calculate total USDT needed
    let totalUsdt = 0n;
    for (const gas of gasAmounts) {
        const usdt = await carbonOffset.getUsdtAmountForOffset(
            gas,
            await carbonOffset.carbonEmissionRate(),
            await carbonOffset.charUsdtRate()
        );
        totalUsdt += usdt;
    }
    
    // Approve and execute batch offset
    const usdtToken = await ethers.getContractAt("MockERC20", "USDT_ADDRESS");
    await usdtToken.approve(carbonOffset.target, totalUsdt);
    await carbonOffset.batchOffsetCarbon(gasAmounts, txHashes);
    
    console.log("Batch carbon offset completed!");
}
```

## Testing

### 1. Run Unit Tests

```bash
npx hardhat test
```

### 2. Integration Testing

```bash
# Test on local network
npx hardhat node

# In another terminal
npx hardhat run scripts/deployPolkadot.js --network localhost
```

### 3. Manual Testing

```bash
# Get contract info
npx hardhat run scripts/getContractInfo.js --network paseo

# Test carbon offset
npx hardhat run scripts/testCarbonOffset.js --network paseo
```

## Key Differences from Flare Version

### 1. Removed Dependencies
- **Flare Data Connector (FDC)**: Replaced with configurable emission rates
- **LayerZero OFT**: Simplified to local token transfers
- **Flare ContractRegistry**: Removed entirely

### 2. Added Features
- **Owner controls**: Update emission rates and CHAR-USDT rates
- **Batch processing**: Offset multiple transactions at once
- **Request system**: Two-step offsetting process
- **Emergency functions**: Withdrawal and recovery mechanisms

### 3. Simplified Architecture
- **Mock oracles**: Instead of FDC proof verification
- **Local token handling**: No cross-chain bridging
- **Direct carbon credit purchasing**: Simplified marketplace interaction

## Performance Comparison

| Metric | Flare Network | Polkadot (Paseo) |
|--------|---------------|-------------------|
| Deployment Cost | ~X FLR | ~Y DOT |
| Transaction Cost | ~X FLR | ~Y DOT |
| Block Time | 3-5 seconds | 6-12 seconds |
| Cross-chain Support | Native (LayerZero) | XCM Available |
| Oracle Integration | FDC Native | Custom Required |

## Troubleshooting

### 1. Deployment Issues

```bash
# Check network configuration
npx hardhat verify --network paseo

# Increase gas limit if needed
npx hardhat run scripts/deployPolkadot.js --network paseo --verbose
```

### 2. Transaction Failures

- **Insufficient gas**: Increase gas limit in transaction
- **Insufficient balance**: Ensure sufficient DOT for gas fees
- **Token approval**: Ensure USDT is approved before offsetting

### 3. RPC Issues

```bash
# Try alternative RPC endpoints
# Paseo: https://rpc-paseo.dwellir.com
# Moonbase: https://rpc.api.moonbase.moonbeam.network
```

## Future Improvements

1. **XCM Integration**: Native Polkadot cross-chain messaging
2. **Substrate Pallet**: Direct Substrate runtime integration
3. **Real Oracle Integration**: Chainlink or custom oracle
4. **Governance**: On-chain parameter updates
5. **NFT Certificates**: Carbon offset proof NFTs

## Security Considerations

1. **Access Control**: Owner functions properly protected
2. **Integer Overflow**: SafeMath equivalent built into Solidity 0.8+
3. **Reentrancy**: External calls properly ordered
4. **Emergency Functions**: Available for recovery scenarios

## Support

For issues specific to this Polkadot deployment:
- Check the troubleshooting section
- Review the original Flare implementation for reference
- Submit issues via GitHub

## License

MIT License - see LICENSE file for details. 