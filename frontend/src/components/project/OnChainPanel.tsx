"use client";

import { IS_DEPLOYED, PROJECT_STATUS_LABEL, ProjectStatus } from "@/lib/contract";
import { useOnChainProject, type VintageOnChain } from "@/lib/contract/hooks";
import { fmtCredits, fmtDate } from "@/lib/format";
import { AddressLink, Badge, Card, Notice, PrototypeBadge, Spinner, Stat } from "../ui";

export function NotDeployedNotice() {
  return (
    <Notice>
      <strong>Contract not deployed yet.</strong> On-chain status, balances and retirement appear once CanopyCredits is
      deployed to Amoy and <code>shared/contracts.json</code> is filled in.
    </Notice>
  );
}

export function OnChainPanel({
  project,
  rows,
  loadingRows,
}: {
  project: ReturnType<typeof useOnChainProject>;
  rows: VintageOnChain[];
  loadingRows: boolean;
}) {
  if (!IS_DEPLOYED) {
    return (
      <Card title="On-chain status">
        <NotDeployedNotice />
      </Card>
    );
  }
  const p = project.data;
  const reversed = p?.status === ProjectStatus.Reversed;
  const issued = rows.filter((r) => r.issuance);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          On-chain status
          {project.isLoading ? (
            <Spinner />
          ) : p ? (
            <Badge tone={reversed ? "red" : "green"}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
          ) : (
            <Badge tone="gray">Not registered</Badge>
          )}
        </span>
      }
    >
      {!p && !project.isLoading && (
        <p className="text-sm text-muted">This project hasn&apos;t been registered on-chain yet.</p>
      )}
      {p && (
        <>
          {reversed && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <strong>Reversal flagged.</strong> Satellite monitoring found forest loss. {fmtCredits(p.totalBufferBurned)}{" "}
              were cancelled from the buffer pool and no new credits can be issued for this project.
            </div>
          )}
          <dl className="grid grid-cols-2 gap-4">
            <Stat label="Total issued" value={fmtCredits(p.totalIssued)} badge />
            <Stat
              label="Buffer burned"
              value={<span className={reversed ? "text-red-300" : ""}>{fmtCredits(p.totalBufferBurned)}</span>}
            />
            <Stat label="Owner" value={<AddressLink address={p.owner} />} />
            <Stat label="Registered" value={<span className="text-sm">{fmtDate(p.registeredAt)}</span>} />
          </dl>
        </>
      )}

      {loadingRows && <p className="mt-4 text-sm text-muted"><Spinner /> Loading vintages…</p>}
      {issued.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="py-1 pr-3">Vintage</th>
                <th className="py-1 pr-3">Token id</th>
                <th className="py-1 pr-3">Issued <PrototypeBadge /></th>
                <th className="py-1 pr-3">Buffer left</th>
                <th className="py-1">In circulation</th>
              </tr>
            </thead>
            <tbody>
              {issued.map((r) => (
                <tr key={r.vintage} className="border-t border-line">
                  <td className="py-1.5 pr-3 font-medium">{r.vintage}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.tokenId.toString()}</td>
                  <td className="py-1.5 pr-3">{fmtCredits(r.issuance!.credits)}</td>
                  <td className="py-1.5 pr-3">
                    {r.bufferBalance !== undefined ? fmtCredits(r.bufferBalance) : "—"}
                    <span className="text-xs text-subtle"> / {r.issuance!.buffer.toString()}</span>
                  </td>
                  <td className="py-1.5">{r.totalSupply !== undefined ? fmtCredits(r.totalSupply) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
