"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ProjectMap } from "@/components/maps";
import { OnChainPanel } from "@/components/project/OnChainPanel";
import { ReportStatusBadge, ReportView } from "@/components/project/ReportView";
import { RetirePanel } from "@/components/project/RetirePanel";
import { VerifyActions } from "@/components/project/VerifyActions";
import { AddressLink, Badge, Card, ErrorBox, Notice, Spinner } from "@/components/ui";
import { ApiError } from "@/lib/api/errors";
import { api } from "@/lib/api/client";
import { ProjectStatus } from "@/lib/contract";
import { useOnChainProject, useVintagesOnChain } from "@/lib/contract/hooks";
import { errorMessage, fmtCredits, fmtDate, fmtHa } from "@/lib/format";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const validId = Number.isInteger(projectId) && projectId > 0;

  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId),
    enabled: validId,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
  const project = projectQuery.data;
  const vintages = [...new Set((project?.reports ?? []).map((r) => r.vintage))].sort((a, b) => b - a);

  const onChainProject = useOnChainProject(validId ? projectId : undefined);
  const vintagesOnChain = useVintagesOnChain(validId ? projectId : undefined, vintages);

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  if (!validId) return <ErrorBox>Invalid project id.</ErrorBox>;
  if (projectQuery.isLoading) {
    return (
      <p className="text-stone-600">
        <Spinner /> Loading project…
      </p>
    );
  }
  if (projectQuery.isError || !project) {
    return <ErrorBox>Could not load project {projectId}: {errorMessage(projectQuery.error)}</ErrorBox>;
  }

  const report = project.reports.find((r) => r.reportId === selectedReportId) ?? project.reports[0];
  const reversed =
    onChainProject.data?.status === ProjectStatus.Reversed || project.latestReport?.status === "reversal_detected";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">
            <Link href="/registry" className="hover:underline">
              Registry
            </Link>{" "}
            / Project #{project.projectId}
          </p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold text-forest-900">
            {project.name}
            {reversed ? <Badge tone="red">Reversal flagged</Badge> : report ? <ReportStatusBadge status={report.status} /> : <Badge tone="gray">Not verified</Badge>}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {fmtHa(project.areaHa)} · owner <AddressLink address={project.owner} /> · registered {fmtDate(project.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="h-[360px] overflow-hidden rounded-xl border border-stone-200 lg:h-full lg:min-h-[360px]">
          <ProjectMap polygon={project.polygon} reversed={reversed} />
        </div>
        <OnChainPanel project={onChainProject} rows={vintagesOnChain.rows} loadingRows={vintagesOnChain.isLoading} />
      </div>

      <VerifyActions projectId={project.projectId} hasVerifiedReport={project.reports.some((r) => r.status === "verified")} />

      {report ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <ReportView report={report} />
          <div className="space-y-6">
            <RetirePanel rows={vintagesOnChain.rows} />
            <Card title="Report history">
              <ul className="space-y-1 text-sm">
                {project.reports.map((r) => (
                  <li key={r.reportId}>
                    <button
                      type="button"
                      onClick={() => setSelectedReportId(r.reportId)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-stone-50 ${
                        r.reportId === report.reportId ? "bg-forest-50" : ""
                      }`}
                    >
                      <span>
                        <span className="block text-xs text-stone-500">{fmtDate(r.createdAt)}</span>
                        {r.status === "reversal_detected"
                          ? `Lost ${fmtCredits(r.lostCredits ?? 0)}`
                          : `${fmtCredits(r.creditsEstimated)} · ${r.vintage}`}
                      </span>
                      <ReportStatusBadge status={r.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      ) : (
        <Notice>No verification reports yet. Run a verification to measure the forest and estimate credits.</Notice>
      )}
    </div>
  );
}
