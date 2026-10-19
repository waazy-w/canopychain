import { keccak256, toBytes } from "viem";

// Canonical report hashing, identical to the backend (docs/api.md "Report hashing"):
// drop the fields added after hashing, sort object keys recursively, JSON.stringify with no
// spacing, UTF-8 encode, keccak256.

/** Fields the backend adds after hashing (transaction results), plus the hash itself. */
export const UNHASHED_FIELDS = ["reportHash", "txHash", "onChainError", "lostCredits"] as const;

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function canonicalReportJson(report: object): string {
  const body = Object.fromEntries(
    Object.entries(report).filter(([k]) => !(UNHASHED_FIELDS as readonly string[]).includes(k)),
  );
  return JSON.stringify(sortKeys(body));
}

export function computeReportHash(report: object): `0x${string}` {
  return keccak256(toBytes(canonicalReportJson(report)));
}
