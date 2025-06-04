const { ethers } = require("hardhat");

async function deployMockUSDT() {
    console.log("Deploying Mock USDT token...");
    
    // Deploy a mock USDT token for testing
    const MockUSDT = await ethers.getContractFactory("MockERC20");
    const mockUSDT = await MockUSDT.deploy(
        "Mock USDT",
        "USDT",
        6, // 6 decimals like real USDT
        ethers.parseUnits("1000000", 6) // 1M USDT initial supply
    );
    
    await mockUSDT.waitForDeployment();
    console.log("Mock USDT deployed to:", await mockUSDT.getAddress());
    
    return mockUSDT;
}

async function deployMockCarbonCredit() {
    console.log("Deploying Mock Carbon Credit contract...");
    
    const MockCarbonCredit = await ethers.getContractFactory("MockCarbonCredit");
    const mockCarbonCredit = await MockCarbonCredit.deploy();
    
    await mockCarbonCredit.waitForDeployment();
    console.log("Mock Carbon Credit deployed to:", await mockCarbonCredit.getAddress());
    
    return mockCarbonCredit;
}

async function main() {
    const [deployer] = await ethers.getSigners();
    
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());
    
    // Deploy mock contracts first
    const mockUSDT = await deployMockUSDT();
    const mockCarbonCredit = await deployMockCarbonCredit();
    
    // Deploy the main Carbon Offset contract
    console.log("\nDeploying CarbonOffsetPolkadot...");
    const CarbonOffsetPolkadot = await ethers.getContractFactory("CarbonOffsetPolkadot");
    
    const carbonOffset = await CarbonOffsetPolkadot.deploy(
        await mockUSDT.getAddress(),
        await mockCarbonCredit.getAddress()
    );
    
    await carbonOffset.waitForDeployment();
    
    const carbonOffsetAddress = await carbonOffset.getAddress();
    console.log("CarbonOffsetPolkadot deployed to:", carbonOffsetAddress);
    
    // Verify deployment by checking contract state
    console.log("\nVerifying deployment...");
    const rates = await carbonOffset.getCurrentRates();
    console.log("Carbon emission rate:", rates[0].toString());
    console.log("CHAR-USDT rate:", rates[1].toString());
    
    // Transfer some USDT to the deployer for testing
    console.log("\nTransferring test USDT to deployer...");
    const transferAmount = ethers.parseUnits("1000", 6); // 1000 USDT
    await mockUSDT.transfer(deployer.address, transferAmount);
    
    const usdtBalance = await mockUSDT.balanceOf(deployer.address);
    console.log("Deployer USDT balance:", ethers.formatUnits(usdtBalance, 6), "USDT");
    
    // Test the carbon offset calculation
    console.log("\nTesting carbon offset calculation...");
    const testGasUsed = 21000; // Standard ETH transfer gas
    const testTxHash = ethers.keccak256(ethers.toUtf8Bytes("test_transaction"));
    
    // Calculate offset amount
    const rates_emission = await carbonOffset.carbonEmissionRate();
    const rates_char = await carbonOffset.charUsdtRate();
    const offsetAmount = await carbonOffset.getUsdtAmountForOffset(
        testGasUsed,
        rates_emission,
        rates_char
    );
    
    console.log("For", testGasUsed, "gas units:");
    console.log("USDT needed for offset:", ethers.formatUnits(offsetAmount, 6), "USDT");
    
    console.log("\n=== Deployment Summary ===");
    console.log("Network:", await ethers.provider.getNetwork());
    console.log("Deployer:", deployer.address);
    console.log("Mock USDT:", await mockUSDT.getAddress());
    console.log("Mock Carbon Credit:", await mockCarbonCredit.getAddress());
    console.log("Carbon Offset Contract:", carbonOffsetAddress);
    console.log("================================");
    
    return {
        carbonOffset: carbonOffsetAddress,
        mockUSDT: await mockUSDT.getAddress(),
        mockCarbonCredit: await mockCarbonCredit.getAddress(),
        deployer: deployer.address
    };
}

// Create mock contracts for testing
const MockERC20_ABI = [
    "constructor(string memory name, string memory symbol, uint8 decimals, uint256 initialSupply)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];

const MockERC20_Bytecode = "0x608060405234801561001057600080fd5b506040516108123803806108128339818101604052810190610032919061012c565b8360009081610041919061037e565b50826001908161005191906103df565b5081600260006101000a81548160ff021916908360ff16021790555080600381905550806004600061008333610089565b6100009190610479565b61008e565b005b..."; // This would be the actual bytecode

// For deployment, we'll use a simple approach
const mockContractSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;
    
    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }
    
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}

contract MockCarbonCredit {
    mapping(address => uint256) public carbonCreditsOwned;
    uint256 public pricePerTonne = 50 * 10**6; // 50 USDT per tonne
    
    event CarbonCreditsPurchased(address indexed buyer, uint256 tonnes, uint256 cost);
    
    function purchaseCredits(uint256 tonnes) external {
        carbonCreditsOwned[msg.sender] += tonnes;
        emit CarbonCreditsPurchased(msg.sender, tonnes, tonnes * pricePerTonne);
    }
    
    function getCreditsOwned(address owner) external view returns (uint256) {
        return carbonCreditsOwned[owner];
    }
}
`;

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = main; 