import "dotenv/config";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const AMOY_RPC_URL = process.env.AMOY_RPC_URL ?? "https://polygon-amoy-bor-rpc.publicnode.com";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    amoy: {
      url: AMOY_RPC_URL,
      chainId: 80002,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      // Amoy's fee estimate often suggests 400+ gwei on near-empty blocks; 35 gwei clears its 25 gwei minimum.
      gasPrice: 35_000_000_000,
    },
  },
  // Etherscan API V2: one etherscan.io key verifies on every chain, Polygon Amoy included.
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY ?? "",
  },
  sourcify: { enabled: false },
};

export default config;
