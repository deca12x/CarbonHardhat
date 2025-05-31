import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "dotenv/config"; // Import dotenv configuration

const FLARE_RPC_URL = process.env.FLARE_RPC_URL || "https://flare-api.flare.network/ext/C/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "your_default_private_key"; // Fallback, but ensure it's set in .env

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28", // User's specified version
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // Configuration for local testing network
    },
    flare: {
      url: FLARE_RPC_URL,
      accounts: PRIVATE_KEY !== "your_default_private_key" ? [PRIVATE_KEY] : [],
      chainId: 14, // Flare Mainnet
    },
    // You can add other networks like polygon, goerli, etc.
    // polygon: {
    //   url: process.env.POLYGON_RPC_URL || "",
    //   accounts: PRIVATE_KEY !== "your_default_private_key" ? [PRIVATE_KEY] : [],
    //   chainId: 137, // Polygon Mainnet
    // },
  },
  // etherscan: { // Commented out to avoid linting issues, enable if you set up verification
  //   // Add API keys if you want to verify contracts on Etherscan/Blockscout
  //   // apiKey: {
  //   //   flare: process.env.FLARESCAN_API_KEY || "",
  //   //   polygon: process.env.POLYGONSCAN_API_KEY || "",
  //   // },
  // },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};

export default config;
