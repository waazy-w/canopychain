"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { MonitorResponse, VerifyResponse } from "@/lib/api/types";
import { errorMessage, fmtCredits } from "@/lib/format";
import { buttonClass, Card, dangerButtonClass, ErrorBox, secondaryButtonClass, TxLink } from "../ui";
import { PipelineProgress } from "./PipelineProgress";

type Result = { kind: "verify"; data: VerifyResponse } | { kind: "monitor"; data: MonitorResponse };

export function VerifyActions({
  projectId,
  hasVerifiedReport,
  verifyBlockedReason,
}: {
  projectId: number;
  hasVerifiedReport: boolean;
  /** Set when the backend would refuse a new verification (vintage already verified, or project reversed). */
  verifyBlockedReason: string | null;
}) {
  const queryClient = useQueryClient();
  const [startedAt, setStartedAt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const refresh = () => queryClient.invalidateQueries();

  const verify = useMutation({
    mutationFn: () => api.verify(projectId),
    onSuccess: (data) => setResult({ kind: "verify", data }),
    onSettled: refresh,
  });
  const monitor = useMutation({
    mutationFn: (simulate: boolean) => api.monitor(projectId, simulate),
    onSuccess: (data) => setResult({ kind: "monitor", data }),
    onSettled: refresh,
  });
  const busy = verify.isPending || monitor.isPending;
  const error = verify.error ?? monitor.error;

  const start = (fn: () => void) => {
    setResult(null);
    verify.reset();
    monitor.reset();
    setStartedAt(Date.now());
    fn();
  };

  return (
    <Card title="Verification & monitoring">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={busy || verifyBlockedReason !== null}
          onClick={() => start(() => verify.mutate())}
          title={verifyBlockedReason ?? undefined}
        >
          Run verification
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={busy || !hasVerifiedReport}
          onClick={() => start(() => monitor.mutate(false))}
          title={hasVerifiedReport ? undefined : "Verify the project first"}
        >
          Re-check forest
        </button>
        <button
          type="button"
          className={dangerButtonClass}
          disabled={busy || !hasVerifiedReport}
          onClick={() => start(() => monitor.mutate(true))}
          title={hasVerifiedReport ? "Demo: pretend part of the forest was cleared" : "Verify the project first"}
        >
          Simulate deforestation
        </button>
      </div>
      {verifyBlockedReason && <p className="mt-2 text-sm text-muted">{verifyBlockedReason}</p>}
      <p className="mt-2 text-xs text-muted">
        &quot;Simulate deforestation&quot; is a demo control: the backend injects forest loss into the current scene and
        the oracle flags a reversal on-chain.
      </p>

      <div className="mt-4 space-y-3">
        {busy && (
          <PipelineProgress startedAt={startedAt} label={verify.isPending ? "Verifying" : "Monitoring"} />
        )}
        {error && <ErrorBox>{errorMessage(error)}</ErrorBox>}
        {result && <ResultSummary result={result} />}
      </div>
    </Card>
  );
}

function ResultSummary({ result }: { result: Result }) {
  const { data } = result;
  const reversal = data.status === "reversal_detected";
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        reversal ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-accent/30 bg-accent/10 text-ink"
      }`}
    >
      {result.kind === "verify" && data.status === "verified" && (
        <p>
          <strong>Verified.</strong> {fmtCredits(data.creditsEstimated)} estimated for vintage {data.vintage} (prototype
          estimate).
        </p>
      )}
      {result.kind === "monitor" &&
        (reversal ? (
          <p>
            <strong>Reversal detected.</strong> {fmtCredits(result.data.lostCredits)} lost; the oracle flags it on-chain
            and cancels buffer credits.
          </p>
        ) : (
          <p>
            <strong>No new forest loss found.</strong>
          </p>
        ))}
      {data.status === "failed" && <p>Verification failed. See the report for details.</p>}
      {data.txHash && (
        <p className="mt-1">
          On-chain transaction: <TxLink hash={data.txHash} />
        </p>
      )}
      {data.onChainError && <p className="mt-1 text-xs opacity-80">On-chain: {data.onChainError}</p>}
    </div>
  );
}
