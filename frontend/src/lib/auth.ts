import { getAddress, keccak256, toBytes } from "viem";
import type { GeoJSONPolygon } from "./api/types";
import { sortKeys } from "./reportHash";

// Messages the wallet signs to register or review a project. They must match backend/app/auth.py
// byte for byte: the backend rebuilds the message from the request and recovers the signer.

/** keccak256 of the polygon as canonical JSON (sorted keys, no spaces). */
export function boundaryHash(polygon: GeoJSONPolygon): `0x${string}` {
  return keccak256(toBytes(JSON.stringify(sortKeys({ type: polygon.type, coordinates: polygon.coordinates }))));
}

/** At most two decimals, no trailing zeros: 2.1 → "2.1", 450 → "450". */
export function fmtNumber(x: number): string {
  return (Math.round(x * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function registrationMessage(name: string, owner: string, polygon: GeoJSONPolygon, issuedAt: string): string {
  return [
    "CanopyChain: register a forest project",
    "",
    `Name: ${name}`,
    `Owner: ${getAddress(owner)}`,
    `Boundary hash: ${boundaryHash(polygon)}`,
    `Issued at: ${issuedAt}`,
  ].join("\n");
}

export type ReviewDecision = "approve" | "reject";

export function reviewMessage(
  projectId: number,
  decision: ReviewDecision,
  lossRatePct: number,
  tco2ePerHa: number,
  note: string,
  issuedAt: string,
): string {
  return [
    "CanopyChain: review a forest project",
    "",
    `Project: #${projectId}`,
    `Decision: ${decision}`,
    `Regional baseline loss rate: ${fmtNumber(lossRatePct)}%`,
    `tCO2e per hectare: ${fmtNumber(tco2ePerHa)}`,
    `Note: ${note.trim()}`,
    `Issued at: ${issuedAt}`,
  ].join("\n");
}
