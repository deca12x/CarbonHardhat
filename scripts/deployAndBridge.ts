import hre from "hardhat";
import { parseUnits, PublicClient, WalletClient, Account, Chain, Transport, Hex, createWalletClient, http, formatUnits, erc20Abi } from "viem";
import { privateKeyToAccount } from 'viem/accounts';
import { flare } from 'viem/chains'; // Import flare chain definition
import minimalBridgeArtifact from "../artifacts/contracts/MinimalFlareUSDTBridge.sol/MinimalFlareUSDTBridge.json"; // Import ABI for the new contract

// Minimal ERC20 ABI for transfer and balanceOf
const usdtAbi = [
  {
    inputs: [{ internalType: "address", name: "caller", type: "address" }],
    name: "OnlyMinter",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "uint8", name: "version", type: "uint8" },
    ],
    name: "Initialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "minter",
        type: "address",
      },
    ],
    name: "MinterAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "minter",
        type: "address",
      },
    ],
    name: "MinterRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [{ internalType: "address", name: "_minter", type: "address" }],
    name: "addMinter",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_account", type: "address" },
      { internalType: "uint256", name: "_value", type: "uint256" },
    ],
    name: "burnFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "subtractedValue", type: "uint256" },
    ],
    name: "decreaseAllowance",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "addedValue", type: "uint256" },
    ],
    name: "increaseAllowance",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "name_", type: "string" },
      { internalType: "string", name: "symbol_", type: "string" },
      { internalType: "uint8", name: "decimals_", type: "uint8" },
    ],
    name: "initialize",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_account", type: "address" },
      { internalType: "uint256", name: "_amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "addr", type: "address" }],
    name: "minters",
    outputs: [{ internalType: "bool", name: "canMint", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "_minter", type: "address" }],
    name: "removeMinter",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const; // Use 'as const' for better ABI typing with Viem

async function main() {
  const networkName = hre.network.name;
  console.log("Operating on network:", networkName);

    let walletClient: WalletClient<Transport, Chain, Account>;
    let deployerAccount: Account;
    const publicClient: PublicClient<Transport, Chain> = await hre.viem.getPublicClient();
    let transportUrl: string;

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

    console.log("Deploying with account:", deployerAccount.address);
    const balance = await publicClient.getBalance({ address: deployerAccount.address });
    console.log("Account FLR balance:", formatUnits(balance, 18));

    // --- CONFIGURATION START ---
    // Flare ERC20 USDT Token address
    const flareUsdtAddress = "0x0B38e83B86d491735fEaa0a791F65c2B99535396" as Hex;
    // CORRECT Flare USDT OFT Contract Address (from your successful transaction)
    const flareUsdtOFTAddress = "0x1C10CC06DC6D35970d1D53B2A23c76ef370d4135" as Hex;
    // Amount of USDT to bridge (in its native 6 decimals)
    const amountUSDTToBridge = parseUnits("0.001", 6); // e.g., 0.001 USDT = 1000 raw units
    // Recipient address on Polygon
    const polygonRecipientAddress: Hex = deployerAccount.address; 
    // --- CONFIGURATION END ---

    console.log(`Attempting to bridge ${formatUnits(amountUSDTToBridge, 6)} USDT (${amountUSDTToBridge.toString()} raw units)`);
    console.log(`   From Flare (Account: ${deployerAccount.address})`);
    console.log(`   To Polygon (Recipient: ${polygonRecipientAddress})`);
    console.log(`   Using USDT OFT Contract on Flare: ${flareUsdtOFTAddress}`);

    console.log("\nDeploying MinimalFlareUSDTBridge contract...");
    const deployHash = await walletClient.deployContract({
        abi: minimalBridgeArtifact.abi,
        bytecode: minimalBridgeArtifact.bytecode as Hex,
        account: deployerAccount,
        args: [flareUsdtOFTAddress, flareUsdtAddress], // Constructor args: (_stargateUsdtOFTAddress, _erc20UsdtTokenAddress)
    });
    console.log("Deployment transaction sent, hash:", deployHash);
    const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    const minimalBridgeContractAddress = deployReceipt.contractAddress;
    if (!minimalBridgeContractAddress) {
        throw new Error("MinimalFlareUSDTBridge contract address not found after deployment.");
    }
    console.log("MinimalFlareUSDTBridge contract deployed to:", minimalBridgeContractAddress);

    console.log(`\nTransferring ${formatUnits(amountUSDTToBridge, 6)} USDT to MinimalFlareUSDTBridge contract...`);
    const deployerUsdtBalanceBefore = await publicClient.readContract({
        address: flareUsdtAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [deployerAccount.address]
    }) as bigint;
    console.log(`   Deployer USDT balance before: ${formatUnits(deployerUsdtBalanceBefore, 6)} USDT`);

    if (deployerUsdtBalanceBefore < amountUSDTToBridge) {
        throw new Error(`Deployer has insufficient USDT. Needs ${formatUnits(amountUSDTToBridge, 6)}, has ${formatUnits(deployerUsdtBalanceBefore, 6)}`);
    }

    const { request: transferRequest } = await publicClient.simulateContract({
        address: flareUsdtAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [minimalBridgeContractAddress, amountUSDTToBridge],
        account: deployerAccount,
    });
    const transferTxHash = await walletClient.writeContract(transferRequest);
    console.log("   USDT transfer transaction sent! Hash:", transferTxHash);
    await publicClient.waitForTransactionReceipt({ hash: transferTxHash });
    console.log("   USDT transfer confirmed!");

    const contractUsdtBalance = await publicClient.readContract({
        address: flareUsdtAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [minimalBridgeContractAddress]
    }) as bigint;
    console.log(`   MinimalFlareUSDTBridge contract USDT balance: ${formatUnits(contractUsdtBalance, 6)} USDT`);
    if (contractUsdtBalance < amountUSDTToBridge) {
        console.warn("   WARNING: Contract might not have enough USDT after transfer, check amounts!");
    }

    const minimalBridgeContract = await hre.viem.getContractAt(
        "MinimalFlareUSDTBridge",
        minimalBridgeContractAddress,
        { client: { wallet: walletClient, public: publicClient } }
    );

    console.log("\nEstimating LayerZero fee for bridging...");
    const [nativeFee, lzTokenFee] = await minimalBridgeContract.read.getFeeEstimate([
        amountUSDTToBridge,
        polygonRecipientAddress
    ]);
    console.log(`   Estimated LZ Native Fee: ${formatUnits(nativeFee, 18)} FLR`);
    console.log(`   Estimated LZ Token Fee (ZRO): ${lzTokenFee.toString()}`);

    if (balance < nativeFee) {
        throw new Error(`Deployer has insufficient FLR for LZ fee. Needs ${formatUnits(nativeFee, 18)}, has ${formatUnits(balance, 18)} FLR`);
    }

    console.log("\nCalling bridgeUSDTToPolygon...");
    const { request: bridgeRequest } = await publicClient.simulateContract({
        address: minimalBridgeContract.address,
        abi: minimalBridgeArtifact.abi,
        functionName: "bridgeUSDTToPolygon",
        args: [amountUSDTToBridge, polygonRecipientAddress],
        account: deployerAccount,
        value: nativeFee, // Pass the estimated native fee as msg.value
    });
    const bridgeTxHash = await walletClient.writeContract(bridgeRequest);

    console.log("   Bridge transaction sent! Hash:", bridgeTxHash);
    await publicClient.waitForTransactionReceipt({ hash: bridgeTxHash });
    console.log("   Bridge transaction confirmed! Visit LayerZeroScan to track message delivery.");

    console.log("\n--- Bridge Initiated --- ");
    console.log(`   LZ Scan: https://layerzeroscan.com/tx/${bridgeTxHash} (Might take a moment to appear)`);
    console.log("   Monitor the LayerZero message from Flare (EID 30295) to Polygon (EID 30109).");
    console.log(`   Recipient ${polygonRecipientAddress} on Polygon should receive USDT.`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Script failed:", error);
        process.exit(1);
    }); 