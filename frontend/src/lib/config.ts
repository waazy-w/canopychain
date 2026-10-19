// Public runtime config. NEXT_PUBLIC_* values are inlined at build time; all have working defaults.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

/** NEXT_PUBLIC_CHAIN=local runs against a Hardhat node (chain 31337) instead of Polygon Amoy, for development. */
export const IS_LOCAL_CHAIN = process.env.NEXT_PUBLIC_CHAIN === "local";
export const RPC_URL = IS_LOCAL_CHAIN
  ? process.env.NEXT_PUBLIC_LOCAL_RPC_URL || "http://127.0.0.1:8545"
  : process.env.NEXT_PUBLIC_AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com";

/** Block explorer base URL; empty on the local chain, where there is none. */
export const EXPLORER_URL = IS_LOCAL_CHAIN ? "" : "https://amoy.polygonscan.com";
export const METHODOLOGY_NOTE = "Prototype estimate (canopychain-prototype-v0), NOT a certified carbon methodology.";

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;
