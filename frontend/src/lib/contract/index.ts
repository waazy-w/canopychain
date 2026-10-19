import { getAddress, isAddress, type Address } from "viem";
import deployment from "@/generated/contracts.json";

export { canopyCreditsAbi } from "./abi";

const rawAddress = deployment.address;

/** CanopyCredits address on Amoy, or undefined until the contract is deployed. */
export const CONTRACT_ADDRESS: Address | undefined =
  rawAddress && isAddress(rawAddress) ? getAddress(rawAddress) : undefined;
export const IS_DEPLOYED = CONTRACT_ADDRESS !== undefined;
export const DEPLOY_BLOCK = BigInt(deployment.deployBlock || 0);

export const TOKEN_ID_MULTIPLIER = 10_000n;

export const ProjectStatus = { None: 0, Active: 1, Reversed: 2 } as const;
export const PROJECT_STATUS_LABEL = ["Not registered", "Active", "Reversed"] as const;

export function tokenIdFor(projectId: number | bigint, vintage: number): bigint {
  return BigInt(projectId) * TOKEN_ID_MULTIPLIER + BigInt(vintage);
}

export function splitTokenId(tokenId: bigint): { projectId: bigint; vintage: number } {
  return { projectId: tokenId / TOKEN_ID_MULTIPLIER, vintage: Number(tokenId % TOKEN_ID_MULTIPLIER) };
}
