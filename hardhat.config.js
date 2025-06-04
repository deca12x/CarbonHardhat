require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.ETHEREUM_RPC_URL || "",
      },
    },
    coston2: {
      url: "https://coston2-api.flare.network/ext/C/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 114,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com/",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137,
    },
    // Polkadot Paseo testnet configuration
    paseo: {
      url: "https://paseo.rpc.dwellir.com", // Paseo testnet RPC
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1000, // Paseo chain ID
      gasPrice: "auto",
      gas: "auto",
    },
    // Alternative Polkadot EVM endpoints
    moonbase: {
      url: "https://rpc.api.moonbase.moonbeam.network",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1287, // Moonbase Alpha testnet
      gasPrice: "auto",
      gas: "auto",
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      paseo: "placeholder", // Paseo doesn't have etherscan-like verification yet
      moonbase: process.env.MOONSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "paseo",
        chainId: 1000,
        urls: {
          apiURL: "https://paseo.api.subscan.io/api/v2/scan/evm/contract",
          browserURL: "https://paseo.subscan.io"
        }
      }
    ]
  },
}; 