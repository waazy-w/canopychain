// Copies the deployed contract info from ../shared/contracts.json into src/generated/contracts.json.
// With NEXT_PUBLIC_CHAIN=local it reads ../contracts/deployments/local.json (from `npm run deploy:local`).
// The ABI falls back to the Hardhat artifact when shared/contracts.json has none yet (before the Amoy deploy).
// Runs automatically before `npm run dev` and `npm run build`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root); // same .env files Next.js reads
const isLocal = process.env.NEXT_PUBLIC_CHAIN === "local";
const sharedFile = isLocal
  ? path.resolve(root, "../contracts/deployments/local.json")
  : path.resolve(root, "../shared/contracts.json");
const artifactFile = path.resolve(root, "../contracts/artifacts/contracts/CanopyCredits.sol/CanopyCredits.json");
const outFile = path.resolve(root, "src/generated/contracts.json");

// Names the frontend's hand-typed ABI (src/lib/contract/abi.ts) relies on.
const REQUIRED = [
  "getProject",
  "getIssuance",
  "getRetirement",
  "tokenIdFor",
  "bufferBalance",
  "retirementCount",
  "balanceOf",
  "totalSupply",
  "retire",
  "ProjectRegistered",
  "CreditsIssued",
  "CreditsRetired",
  "ReversalFlagged",
];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

const shared = readJson(sharedFile) ?? {};
const entry = shared.CanopyCredits ?? {};
let abi = Array.isArray(entry.abi) ? entry.abi : [];
let abiSource = isLocal ? "contracts/deployments/local.json" : "shared/contracts.json";
if (abi.length === 0) {
  const artifact = readJson(artifactFile);
  abi = artifact?.abi ?? [];
  abiSource = abi.length ? "contracts/artifacts" : "none";
}

const out = {
  chainId: shared.chainId ?? (isLocal ? 31337 : 80002),
  address: entry.address ?? "",
  deployBlock: entry.deployBlock ?? 0,
  deployTx: entry.deployTx ?? "",
  abiSource,
  abi,
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n");

const names = new Set(abi.map((e) => e.name));
const missing = abi.length ? REQUIRED.filter((n) => !names.has(n)) : [];
console.log(
  `[sync-contracts] chain=${isLocal ? "local" : "amoy"} address=${out.address || "(not deployed)"} deployBlock=${out.deployBlock} abi=${abiSource}`,
);
if (missing.length) {
  console.warn(`[sync-contracts] WARNING: deployed ABI is missing ${missing.join(", ")}. Update src/lib/contract/abi.ts.`);
}
