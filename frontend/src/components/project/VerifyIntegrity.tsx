"use client";

import { useState, type ReactNode } from "react";
import { parseEventLogs } from "viem";
import { usePublicClient } from "wagmi";
import type { VerificationReport } from "@/lib/api/types";
import { isMockMode } from "@/lib/api/mode";
import { API_URL } from "@/lib/config";
import { CONTRACT_ADDRESS, canopyCreditsAbi, tokenIdFor } from "@/lib/contract";
import { errorMessage } from "@/lib/format";
import { computeReportHash } from "@/lib/reportHash";
import { targetChain } from "@/lib/wagmi";
import { Spinner, TxLink, secondaryButtonClass, shortHex } from "../ui";

type Outcome = "ok" | "fail" | "skip";
interface Step {
  label: string;
  outcome: Outcome;
  detail: ReactNode;
}
interface Result {
  steps: Step[];
  verdict: { tone: "green" | "red" | "amber"; text: string };
}

const ICON: Record<Outcome, string> = { ok: "✓", fail: "✗", skip: "–" };
const ICON_STYLE: Record<Outcome, string> = {
  ok: "bg-forest-100 text-forest-800",
  fail: "bg-red-100 text-red-800",
  skip: "bg-stone-100 text-stone-500",
};
const VERDICT_STYLE = {
  green: "border-forest-200 bg-forest-50 text-forest-900",
  red: "border-red-200 bg-red-50 text-red-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
} as const;

/**
 * Independently checks a report: fetch the raw JSON, re-hash it in the browser, and compare with the
 * hash the oracle wrote on-chain (getIssuance for verifications, the ReversalFlagged event for reversals).
 */
