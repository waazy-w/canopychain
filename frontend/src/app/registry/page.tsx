"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { NotDeployedNotice } from "@/components/project/OnChainPanel";
import { ReportStatusBadge } from "@/components/project/ReportView";
import { AddressLink, Badge, Card, ErrorBox, PrototypeBadge, secondaryButtonClass, Spinner, TxLink } from "@/components/ui";
import { api } from "@/lib/api/client";
import { IS_DEPLOYED } from "@/lib/contract";
import { scanRegistryEvents, type RegistryEvent, type ScanProgress } from "@/lib/contract/events";
import { errorMessage, fmtCredits, fmtHa } from "@/lib/format";
import { targetChain } from "@/lib/wagmi";

export default function RegistryPage() {
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Public registry</h1>
        <p className="mt-1 text-sm text-muted">
          Every project, issuance, retirement and reversal. Events are read directly from the CanopyCredits contract.
        </p>
      </div>

      <Card title="Projects">
        {projects.isLoading && <Spinner />}
        {projects.isError && <ErrorBox>{errorMessage(projects.error)}</ErrorBox>}
        {projects.data?.length === 0 && (
          <p className="text-sm text-muted">
            No projects yet. <Link href="/register" className="text-accent underline">Register the first one</Link>.
          </p>
        )}
        {!!projects.data?.length && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Project</th>
                  <th className="py-2 pr-3">Area</th>
                  <th className="py-2 pr-3">Owner</th>
                  <th className="py-2 pr-3">Latest report</th>
                  <th className="py-2">
                    Credits <PrototypeBadge />
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.data.map((p) => (
                  <tr key={p.projectId} className="border-t border-line">
                    <td className="py-2 pr-3 text-muted">{p.projectId}</td>
                    <td className="py-2 pr-3">
                      <Link href={`/projects/${p.projectId}`} className="font-medium text-emerald-300 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{fmtHa(p.areaHa)}</td>
                    <td className="py-2 pr-3">
                      <AddressLink address={p.owner} />
                    </td>
                    <td className="py-2 pr-3">
                      {p.status === "pending" ? (
                        <Badge tone="amber">Pending review</Badge>
                      ) : p.status === "rejected" ? (
                        <Badge tone="red">Rejected</Badge>
                      ) : p.latestReport ? (
                        <ReportStatusBadge status={p.latestReport.status} />
                      ) : (
                        <Badge tone="gray">Not verified</Badge>
                      )}
                    </td>
                    <td className="py-2">{/* Monitoring reports carry no credit estimate; the badge already shows the reversal. */}
                      {p.latestReport && p.latestReport.kind !== "monitoring" && p.latestReport.status !== "reversal_detected"
                        ? fmtCredits(p.latestReport.creditsEstimated)
                        : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <EventFeed />
    </div>
  );
}

function EventFeed() {
  const client = usePublicClient({ chainId: targetChain.id });
  const [scan, setScan] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (!IS_DEPLOYED || !client) return;
    const controller = new AbortController();
    scanRegistryEvents(client, {
      signal: controller.signal,
      onProgress: (p) => {
        if (!controller.signal.aborted) setScan(p);
      },
    }).catch((err) => {
      if (!controller.signal.aborted) setError(errorMessage(err));
    });
    return () => controller.abort();
  }, [client, runId]);

  const refresh = () => {
    setScan(null);
    setError(null);
    setRunId((n) => n + 1);
  };

  if (!IS_DEPLOYED) {
    return (
      <Card title="On-chain activity">
        <NotDeployedNotice />
      </Card>
    );
  }

  const total = scan ? Number(scan.toBlock - scan.fromBlock + 1n) : 0;
  const scanned = scan ? Number(scan.toBlock - scan.scannedFrom + 1n) : 0;

  return (
    <Card
      title={
        <span className="flex flex-wrap items-center justify-between gap-2">
          On-chain activity
          <button type="button" className={`${secondaryButtonClass} !py-1 text-xs`} onClick={refresh}>
            Refresh
          </button>
        </span>
      }
    >
      {error && <ErrorBox>Could not read events: {error}</ErrorBox>}
      {!scan && !error && (
        <p className="text-sm text-muted">
          <Spinner /> Reading events from Amoy…
        </p>
      )}
      {scan && !scan.done && (
        <p className="mb-3 text-xs text-muted">
          <Spinner /> Scanned {scanned.toLocaleString()} of {total.toLocaleString()} blocks…
        </p>
      )}
      {scan?.done && scan.events.length === 0 && <p className="text-sm text-muted">No events yet.</p>}
      {scan && scan.events.length > 0 && (
        <ul className="divide-y divide-line">
          {scan.events.map((e) => (
            <EventRow key={`${e.transactionHash}-${e.logIndex}`} event={e} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function EventRow({ event: e }: { event: RegistryEvent }) {
  const a = e.args as Record<string, bigint | string | number>;
  let tone: "green" | "red" | "amber" | "gray" = "gray";
  let title = "";
  let body: React.ReactNode = null;

  switch (e.eventName) {
    case "ProjectRegistered":
      title = "Project registered";
      body = (
        <>
          <Link href={`/projects/${a.projectId}`} className="text-accent underline">
            Project #{a.projectId.toString()}
          </Link>{" "}
          owned by <AddressLink address={a.owner as string} />
        </>
      );
      break;
    case "CreditsIssued":
      tone = "green";
      title = "Credits issued";
      body = (
        <>
          {fmtCredits(a.credits as bigint)} for{" "}
          <Link href={`/projects/${a.projectId}`} className="text-accent underline">
            project #{a.projectId.toString()}
          </Link>
          , vintage {a.vintage.toString()} ({fmtCredits(a.buffer as bigint)} to the buffer)
          <PrototypeBadge />
        </>
      );
      break;
    case "CreditsRetired":
      tone = "amber";
      title = "Credits retired";
      body = (
        <>
          {fmtCredits(a.amount as bigint)} of token {a.tokenId.toString()} for {(a.beneficiary as string) || "—"} ·{" "}
          <Link href={`/certificates/${a.retirementId}?tx=${e.transactionHash}`} className="text-accent underline">
            certificate #{a.retirementId.toString()}
          </Link>
        </>
      );
      break;
    case "ReversalFlagged":
      tone = "red";
      title = "Reversal flagged";
      body = (
        <>
          <Link href={`/projects/${a.projectId}`} className="text-accent underline">
            Project #{a.projectId.toString()}
          </Link>
          , vintage {a.vintage.toString()}: {fmtCredits(a.lostCredits as bigint)} lost,{" "}
          <strong className="text-red-300">{fmtCredits(a.bufferBurned as bigint)} burned from the buffer</strong>
        </>
      );
      break;
  }

  return (
    <li className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Badge tone={tone}>{title}</Badge> <span className="ml-1 text-body">{body}</span>
      </div>
      <div className="shrink-0 text-xs text-muted">
        block {e.blockNumber.toString()} · <TxLink hash={e.transactionHash} />
      </div>
    </li>
  );
}
