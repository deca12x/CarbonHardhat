import hre from "hardhat";
import { parseUnits, PublicClient, WalletClient, Account, Chain, Transport, Hex, createWalletClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from 'viem/accounts';
import { flare } from 'viem/chains';
import carbonOffsetFlareArtifact from "../artifacts/contracts/CarbonOffsetFlare.sol/CarbonOffsetFlare.json";
import { 
    FLARE_USDT_ADDRESS, 
    FLARE_USDT_OFT_ADDRESS, 
    POLYGON_COMPOSER_CONTRACT_ADDRESS 
} from "./config/constants";

async function main() {
    const networkName = hre.network.name;
    console.log("🚀 Deploying CarbonOffsetFlare contract on network:", networkName);

    let walletClient: WalletClient<Transport, Chain, Account>;
    let deployerAccount: Account;
    const publicClient: PublicClient<Transport, Chain> = await hre.viem.getPublicClient();
    let transportUrl: string;

    // Setup wallet client based on network
    if (networkName === "hardhat" || networkName === "localhost") {
        const [localDeployerWalletClient] = await hre.viem.getWalletClients();
        deployerAccount = localDeployerWalletClient.account;
        walletClient = localDeployerWalletClient;
    } else if (process.env.PRIVATE_KEY) {
        deployerAccount = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
        const networkConfig = hre.config.networks[networkName];
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
        throw new Error("PRIVATE_KEY not found in .env file for live network deployment or local setup issue.");
    }

    console.log("📝 Deploying with account:", deployerAccount.address);
    const balance = await publicClient.getBalance({ address: deployerAccount.address });
    console.log("💰 Account FLR balance:", formatUnits(balance, 18));

    // Deployment configuration
    console.log("\n📋 Deployment Configuration:");
    console.log("   USDT Token Address:", FLARE_USDT_ADDRESS);
    console.log("   USDT OFT Address:", FLARE_USDT_OFT_ADDRESS);
    console.log("   Polygon Composer Address:", POLYGON_COMPOSER_CONTRACT_ADDRESS);

    // Deploy the contract
    console.log("\n🔨 Deploying CarbonOffsetFlare contract...");
    const deployHash = await walletClient.deployContract({
        abi: carbonOffsetFlareArtifact.abi,
        bytecode: carbonOffsetFlareArtifact.bytecode as Hex,
        account: deployerAccount,
        args: [
            FLARE_USDT_OFT_ADDRESS,
            FLARE_USDT_ADDRESS,
            POLYGON_COMPOSER_CONTRACT_ADDRESS
        ],
    });

    console.log("📤 Deployment transaction sent, hash:", deployHash);
    const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    const carbonOffsetFlareContractAddress = deployReceipt.contractAddress;

    if (!carbonOffsetFlareContractAddress) {
        throw new Error("❌ CarbonOffsetFlare contract address not found after deployment.");
    }

    console.log("\n✅ CarbonOffsetFlare contract deployed successfully!");
    console.log("📍 Contract Address:", carbonOffsetFlareContractAddress);
    console.log("⛽ Gas Used:", deployReceipt.gasUsed.toString());
    console.log("🔗 Transaction Hash:", deployHash);

    // Provide next steps
    console.log("\n📋 NEXT STEPS:");
    console.log("1. Update CARBON_OFFSET_FLARE_CONTRACT_ADDRESS in scripts/config/constants.ts");
    console.log(`   Replace: "0xYOUR_CARBON_OFFSET_FLARE_CONTRACT_ADDRESS"`);
    console.log(`   With: "${carbonOffsetFlareContractAddress}"`);
    console.log("\n2. Test the deployment with:");
    console.log("   npx hardhat run scripts/deployAndBridge.ts --network flare");

    // Optional: Verify contract if on mainnet and API key is available
    if (networkName !== "hardhat" && networkName !== "localhost" && process.env.FLARESCAN_API_KEY) {
        console.log("\n🔍 Contract verification can be done with:");
        console.log(`   npx hardhat verify --network ${networkName} ${carbonOffsetFlareContractAddress} "${FLARE_USDT_OFT_ADDRESS}" "${FLARE_USDT_ADDRESS}" "${POLYGON_COMPOSER_CONTRACT_ADDRESS}"`);
    }

    return carbonOffsetFlareContractAddress;
}

main()
    .then((contractAddress) => {
        console.log("\n🎉 Deployment completed successfully!");
        console.log("📍 Contract Address:", contractAddress);
        process.exit(0);
    })
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    }); 