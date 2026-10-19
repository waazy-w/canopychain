"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { usePublicClient, useReadContract } from "wagmi";
import { NotDeployedNotice } from "@/components/project/OnChainPanel";
import { AddressLink, ErrorBox, PrototypeBadge, secondaryButtonClass, Spinner, TxLink } from "@/components/ui";
import { api } from "@/lib/api/client";
import { canopyCreditsAbi, CONTRACT_ADDRESS, IS_DEPLOYED, splitTokenId } from "@/lib/contract";
import { scanRegistryEvents } from "@/lib/contract/events";
import { errorMessage, fmtCredits, fmtDate } from "@/lib/format";
import { amoy } from "@/lib/wagmi";

export default function CertificatePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Certificate />
    </Suspense>
  );
}

function Certificate() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const txFromUrl = searchParams.get("tx");
  const valid = /^\d+$/.test(params.id) && BigInt(params.id) > 0n;
  const retirementId = valid ? BigInt(params.id) : 0n;
  const publicClient = usePublicClient({ chainId: amoy.id });

  const retirement = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: canopyCreditsAbi,
    chainId: amoy.id,
    functionName: "getRetirement",
    args: [retirementId],
    query: { enabled: IS_DEPLOYED && valid, retry: false },
  });
  const r = retirement.data;
  const token = r ? splitTokenId(r.tokenId) : undefined;

  const project = useQuery({
    queryKey: ["project", Number(token?.projectId ?? 0)],
    queryFn: () => api.getProject(Number(token!.projectId)),
    enabled: !!token,
    retry: false,
  });

  // The tx hash comes from the retire flow's redirect; otherwise look it up from the event log.
  const txLookup = useQuery({
    queryKey: ["retirement-tx", retirementId.toString()],
    queryFn: async () => {
      const res = await scanRegistryEvents(publicClient!, {
        retirementId,
        stopWhen: (events) => events.length > 0,
      });
      return res.events[0]?.transactionHash ?? null;
    },
    enabled: !!r && !txFromUrl && !!publicClient,
    staleTime: Infinity,
    retry: false,
  });
  const txHash = txFromUrl ?? txLookup.data ?? null;

  if (!IS_DEPLOYED) return <NotDeployedNotice />;
  if (!valid) return <ErrorBox>Invalid certificate id.</ErrorBox>;
  if (retirement.isLoading) {
    return (
      <p className="text-stone-600">
        <Spinner /> Reading the certificate from the contract…
      </p>
    );
  }
  if (!r) {
    return <ErrorBox>Retirement #{params.id} was not found on-chain. {errorMessage(retirement.error)}</ErrorBox>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <article className="relative overflow-hidden rounded-2xl border-4 border-double border-forest-700 bg-white p-8 shadow-sm sm:p-12">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 text-[180px] leading-none opacity-[0.06]">
          🌳
        </div>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-forest-600">CanopyChain</p>
        <h1 className="mt-2 text-center text-3xl font-bold text-forest-900">Certificate of Retirement</h1>
        <p className="mt-1 text-center text-sm text-stone-500">Retirement #{retirementId.toString()} · recorded on Polygon Amoy</p>

        <p className="mt-8 text-center text-lg text-stone-700">This certifies that</p>
        <p className="mt-1 text-center text-4xl font-bold text-forest-800">
          {fmtCredits(r.amount)}
          <PrototypeBadge />
        </p>
        <p className="mt-1 text-center text-lg text-stone-700">were permanently retired on behalf of</p>
        <p className="mt-1 text-center text-2xl font-semibold text-stone-900">{r.beneficiary || "—"}</p>
        {r.reason && <p className="mt-2 text-center italic text-stone-600">&ldquo;{r.reason}&rdquo;</p>}

        <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-3 border-t border-stone-200 pt-6 text-sm sm:grid-cols-2">
          <Row label="Project">
            {project.data ? (
              <Link href={`/projects/${token!.projectId}`} className="text-forest-700 underline">
                {project.data.name}
              </Link>
            ) : (
              `#${token!.projectId}`
            )}
          </Row>
          <Row label="Vintage">{token!.vintage}</Row>
          <Row label="Token id">
            <span className="font-mono">{r.tokenId.toString()}</span>
          </Row>
          <Row label="Retired at">{fmtDate(r.retiredAt)}</Row>
          <Row label="Retired by">
            <AddressLink address={r.by} />
          </Row>
          <Row label="Transaction">
            {txHash ? <TxLink hash={txHash} /> : txLookup.isFetching ? <Spinner /> : "—"}
          </Row>
          <Row label="Contract">{CONTRACT_ADDRESS && <AddressLink address={CONTRACT_ADDRESS} />}</Row>
        </dl>

        <p className="mt-8 text-center text-xs text-stone-500">
          Retired credits are burned and can never be transferred or counted again. Carbon figures are a prototype
          estimate (canopychain-prototype-v0), not a certified methodology. Testnet only.
        </p>
      </article>
      <div className="no-print flex justify-center gap-2">
        <button type="button" className={secondaryButtonClass} onClick={() => window.print()}>
          Print / save as PDF
        </button>
        <Link href="/registry" className={secondaryButtonClass}>
          Back to registry
        </Link>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 sm:block">
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="text-stone-900">{children}</dd>
    </div>
  );
}
