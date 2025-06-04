const hre = require("hardhat");

async function main() {
    console.log("Testing Carbon Offset Contract...");
    
    // Try to get ethers from hardhat-toolbox first
    let ethers;
    try {
        ethers = hre.ethers;
    } catch (error) {
        // If ethers is not available, try to require it directly
        try {
            ethers = require("ethers");
            // Create provider and connect
            const provider = new ethers.JsonRpcProvider("http://localhost:8545");
            const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Default hardhat key
            const wallet = new ethers.Wallet(privateKey, provider);
            
            // Mock the hardhat-style getSigners
            ethers.getSigners = async () => {
                const signer1Key = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c6a2440ce6b9ce65a04bc";
                const wallet1 = new ethers.Wallet(signer1Key, provider);
                return [wallet, wallet1];
            };
            
            // Mock getContractFactory
            ethers.getContractFactory = async (contractName) => {
                const artifacts = await hre.artifacts.readArtifact(contractName);
                return new ethers.ContractFactory(artifacts.abi, artifacts.bytecode, wallet);
            };
            
        } catch (err) {
            console.error("Could not load ethers:", err);
            throw new Error("Ethers.js is required but not available");
        }
    }
    
    if (!ethers || !ethers.getSigners) {
        throw new Error("Could not initialize ethers properly");
    }
    
    const [deployer, user1] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Test user:", user1.address);
    
    // Deploy contracts
    console.log("\n=== Deploying Contracts ===");
    
    // Deploy Mock USDT
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockUSDT = await MockERC20.deploy(
        "Mock USDT",
        "USDT",
        6, // 6 decimals
        ethers.parseUnits("1000000", 6) // 1M USDT initial supply
    );
    await mockUSDT.waitForDeployment();
    console.log("Mock USDT deployed to:", await mockUSDT.getAddress());
    
    // Deploy Mock Carbon Credit
    const MockCarbonCredit = await ethers.getContractFactory("MockCarbonCredit");
    const mockCarbonCredit = await MockCarbonCredit.deploy();
    await mockCarbonCredit.waitForDeployment();
    console.log("Mock Carbon Credit deployed to:", await mockCarbonCredit.getAddress());
    
    // Set USDT token in carbon credit contract
    await mockCarbonCredit.setUsdtToken(await mockUSDT.getAddress());
    
    // Deploy Carbon Offset Contract
    const CarbonOffsetPolkadot = await ethers.getContractFactory("CarbonOffsetPolkadot");
    const carbonOffset = await CarbonOffsetPolkadot.deploy(
        await mockUSDT.getAddress(),
        await mockCarbonCredit.getAddress()
    );
    await carbonOffset.waitForDeployment();
    console.log("Carbon Offset Contract deployed to:", await carbonOffset.getAddress());
    
    // Transfer USDT to test user
    const testAmount = ethers.parseUnits("1000", 6); // 1000 USDT
    await mockUSDT.transfer(user1.address, testAmount);
    console.log("Transferred", ethers.formatUnits(testAmount, 6), "USDT to test user");
    
    // Check initial balances
    console.log("\n=== Initial Balances ===");
    const user1UsdtBalance = await mockUSDT.balanceOf(user1.address);
    console.log("User1 USDT Balance:", ethers.formatUnits(user1UsdtBalance, 6), "USDT");
    
    // Test 1: Calculate offset amount
    console.log("\n=== Test 1: Calculate Offset Amount ===");
    const testGasUsed = 21000;
    const emissionRate = await carbonOffset.carbonEmissionRate();
    const charRate = await carbonOffset.charUsdtRate();
    
    console.log("Gas used:", testGasUsed);
    console.log("Emission rate (scaled):", emissionRate.toString());
    console.log("CHAR-USDT rate (scaled):", charRate.toString());
    
    const usdtNeeded = await carbonOffset.getUsdtAmountForOffset(
        testGasUsed,
        emissionRate,
        charRate
    );
    
    console.log("USDT needed for offset:", ethers.formatUnits(usdtNeeded, 6), "USDT");
    
    // Test 2: Simple carbon offset
    console.log("\n=== Test 2: Simple Carbon Offset ===");
    const txHash = ethers.keccak256(ethers.toUtf8Bytes("test_transaction_1"));
    
    // Connect to contract as user1
    const carbonOffsetAsUser1 = carbonOffset.connect(user1);
    const mockUSDTAsUser1 = mockUSDT.connect(user1);
    
    // Approve USDT spending
    await mockUSDTAsUser1.approve(await carbonOffset.getAddress(), usdtNeeded);
    console.log("Approved", ethers.formatUnits(usdtNeeded, 6), "USDT for carbon offset contract");
    
    // Perform offset
    const offsetTx = await carbonOffsetAsUser1.offsetCarbon(testGasUsed, txHash);
    const receipt = await offsetTx.wait();
    
    console.log("Carbon offset transaction hash:", receipt.hash);
    console.log("Gas used for offset transaction:", receipt.gasUsed.toString());
    
    // Check user's total offsets
    const userTotalOffsets = await carbonOffset.getUserTotalOffsets(user1.address);
    console.log("User's total carbon offsets:", ethers.formatUnits(userTotalOffsets, 6), "tonnes CO2");
    
    // Check updated balances
    const user1UsdtBalanceAfter = await mockUSDT.balanceOf(user1.address);
    console.log("User1 USDT Balance after offset:", ethers.formatUnits(user1UsdtBalanceAfter, 6), "USDT");
    
    // Test 3: Batch carbon offset
    console.log("\n=== Test 3: Batch Carbon Offset ===");
    const gasAmounts = [25000, 50000, 75000];
    const txHashes = gasAmounts.map((_, i) => 
        ethers.keccak256(ethers.toUtf8Bytes(`batch_tx_${i}`))
    );
    
    // Calculate total USDT needed for batch
    let totalUsdtNeeded = 0n;
    for (const gas of gasAmounts) {
        const usdt = await carbonOffset.getUsdtAmountForOffset(gas, emissionRate, charRate);
        totalUsdtNeeded += usdt;
    }
    
    console.log("Total USDT needed for batch:", ethers.formatUnits(totalUsdtNeeded, 6), "USDT");
    
    // Approve and execute batch offset
    await mockUSDTAsUser1.approve(await carbonOffset.getAddress(), totalUsdtNeeded);
    const batchTx = await carbonOffsetAsUser1.batchOffsetCarbon(gasAmounts, txHashes);
    const batchReceipt = await batchTx.wait();
    
    console.log("Batch offset transaction hash:", batchReceipt.hash);
    console.log("Gas used for batch offset:", batchReceipt.gasUsed.toString());
    
    // Check final balances and offsets
    console.log("\n=== Final Results ===");
    const finalUserTotalOffsets = await carbonOffset.getUserTotalOffsets(user1.address);
    const finalUser1UsdtBalance = await mockUSDT.balanceOf(user1.address);
    
    console.log("User's final total carbon offsets:", ethers.formatUnits(finalUserTotalOffsets, 6), "tonnes CO2");
    console.log("User's final USDT balance:", ethers.formatUnits(finalUser1UsdtBalance, 6), "USDT");
    
    // Test 4: Request-based offsetting
    console.log("\n=== Test 4: Request-Based Offsetting ===");
    const requestGas = 30000;
    const requestTxHash = ethers.keccak256(ethers.toUtf8Bytes("request_tx"));
    
    // Create offset request
    const createRequestTx = await carbonOffsetAsUser1.createOffsetRequest(requestGas, requestTxHash);
    const createRequestReceipt = await createRequestTx.wait();
    
    console.log("Created offset request transaction hash:", createRequestReceipt.hash);
    
    console.log("\n=== Test Complete ===");
    console.log("All tests passed successfully!");
    
    return {
        mockUSDT: await mockUSDT.getAddress(),
        mockCarbonCredit: await mockCarbonCredit.getAddress(),
        carbonOffset: await carbonOffset.getAddress(),
        deployer: deployer.address,
        user1: user1.address
    };
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = main; 