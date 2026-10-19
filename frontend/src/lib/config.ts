// Public runtime config. NEXT_PUBLIC_* values are inlined at build time; all have working defaults.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
export const AMOY_RPC_URL = process.env.NEXT_PUBLIC_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export const EXPLORER_URL = "https://amoy.polygonscan.com";
export const METHODOLOGY_NOTE = "Prototype estimate (canopychain-prototype-v0), NOT a certified carbon methodology.";

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;
