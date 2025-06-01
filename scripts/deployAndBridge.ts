import hre from "hardhat";
import {
  parseUnits,
  PublicClient,
  WalletClient,
  Account,
  Chain,
  Transport,
  Hex,
  GetContractReturnType,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { flare } from "viem/chains"; // Import flare chain definition
import carbonOffsetArtifact from "../artifacts/contracts/CarbonOffsetFlare.sol/CarbonOffset.json"; // Import ABI directly

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
  const publicClient: PublicClient<Transport, Chain> =
    await hre.viem.getPublicClient();
  let transportUrl: string; // Explicitly type transportUrl as string

  if (networkName === "hardhat" || networkName === "localhost") {
    const [localDeployerWalletClient] = await hre.viem.getWalletClients();
    deployerAccount = localDeployerWalletClient.account;
    walletClient = localDeployerWalletClient;
  } else if (process.env.PRIVATE_KEY) {
    deployerAccount = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
    const networkConfig = hre.config.networks[networkName];
    if (
      networkConfig &&
      "url" in networkConfig &&
      typeof networkConfig.url === "string"
    ) {
      transportUrl = networkConfig.url;
    } else {
      transportUrl = flare.rpcUrls.default.http[0]; // Default to flare's public RPC
    }
    walletClient = createWalletClient({
      account: deployerAccount,
      chain: flare, // Assuming flare network, adjust if networkName implies other viem chains
      transport: http(transportUrl),
    });
  } else {
    throw new Error(
      "PRIVATE_KEY not found in .env file for live network deployment or local setup issue."
    );
  }

  console.log("Deploying contracts with the account:", deployerAccount.address);
  const balance = await publicClient.getBalance({
    address: deployerAccount.address,
  });
  console.log("Account FLR balance:", balance.toString());

  const flareUsdtAddress = "0x0B38e83B86d491735fEaa0a791F65c2B99535396" as Hex;
  const stargateRouterFlare =
    "0x45d417612e177672958dC0537C45a8f8d754Ac2E" as Hex;
  const amountUSDTToBridge = parseUnits("0.001", 6);
  console.log(
    "Attempting to bridge THIS AMOUNT (raw units):",
    amountUSDTToBridge.toString()
  );
  const polygonRecipientAddress: Hex = deployerAccount.address;
  const minCharOutputOnPolygon = BigInt(1);

  console.log("\nDeploying CarbonOffset contract...");
  const deployHash = await walletClient.deployContract({
    abi: carbonOffsetArtifact.abi,
    bytecode: carbonOffsetArtifact.bytecode as Hex,
    account: deployerAccount,
    args: [stargateRouterFlare, flareUsdtAddress],
  });
  console.log("Deployment transaction sent, hash:", deployHash);
  const deployReceipt = await publicClient.waitForTransactionReceipt({
    hash: deployHash,
  });
  const carbonOffsetContractAddress = deployReceipt.contractAddress;
  if (!carbonOffsetContractAddress) {
    throw new Error("Contract address not found after deployment.");
  }
  console.log(
    "CarbonOffset contract deployed to:",
    carbonOffsetContractAddress
  );

  console.log(
    `\nTransferring ${amountUSDTToBridge.toString()} raw units of USDT from deployer to CarbonOffset contract (${carbonOffsetContractAddress})...`
  );

  console.log("Deployer account address:", deployerAccount.address);
  const deployerUsdtBalanceBefore = (await publicClient.readContract({
    address: flareUsdtAddress,
    abi: usdtAbi,
    functionName: "balanceOf",
    args: [deployerAccount.address],
  })) as bigint;
  console.log(
    `Deployer USDT balance before transfer: ${deployerUsdtBalanceBefore.toString()}`
  );

  if (deployerUsdtBalanceBefore < amountUSDTToBridge) {
    throw new Error(
      `Deployer has insufficient USDT. Needs ${amountUSDTToBridge}, has ${deployerUsdtBalanceBefore.toString()}`
    );
  }

  const { request: transferRequest } = await publicClient.simulateContract({
    address: flareUsdtAddress,
    abi: usdtAbi,
    functionName: "transfer",
    args: [carbonOffsetContractAddress, amountUSDTToBridge],
    account: deployerAccount,
  });
  const transferTxHash = await walletClient.writeContract(transferRequest);
  console.log("USDT transfer transaction sent! Hash:", transferTxHash);
  await publicClient.waitForTransactionReceipt({ hash: transferTxHash });
  console.log("USDT transfer confirmed!");

  const contractUsdtBalance = (await publicClient.readContract({
    address: flareUsdtAddress,
    abi: usdtAbi,
    functionName: "balanceOf",
    args: [carbonOffsetContractAddress],
  })) as bigint;
  console.log(
    `CarbonOffset contract USDT balance: ${contractUsdtBalance.toString()}`
  );
  if (contractUsdtBalance < amountUSDTToBridge) {
    console.warn(
      "CarbonOffset contract might not have enough USDT after transfer, check amounts!"
    );
  }

  const carbonOffsetContract = await hre.viem.getContractAt(
    "CarbonOffset",
    carbonOffsetContractAddress,
    { client: { wallet: walletClient, public: publicClient } }
  );

  console.log("\nCalling bridgeAndSwapOnPolygon...");
  console.log(
    `   Amount to bridge: ${amountUSDTToBridge.toString()} (raw units, 6 decimals) USDT`
  );
  console.log(`   Recipient on Polygon: ${polygonRecipientAddress}`);
  console.log(
    `   Min output on Polygon (mocked): ${minCharOutputOnPolygon.toString()}`
  );

  const { request } = await publicClient.simulateContract({
    address: carbonOffsetContract.address, // Use contract instance address
    abi: carbonOffsetArtifact.abi,
    functionName: "bridgeAndSwapOnPolygon",
    args: [amountUSDTToBridge, polygonRecipientAddress, minCharOutputOnPolygon],
    account: deployerAccount,
  });
  const txHash = await walletClient.writeContract(request);

  console.log("Transaction sent! Hash:", txHash);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log("Transaction confirmed!");

  console.log("\n--- Next Steps ---");
  console.log(
    "1. Check your transaction on the Flare Explorer (e.g., FlareScan)."
  );
  console.log(
    "2. Monitor the LayerZero message on LayerZeroScan: https://layerzeroscan.com/"
  );
  console.log(
    "   Look for a message originating from Flare (Source EID 30295) to Polygon (Dest EID 30111)."
  );
  console.log(
    "3. If the message is delivered successfully, check the polygonRecipientAddress on Polygon for the swapped tokens (or USDT if swap failed)."
  );
  console.log(
    "   The TokenSwapComposer contract on Polygon is:",
    "0xCECA34B92DbBAf1715De564172c61A4782248CCD"
  );
  console.log(
    "\nIMPORTANT: The current contract has a modified bridgeAndSwapOnPolygon for debugging quoteOFT."
  );
  console.log(
    "Revert CarbonOffsetFlare.sol to its previous state (with fee handling and require checks) for a full end-to-end test once quoteOFT behavior is understood."
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
