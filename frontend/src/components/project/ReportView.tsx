"use client";

import { resolveAssetUrl } from "@/lib/api/client";
import type { VerificationReport } from "@/lib/api/types";
import { fmtCredits, fmtDate, fmtHa, fmtNum } from "@/lib/format";
import { Badge, Card, Stat, TxLink, shortHex } from "../ui";
import { VerifyIntegrity } from "./VerifyIntegrity";

export function ReportStatusBadge({ status }: { status: VerificationReport["status"] }) {
  if (status === "verified") return <Badge tone="green">Verified</Badge>;
  if (status === "reversal_detected") return <Badge tone="red">Reversal detected</Badge>;
  return <Badge tone="gray">Failed</Badge>;
}

export function ReportView({ report }: { report: VerificationReport }) {
  const reversal = report.status === "reversal_detected";
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          Report <span className="font-mono text-sm font-normal text-stone-500">{report.reportId}</span>
          <ReportStatusBadge status={report.status} />
        </span>
      }
    >
      <p className="text-xs text-stone-500">
        Vintage {report.vintage} · created {fmtDate(report.createdAt)} · {report.imagery.source}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Preview label={`Baseline · ${report.baseline.date}`} src={resolveAssetUrl(report.imagery.previewBaselineUrl)} />
        <Preview label={`Current · ${report.current.date}`} src={resolveAssetUrl(report.imagery.previewCurrentUrl)} />
      </div>
      <p className="mt-2 text-xs text-stone-500">NDVI: brown = bare ground, green = dense canopy.</p>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Project area" value={fmtHa(report.areaHa)} />
        <Stat label="Baseline forest" value={fmtHa(report.baseline.forestCoverHa)} />
        <Stat label="Current forest" value={fmtHa(report.current.forestCoverHa)} />
        <Stat label="Mean NDVI" value={`${report.baseline.meanNdvi.toFixed(2)} → ${report.current.meanNdvi.toFixed(2)}`} />
        <Stat label="Deforested" value={<span className={reversal ? "text-red-700" : ""}>{fmtHa(report.deforestedHa)}</span>} />
        <Stat label="Avoided loss" value={fmtHa(report.avoidedLossHa)} />
        <Stat label="Regional loss rate" value={`${fmtNum(report.regionalBaselineLossRatePct)}%/yr`} />
        <Stat label="tCO2e per ha" value={fmtNum(report.tco2ePerHa)} badge />
        {reversal ? (
          <Stat label="Lost credits" value={<span className="text-red-700">{fmtCredits(report.lostCredits ?? 0)}</span>} badge />
        ) : (
          <Stat label="Credits estimated" value={fmtCredits(report.creditsEstimated)} badge />
        )}
      </dl>

      <div className="mt-5 space-y-1 border-t border-stone-100 pt-4 text-xs text-stone-600">
        <p>
          Report hash: <span className="font-mono">{shortHex(report.reportHash, 10)}</span>
        </p>
        {report.txHash && (
          <p>
            Transaction: <TxLink hash={report.txHash} />
          </p>
        )}
        <p>Methodology: {report.methodology}</p>
      </div>
      <VerifyIntegrity key={report.reportId} report={report} />
    </Card>
  );
}

function Preview({ label, src }: { label: string; src: string }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
      <img src={src} alt={`NDVI preview, ${label}`} className="aspect-square w-full object-cover" />
      <figcaption className="px-3 py-1.5 text-xs text-stone-600">{label}</figcaption>
    </figure>
  );
}
