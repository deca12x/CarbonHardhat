import hre from "hardhat";
import {
    parseUnits,
    PublicClient,
    WalletClient,
    Account,
    Chain,
    Transport,
    Hex,
    createWalletClient,
    http,
    formatUnits,
    erc20Abi,
    stringToHex,
    Abi
} from "viem";
import { privateKeyToAccount } from 'viem/accounts';
import { flare } from 'viem/chains';

// Custom ABI for FdcHub
const fdcHubAbi = [{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"},{"internalType":"address","name":"_addressUpdater","type":"address"},{"internalType":"uint8","name":"_requestsOffsetSeconds","type":"uint8"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes","name":"data","type":"bytes"},{"indexed":false,"internalType":"uint256","name":"fee","type":"uint256"}],"name":"AttestationRequest","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"authorizedAmountWei","type":"uint256"}],"name":"DailyAuthorizedInflationSet","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"encodedCall","type":"bytes"}],"name":"GovernanceCallTimelocked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"initialGovernance","type":"address"}],"name":"GovernanceInitialised","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"governanceSettings","type":"address"}],"name":"GovernedProductionModeEntered","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"amountReceivedWei","type":"uint256"}],"name":"InflationReceived","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"components":[{"internalType":"bytes32","name":"attestationType","type":"bytes32"},{"internalType":"bytes32","name":"source","type":"bytes32"},{"internalType":"uint24","name":"inflationShare","type":"uint24"},{"internalType":"uint8","name":"minRequestsThreshold","type":"uint8"},{"internalType":"uint224","name":"mode","type":"uint224"}],"indexed":false,"internalType":"struct IFdcInflationConfigurations.FdcConfiguration[]","name":"fdcConfigurations","type":"tuple[]"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"InflationRewardsOffered","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint8","name":"requestsOffsetSeconds","type":"uint8"}],"name":"RequestsOffsetSet","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallCanceled","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallExecuted","type":"event"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"cancelGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"dailyAuthorizedInflation","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"executeGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"fdcInflationConfigurations","outputs":[{"internalType":"contract IFdcInflationConfigurations","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"fdcRequestFeeConfigurations","outputs":[{"internalType":"contract IFdcRequestFeeConfigurations","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"flareSystemsManager","outputs":[{"internalType":"contract IIFlareSystemsManager","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAddressUpdater","outputs":[{"internalType":"address","name":"_addressUpdater","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getContractName","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getExpectedBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getInflationAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTokenPoolSupplyData","outputs":[{"internalType":"uint256","name":"_lockedFundsWei","type":"uint256"},{"internalType":"uint256","name":"_totalInflationAuthorizedWei","type":"uint256"},{"internalType":"uint256","name":"_totalClaimedWei","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governance","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governanceSettings","outputs":[{"internalType":"contract IGovernanceSettings","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"}],"name":"initialise","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"isExecutor","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastInflationAuthorizationReceivedTs","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastInflationReceivedTs","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"productionMode","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"receiveInflation","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"requestAttestation","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[],"name":"requestsOffsetSeconds","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardManager","outputs":[{"internalType":"contract IIRewardManager","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_toAuthorizeWei","type":"uint256"}],"name":"setDailyAuthorizedInflation","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint8","name":"_requestsOffsetSeconds","type":"uint8"}],"name":"setRequestsOffset","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"switchToProductionMode","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"selector","type":"bytes4"}],"name":"timelockedCalls","outputs":[{"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"internalType":"bytes","name":"encodedCall","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalInflationAuthorizedWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalInflationReceivedWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalInflationRewardsOfferedWei","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_currentRewardEpochId","type":"uint24"},{"internalType":"uint64","name":"_currentRewardEpochExpectedEndTs","type":"uint64"},{"internalType":"uint64","name":"_rewardEpochDurationSeconds","type":"uint64"}],"name":"triggerRewardEpochSwitchover","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32[]","name":"_contractNameHashes","type":"bytes32[]"},{"internalType":"address[]","name":"_contractAddresses","type":"address[]"}],"name":"updateContractAddresses","outputs":[],"stateMutability":"nonpayable","type":"function"}] as const;

// Carbon data interface for the Gist
interface CarbonData {
    recipientAddress: string;
    recipientGas: number;
    rate: number;
}

// FDC Configuration (kept for future use with other attestation types)
const MAINNET_FDC_VERIFIER_URL = "https://fdc-verifiers-mainnet.flare.network";
const MAINNET_FDC_DA_LAYER_URL = "https://attestation.flare.network";
const MAINNET_FDC_HUB_ADDRESS: Hex = "0xc25c749DC27Efb1864Cb3DADa8845B7687eB2d44";

// Your Gist URL for carbon data
const GIST_RAW_URL = "https://gist.githubusercontent.com/deca12x/cf2ee6f50ce263010dbcf51e048b1bb2/raw/gasEmissions.json";

// --- Helper Function: Fetch Carbon Data Directly (Mocked for 0.001 USDT) ---
async function fetchCarbonDataDirect(gistUrl: string): Promise<CarbonData> {
    console.log("Fetching carbon data directly from:", gistUrl);
    
    // Mock data to result in 0.001 USDT
    // 0.001 USDT = 1000 gas units * 0.000001 rate
    const mockCarbonData: CarbonData = {
        recipientAddress: "0xRecipientAddress1",
        recipientGas: 1000,
        rate: 0.000001 // This will result in 0.001 USDT
    };
    
    console.log("Using mocked carbon data for 0.001 USDT:", mockCarbonData);
    return mockCarbonData;
}

// --- Helper Function: Calculate USDT Amount ---
function calculateUsdtAmount(gasUnits: number, rate: number): bigint {
    // Calculate USDT amount: gasUnits * rate
    // Convert to USDT units (6 decimals)
    const usdtAmount = gasUnits * rate;
    return parseUnits(usdtAmount.toString(), 6);
}

async function main() {
    console.log("🚀 Starting Carbon Offset and Bridge Process...");

    // Setup clients and accounts
    const publicClient = await hre.viem.getPublicClient();
    const [deployerAccount] = await hre.viem.getWalletClients();
    const account = deployerAccount.account;

    console.log("Deployer account:", account.address);
    console.log("Network:", hre.network.name);

    // LayerZero Configuration
    const flareUsdtAddress: Hex = "0x0B38e83B86d491735fEaa0a791F65c2B99535396"; // OFT address
    const flareUsdtOFTAddress: Hex = "0x0B38e83B86d491735fEaa0a791F65c2B99535396"; // Same as USDT
    const polygonComposerContractAddress: Hex = "0x7eFEED1898E127AEe75abbC29Da082ACF136ff81";
    const carbonOffsetFlareContractAddress: Hex = "0xceca34b92dbbaf1715de564172c61a4782248ccd";

    // Get contract instance
    const carbonOffsetContract = await hre.viem.getContractAt(
        "CarbonOffsetFlare",
        carbonOffsetFlareContractAddress
    );

    try {
        // Step 1: Fetch carbon data directly (no FDC needed)
        console.log("\n📊 Step 1: Fetching carbon data...");
        const carbonData = await fetchCarbonDataDirect(GIST_RAW_URL);
        
        // Step 2: Calculate USDT amount needed
        console.log("\n💰 Step 2: Calculating USDT amount...");
        const gasUnits = carbonData.recipientGas;
        const rate = carbonData.rate;
        const usdtAmount = calculateUsdtAmount(gasUnits, rate);
        
        console.log(`Gas units: ${gasUnits}`);
        console.log(`Rate: ${rate}`);
        console.log(`Required USDT amount: ${formatUnits(usdtAmount, 6)} USDT`);

        // Step 3: Check USDT balance
        console.log("\n💳 Step 3: Checking USDT balance...");
        const usdtBalance = await publicClient.readContract({
            address: flareUsdtAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [account.address],
        });
        
        console.log(`Current USDT balance: ${formatUnits(usdtBalance, 6)} USDT`);
        console.log(`Required USDT amount: ${formatUnits(usdtAmount, 6)} USDT`);
        
        if (usdtBalance < usdtAmount) {
            throw new Error(`Insufficient USDT balance. Need ${formatUnits(usdtAmount, 6)} USDT, have ${formatUnits(usdtBalance, 6)} USDT`);
        }
        console.log("✅ Sufficient USDT balance available");

        // Step 4: Transfer USDT to the contract
        console.log("\n📤 Step 4: Transferring USDT to contract...");
        console.log(`Transferring ${formatUnits(usdtAmount, 6)} USDT to contract...`);
        
        const { request: transferRequest } = await publicClient.simulateContract({
            address: flareUsdtAddress,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [carbonOffsetFlareContractAddress, usdtAmount],
            account: account,
        });

        const transferTxHash = await deployerAccount.writeContract(transferRequest);
        console.log("USDT transfer transaction sent:", transferTxHash);
        
        const transferReceipt = await publicClient.waitForTransactionReceipt({ hash: transferTxHash });
        if (transferReceipt.status !== 'success') {
            throw new Error(`USDT transfer failed: ${transferTxHash}`);
        }
        console.log("✅ USDT transfer confirmed!");

        // Step 5: Estimate LayerZero fees
        console.log("\n🌉 Step 5: Estimating LayerZero fees...");
        const lzFees = await carbonOffsetContract.read.getFeeForBridgeAndExecute([
            usdtAmount,
            account.address, // flareInitiator
            account.address, // finalEoaRecipientOnPolygon
            0n, // minOutputOrOtherParam
            200000n // composeGasLimit
        ]);
        
        const [nativeFee, lzTokenFee] = lzFees;
        console.log(`LayerZero native fee: ${formatUnits(nativeFee, 18)} FLR`);
        console.log(`LayerZero token fee: ${formatUnits(lzTokenFee, 18)} LZ`);

        // Check FLR balance for LayerZero fees
        const flrBalance = await publicClient.getBalance({ address: account.address });
        console.log(`Current FLR balance: ${formatUnits(flrBalance, 18)} FLR`);
        
        if (flrBalance < nativeFee) {
            throw new Error(`Insufficient FLR balance for LayerZero fees. Need: ${formatUnits(nativeFee, 18)} FLR, Have: ${formatUnits(flrBalance, 18)} FLR`);
        }
        console.log("✅ Sufficient FLR balance for LayerZero fees");

        // Step 6: Verify contract received USDT
        console.log("\n🏦 Step 6: Verifying contract received USDT...");
        const contractUsdtBalance = await publicClient.readContract({
            address: flareUsdtAddress,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [carbonOffsetFlareContractAddress],
        });
        
        console.log(`Contract USDT balance: ${formatUnits(contractUsdtBalance, 6)} USDT`);
        
        if (contractUsdtBalance < usdtAmount) {
            throw new Error(`Contract has insufficient USDT balance. Expected: ${formatUnits(usdtAmount, 6)} USDT, Got: ${formatUnits(contractUsdtBalance, 6)} USDT`);
        }
        console.log("✅ Contract has sufficient USDT balance");

        // Step 7: Execute bridgeAndExecuteOnPolygon
        console.log("\n🚀 Step 7: Executing bridgeAndExecuteOnPolygon...");
        
        const { request: bridgeRequest } = await publicClient.simulateContract({
            address: carbonOffsetFlareContractAddress,
            abi: carbonOffsetContract.abi,
            functionName: 'bridgeAndExecuteOnPolygon',
            args: [
                usdtAmount,
                account.address, // finalEoaRecipientOnPolygon
                0n, // minOutputOrOtherParam
                200000n // composeGasLimit
            ],
            account: account,
            value: nativeFee, // Pay the LayerZero fee
        });

        const bridgeTxHash = await deployerAccount.writeContract(bridgeRequest);
        console.log("Carbon offset and bridge transaction sent:", bridgeTxHash);
        
        const bridgeReceipt = await publicClient.waitForTransactionReceipt({ hash: bridgeTxHash });
        if (bridgeReceipt.status !== 'success') {
            throw new Error(`Carbon offset and bridge failed: ${bridgeTxHash}`);
        }

        console.log("\n🎉 SUCCESS! Carbon offset and bridge completed!");
        console.log("Transaction Details:");
        console.log(`- Transfer TX: ${transferTxHash}`);
        console.log(`- Bridge TX: ${bridgeTxHash}`);
        console.log(`- Block number: ${bridgeReceipt.blockNumber}`);
        console.log(`- Gas used: ${bridgeReceipt.gasUsed}`);
        console.log(`- USDT amount bridged: ${formatUnits(usdtAmount, 6)} USDT`);
        console.log(`- LayerZero fee paid: ${formatUnits(nativeFee, 18)} FLR`);
        console.log(`- Carbon offset: ${gasUnits} gas units at rate ${rate}`);

    } catch (error) {
        console.error("❌ Error in main process:", error);
        throw error;
    }
}

// Execute the main function
main()
    .then(() => {
        console.log("✅ Script completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("💥 Script failed:", error);
        process.exit(1);
    });
