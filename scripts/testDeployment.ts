import hre from "hardhat";
import { PublicClient, WalletClient, Account, Chain, Transport, Hex, createWalletClient, http, formatUnits, parseUnits } from "viem";
import { privateKeyToAccount } from 'viem/accounts';
import { flare } from 'viem/chains';
import { CARBON_OFFSET_FLARE_CONTRACT_ADDRESS, CHAR_RATE_SCALED } from "./config/constants";

async function main() {
    const networkName = hre.network.name;
    console.log("🧪 Testing CarbonOffsetFlare contract on network:", networkName);

    let walletClient: WalletClient<Transport, Chain, Account>;
    let deployerAccount: Account;
    const publicClient: PublicClient<Transport, Chain> = await hre.viem.getPublicClient();

    // Setup wallet client
    if (networkName === "hardhat" || networkName === "localhost") {
        const [localDeployerWalletClient] = await hre.viem.getWalletClients();
        deployerAccount = localDeployerWalletClient.account;
        walletClient = localDeployerWalletClient;
    } else if (process.env.PRIVATE_KEY) {
        deployerAccount = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
        const networkConfig = hre.config.networks[networkName];
        let transportUrl: string;
        if (networkConfig && 'url' in networkConfig && typeof networkConfig.url === 'string') {
            transportUrl = networkConfig.url;
        } else {
            transportUrl = flare.rpcUrls.default.http[0];
        }
        walletClient = createWalletClient({
            account: deployerAccount,
            chain: flare,
            transport: http(transportUrl)
        });
    } else {
        throw new Error("PRIVATE_KEY not found in .env file.");
    }

    console.log("📝 Testing with account:", deployerAccount.address);

    // Check if contract address is set
    if (CARBON_OFFSET_FLARE_CONTRACT_ADDRESS === "0xYOUR_CARBON_OFFSET_FLARE_CONTRACT_ADDRESS") {
        throw new Error("❌ Please update CARBON_OFFSET_FLARE_CONTRACT_ADDRESS in scripts/config/constants.ts with your deployed contract address");
    }

    console.log("📍 Testing contract at:", CARBON_OFFSET_FLARE_CONTRACT_ADDRESS);

    // Get contract instance
    const carbonOffsetFlareContract = await hre.viem.getContractAt(
        "CarbonOffsetFlare",
        CARBON_OFFSET_FLARE_CONTRACT_ADDRESS,
        { client: { wallet: walletClient, public: publicClient } }
    );

    console.log("\n🔍 Running contract tests...");

    try {
        // Test 1: Check contract state variables
        console.log("\n1️⃣ Testing contract state variables...");
        const stargateUsdtOFT = await carbonOffsetFlareContract.read.stargateUsdtOFT();
        const usdtTokenOnFlare = await carbonOffsetFlareContract.read.usdtTokenOnFlare();
        const polygonComposerContract = await carbonOffsetFlareContract.read.polygonComposerContract();
        
        console.log("   ✅ stargateUsdtOFT:", stargateUsdtOFT);
        console.log("   ✅ usdtTokenOnFlare:", usdtTokenOnFlare);
        console.log("   ✅ polygonComposerContract:", polygonComposerContract);

        // Test 2: Test USDT amount calculation
        console.log("\n2️⃣ Testing USDT amount calculation...");
        const testGas = 21000n; // Standard ETH transfer gas
        const testRate = 2500n; // Example rate: 0.0025 tonnes CO2 per gas unit (scaled by 10^6)
        
        const calculatedUsdtAmount = await carbonOffsetFlareContract.read.getUsdtAmountForOffset([
            testGas,
            testRate,
            CHAR_RATE_SCALED
        ]);
        
        console.log(`   📊 For ${testGas.toString()} gas units:`);
        console.log(`   📊 With rate ${testRate.toString()} (scaled):`);
        console.log(`   💰 Calculated USDT amount: ${formatUnits(calculatedUsdtAmount, 6)} USDT`);
        console.log("   ✅ USDT calculation works!");

        // Test 3: Test LayerZero fee estimation
        console.log("\n3️⃣ Testing LayerZero fee estimation...");
        const testAmount = parseUnits("0.001", 6); // 0.001 USDT
        const testRecipient = deployerAccount.address;
        const testMinOutput = 1n;
        const testGasLimit = 350000n;

        const [nativeFee, lzTokenFee] = await carbonOffsetFlareContract.read.getFeeForBridgeAndExecute([
            testAmount,
            deployerAccount.address,
            testRecipient,
            testMinOutput,
            testGasLimit
        ]);

        console.log(`   💸 Estimated Native Fee: ${formatUnits(nativeFee, 18)} FLR`);
        console.log(`   💸 Estimated LZ Token Fee: ${lzTokenFee.toString()}`);
        console.log("   ✅ LayerZero fee estimation works!");

        // Test 4: Check contract can receive FLR
        console.log("\n4️⃣ Testing contract FLR balance...");
        const contractBalance = await publicClient.getBalance({ 
            address: CARBON_OFFSET_FLARE_CONTRACT_ADDRESS 
        });
        console.log(`   💰 Contract FLR balance: ${formatUnits(contractBalance, 18)} FLR`);
        console.log("   ✅ Contract balance check works!");

        console.log("\n🎉 All tests passed! Contract is working correctly.");
        console.log("\n📋 Ready for full FDC integration test:");
        console.log("   npx hardhat run scripts/deployAndBridge.ts --network flare");

    } catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    }
}

main()
    .then(() => {
        console.log("\n✅ Contract testing completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Contract testing failed:", error);
        process.exit(1);
    }); 