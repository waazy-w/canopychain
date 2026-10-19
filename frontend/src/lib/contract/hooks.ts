"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { amoy } from "../wagmi";
import { canopyCreditsAbi } from "./abi";
import { CONTRACT_ADDRESS, IS_DEPLOYED, tokenIdFor } from "./index";

const base = { address: CONTRACT_ADDRESS, abi: canopyCreditsAbi, chainId: amoy.id } as const;

/** On-chain project record. `data` is undefined (with isError) when the project isn't registered. */
export function useOnChainProject(projectId: number | undefined) {
  return useReadContract({
    ...base,
    functionName: "getProject",
    args: [BigInt(projectId ?? 0)],
    query: { enabled: IS_DEPLOYED && projectId !== undefined, retry: false },
  });
}

export interface VintageOnChain {
  vintage: number;
  tokenId: bigint;
  issuance?: {
    credits: bigint;
    buffer: bigint;
    reportHash: `0x${string}`;
    reportURI: string;
    issuedAt: bigint;
  };
  bufferBalance?: bigint;
  totalSupply?: bigint;
  walletBalance?: bigint;
}

/** Issuance, buffer, supply and the connected wallet's balance for each vintage of a project. */
export function useVintagesOnChain(projectId: number | undefined, vintages: number[]) {
  const { address } = useAccount();
  const tokenIds = projectId === undefined ? [] : vintages.map((v) => tokenIdFor(projectId, v));
  const contracts = tokenIds.flatMap((tokenId) => [
    { ...base, functionName: "getIssuance", args: [tokenId] } as const,
    { ...base, functionName: "bufferBalance", args: [tokenId] } as const,
    { ...base, functionName: "totalSupply", args: [tokenId] } as const,
    {
      ...base,
      functionName: "balanceOf",
      args: [address ?? "0x0000000000000000000000000000000000000000", tokenId],
    } as const,
  ]);
  const query = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: IS_DEPLOYED && tokenIds.length > 0 },
  });

  const rows: VintageOnChain[] = vintages.map((vintage, i) => {
    const [iss, buf, sup, bal] = (query.data ?? []).slice(i * 4, i * 4 + 4);
    return {
      vintage,
      tokenId: tokenIds[i],
      issuance: iss?.status === "success" ? (iss.result as VintageOnChain["issuance"]) : undefined,
      bufferBalance: buf?.status === "success" ? (buf.result as bigint) : undefined,
      totalSupply: sup?.status === "success" ? (sup.result as bigint) : undefined,
      walletBalance: address && bal?.status === "success" ? (bal.result as bigint) : undefined,
    };
  });
  return { ...query, rows };
}