export function VerifyIntegrity({ report }: { report: VerificationReport }) {
  const client = usePublicClient({ chainId: targetChain.id });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      setResult(await check(report, client));
    } catch (err) {
      setResult({ steps: [], verdict: { tone: "red", text: `Check failed: ${errorMessage(err)}` } });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-stone-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-forest-900">Verify report integrity</p>
          <p className="text-xs text-stone-500">Re-hash this report in your browser and compare it with the blockchain.</p>
        </div>
        <button type="button" onClick={run} disabled={running} className={secondaryButtonClass}>
          {running ? (
            <>
              <Spinner /> Checking…
            </>
          ) : result ? (
            "Check again"
          ) : (
            "Verify this report"
          )}
        </button>
      </div>

      {result && (
        <div className="mt-4 space-y-3">
          <ol className="space-y-2">
            {result.steps.map((s) => (
              <li key={s.label} className="flex gap-3 text-sm">
                <span
                  aria-hidden
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ICON_STYLE[s.outcome]}`}
                >
                  {ICON[s.outcome]}
                </span>
                <span>
                  <span className="font-medium text-stone-800">{s.label}</span>
                  <span className="block break-all text-xs text-stone-600">{s.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className={`rounded-md border px-3 py-2 text-sm font-medium ${VERDICT_STYLE[result.verdict.tone]}`}>
            {result.verdict.text}
          </p>
          <details className="text-xs text-stone-600">
            <summary className="cursor-pointer select-none">Check it yourself</summary>
            <p className="mt-2">
              Fetch <span className="font-mono">{API_URL}/api/reports/{report.reportId}</span>, drop{" "}
              <span className="font-mono">reportHash, txHash, onChainError, lostCredits</span>, sort keys recursively,{" "}
              <span className="font-mono">JSON.stringify</span> with no spacing, then keccak256 the UTF-8 bytes. Compare with{" "}
              <span className="font-mono">getIssuance(projectId × 10000 + vintage).reportHash</span> or the{" "}
              <span className="font-mono">ReversalFlagged</span> event on Polygonscan.
            </p>
          </details>
        </div>
      )}
    </div>
  );
}

type Client = ReturnType<typeof usePublicClient>;

async function check(report: VerificationReport, client: Client): Promise<Result> {
  const steps: Step[] = [];

  // 1. Fetch the raw report as stored by the backend (or the in-memory mock).
  let raw: Record<string, unknown>;
  if (isMockMode()) {
    raw = report as unknown as Record<string, unknown>;
    steps.push({ label: "Loaded report", outcome: "ok", detail: "From mock data (backend offline)." });
  } else {
    const url = `${API_URL}/api/reports/${report.reportId}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`could not fetch ${url} (${res.status})`);
    raw = await res.json();
    steps.push({ label: "Fetched raw report", outcome: "ok", detail: url });
  }

  // 2. Recompute the canonical hash locally and compare with the hash the report claims.
  const computed = computeReportHash(raw);
  const claimed = String(raw.reportHash ?? "");
  const selfConsistent = computed.toLowerCase() === claimed.toLowerCase();
  steps.push({
    label: selfConsistent ? "Recomputed hash matches the report" : "Recomputed hash does NOT match the report",
    outcome: selfConsistent ? "ok" : "fail",
    detail: `keccak256 in your browser: ${computed}${selfConsistent ? "" : ` · report claims ${claimed}`}`,
  });
  if (!selfConsistent) {
    return { steps, verdict: { tone: "red", text: "This report was changed after it was hashed." } };
  }

  // 3. Read the attested hash from the chain.
  const onChain = await readAttestation(report, client);
  if (onChain.hash === undefined) {
    steps.push({ label: "On-chain attestation", outcome: "skip", detail: onChain.note });
    return {
      steps,
      verdict: { tone: "amber", text: `The report is intact, but there is no on-chain attestation to compare with: ${onChain.note}` },
    };
  }
  const matches = onChain.hash.toLowerCase() === computed.toLowerCase();
  steps.push({
    label: matches ? "Matches the on-chain attestation" : "Does NOT match the on-chain attestation",
    outcome: matches ? "ok" : "fail",
    detail: (
      <>
        {onChain.source}: {shortHex(onChain.hash, 10)}
        {onChain.txHash && (
          <>
            {" "}
            · <TxLink hash={onChain.txHash} />
          </>
        )}
      </>
    ),
  });
  return matches
    ? { steps, verdict: { tone: "green", text: "Verified: this is exactly the report the oracle attested on-chain." } }
    : { steps, verdict: { tone: "red", text: "Mismatch: this report is not the one attested on-chain." } };
}

async function readAttestation(
  report: VerificationReport,
  client: Client,
): Promise<{ hash?: `0x${string}`; source?: string; txHash?: string; note?: string }> {
  if (isMockMode()) return { note: "mock mode, nothing was sent on-chain." };
  const address = CONTRACT_ADDRESS;
  if (!address || !client) return { note: "the contract is not deployed yet." };

  const isMonitoring = report.kind === "monitoring" || report.status === "reversal_detected";
  if (isMonitoring) {
    if (report.status !== "reversal_detected") {
      return { note: "this re-check found no new loss, so nothing was written on-chain." };
    }
    if (!report.txHash) return { note: report.onChainError ?? "the reversal was not sent on-chain." };
    // The tx hash comes from the backend, but the event is read from the chain and must be emitted
    // by our contract for this project.
    const receipt = await client.getTransactionReceipt({ hash: report.txHash as `0x${string}` });
    const event = parseEventLogs({ abi: canopyCreditsAbi, eventName: "ReversalFlagged", logs: receipt.logs }).find(
      (e) => e.address.toLowerCase() === address.toLowerCase() && e.args.projectId === BigInt(report.projectId),
    );
    if (!event) return { note: "no ReversalFlagged event for this project in the reported transaction." };
    return { hash: event.args.reportHash, source: "ReversalFlagged event", txHash: report.txHash };
  }

  try {
    const issuance = await client.readContract({
      address,
      abi: canopyCreditsAbi,
      functionName: "getIssuance",
      args: [tokenIdFor(report.projectId, report.vintage)],
    });
    return { hash: issuance.reportHash, source: `getIssuance (vintage ${report.vintage})`, txHash: report.txHash ?? undefined };
  } catch {
    return { note: report.onChainError ?? `vintage ${report.vintage} has not been issued on-chain.` };
  }
}
