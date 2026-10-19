"use client";

import { useEffect, useState } from "react";
import { Spinner } from "../ui";

const STAGES: [number, string][] = [
  [0, "Searching Sentinel-2 L2A scenes on Planetary Computer…"],
  [8, "Applying the cloud mask…"],
  [20, "Computing NDVI for the baseline and current scenes…"],
  [45, "Measuring forest cover and deforestation…"],
  [70, "Estimating tCO2e and hashing the report…"],
  [90, "Submitting the attestation on-chain…"],
];

/** Elapsed-time progress for the slow (30–120 s) verification pipeline. */
export function PipelineProgress({ startedAt, label }: { startedAt: number; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const stage = [...STAGES].reverse().find(([s]) => elapsed >= s)![1];
  const pct = Math.min(95, Math.round((elapsed / 120) * 100));
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/10 p-4 text-sm" role="status" aria-live="polite">
      <div className="flex items-center gap-2 font-medium text-ink">
        <Spinner /> {label} · {elapsed}s
      </div>
      <p className="mt-1 text-muted">{stage}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-accent/15">
        <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">Satellite verification usually takes 30–120 seconds.</p>
    </div>
  );
}
