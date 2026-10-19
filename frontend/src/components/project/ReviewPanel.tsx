"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { api } from "@/lib/api/client";
import type { ProjectDetail } from "@/lib/api/types";
import { nowIso, reviewMessage, type ReviewDecision } from "@/lib/auth";
import { errorMessage, fmtDate } from "@/lib/format";
import { AddressLink, Badge, buttonClass, Card, dangerButtonClass, ErrorBox, inputClass, Spinner, TxLink } from "../ui";

const DEFAULT_LOSS_RATE_PCT = 2.1;
const DEFAULT_TCO2E_PER_HA = 450;

/** Review status of a project, and the approve/reject form for approvers (the CanopyCredits admin). */
export function ReviewPanel({ project }: { project: ProjectDetail }) {
  const status = project.status ?? "active";
  const review = project.review;

  if (status === "pending") return <PendingReview project={project} />;
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Project review
          {status === "rejected" ? <Badge tone="red">Rejected</Badge> : <Badge tone="green">Approved</Badge>}
        </span>
      }
    >
      {review ? (
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
          <Field label={review.decision === "reject" ? "Rejected by" : "Approved by"}>
            <AddressLink address={review.reviewer} />
          </Field>
          <Field label="Reviewed">{fmtDate(review.reviewedAt)}</Field>
          <Field label="Baseline loss rate">{review.regionalBaselineLossRatePct}% / yr</Field>
          <Field label="tCO2e per hectare">{review.tco2ePerHa}</Field>
          {review.note && (
            <div className="sm:col-span-4">
              <dt className="text-xs uppercase tracking-wide text-muted">Note</dt>
              <dd className="mt-0.5 text-body">&ldquo;{review.note}&rdquo;</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-muted">
          Approved before signed reviews were introduced; it uses the default methodology inputs (
          {DEFAULT_LOSS_RATE_PCT}% / yr, {DEFAULT_TCO2E_PER_HA} tCO2e/ha).
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        {[
          project.ownerSignature && "Registration signed by the owner wallet.",
          review?.signature && review.signature !== "0x" && "Review signed by the approver's wallet.",
          "Methodology inputs are fixed at review and can't be changed by whoever runs the verification.",
        ]
          .filter(Boolean)
          .join(" ")}
      </p>
    </Card>
  );
}

function PendingReview({ project }: { project: ProjectDetail }) {
  const { address } = useAccount();
  const approver = useQuery({
    queryKey: ["approver", address],
    queryFn: () => api.isApprover(address!),
    enabled: !!address,
  });

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Project review <Badge tone="amber">Pending</Badge>
        </span>
      }
    >
      <p className="text-sm text-muted">
        New projects stay off-chain until an approver (the CanopyCredits contract admin) checks the land documents and
        signs off. Approval fixes the methodology inputs and registers the project on-chain; only then can it be verified
        and earn credits.
      </p>
      {approver.data?.isApprover ? (
        <ReviewForm projectId={project.projectId} />
      ) : (
        <p className="mt-3 text-xs text-subtle">
          {address
            ? approver.isLoading
              ? "Checking whether this wallet is an approver…"
              : "The connected wallet is not an approver."
            : "Approvers: connect the admin wallet to review."}
        </p>
      )}
    </Card>
  );
}

function ReviewForm({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();
  const [lossRate, setLossRate] = useState(String(DEFAULT_LOSS_RATE_PCT));
  const [tco2e, setTco2e] = useState(String(DEFAULT_TCO2E_PER_HA));
  const [note, setNote] = useState("");

  const lossNum = Number(lossRate);
  const tco2eNum = Number(tco2e);
  const invalid =
    !(lossNum >= 0 && lossNum <= 10) ? "Loss rate must be 0–10% per year." : !(tco2eNum >= 10 && tco2eNum <= 1000) ? "tCO2e per hectare must be 10–1000." : null;

  const submit = useMutation({
    mutationFn: async (decision: ReviewDecision) => {
      const issuedAt = nowIso();
      const signature = await signMessageAsync({
        message: reviewMessage(projectId, decision, lossNum, tco2eNum, note, issuedAt),
      });
      return api.reviewProject(projectId, {
        decision,
        regionalBaselineLossRatePct: lossNum,
        tco2ePerHa: tco2eNum,
        note: note.trim(),
        issuedAt,
        signature,
      });
    },
    onSettled: () => queryClient.invalidateQueries(),
  });

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-line bg-canvas p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">You are an approver</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-body">Regional baseline loss rate (% / yr)</span>
          <input className={`${inputClass} mt-1`} inputMode="decimal" value={lossRate} onChange={(e) => setLossRate(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-body">tCO2e per hectare</span>
          <input className={`${inputClass} mt-1`} inputMode="decimal" value={tco2e} onChange={(e) => setTco2e(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="text-body">Note (optional)</span>
          <input
            className={`${inputClass} mt-1`}
            value={note}
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. title deed checked"
          />
        </label>
      </div>
      {invalid && <p className="text-xs text-red-300">{invalid}</p>}
      {submit.isError && <ErrorBox>{errorMessage(submit.error)}</ErrorBox>}
      {submit.data?.txHash && (
        <p className="text-sm text-body">
          Registered on-chain: <TxLink hash={submit.data.txHash} />
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={!!invalid || submit.isPending} onClick={() => submit.mutate("approve")}>
          {submit.isPending && submit.variables === "approve" ? (
            <>
              <Spinner /> Signing…
            </>
          ) : (
            "Sign & approve"
          )}
        </button>
        <button type="button" className={dangerButtonClass} disabled={!!invalid || submit.isPending} onClick={() => submit.mutate("reject")}>
          {submit.isPending && submit.variables === "reject" ? "Signing…" : "Reject"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
