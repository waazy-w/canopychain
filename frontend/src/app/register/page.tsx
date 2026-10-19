"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { DrawMap } from "@/components/maps";
import { buttonClass, Card, ErrorBox, inputClass, shortHex, Spinner } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { GeoJSONPolygon } from "@/lib/api/types";
import { nowIso, registrationMessage } from "@/lib/auth";
import { errorMessage, fmtHa } from "@/lib/format";
import { polygonAreaHa } from "@/lib/geo";

const MAX_AREA_HA = 100_000;

const NEXT_STEPS = [
  "You sign the registration with your wallet, proving you control the owner address.",
  "An approver checks the land documents and fixes the methodology inputs.",
  "Once approved, the project is registered on-chain and can be verified by satellite.",
];

export default function RegisterPage() {
  const router = useRouter();
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { signMessageAsync } = useSignMessage();
  const [name, setName] = useState("");
  const [polygon, setPolygon] = useState<GeoJSONPolygon | null>(null);
  const areaHa = polygon ? polygonAreaHa(polygon) : 0;

  const onPolygon = useCallback((p: GeoJSONPolygon | null) => setPolygon(p), []);

  const register = useMutation({
    mutationFn: async () => {
      const issuedAt = nowIso();
      const trimmed = name.trim();
      const signature = await signMessageAsync({ message: registrationMessage(trimmed, address!, polygon!, issuedAt) });
      return api.registerProject({ name: trimmed, owner: address!, polygon: polygon!, issuedAt, signature });
    },
    onSuccess: ({ projectId }) => router.push(`/projects/${projectId}`),
  });

  const problems = [
    !address && "Connect the wallet that owns the forest.",
    !name.trim() && "Give the project a name.",
    !polygon && "Draw the forest boundary on the map.",
    areaHa > MAX_AREA_HA && `Keep the area under ${fmtHa(MAX_AREA_HA)} so verification stays fast.`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Register a forest project</h1>
        <p className="mt-1 text-sm text-muted">
          Use the polygon or rectangle tool (top left of the map) to outline the forest. Drawing again replaces the shape.
          Boundaries that overlap an existing project are refused, so each forest can only be claimed once.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="h-[460px] overflow-hidden rounded-xl border border-line lg:h-[560px]">
          <DrawMap onChange={onPolygon} />
        </div>

        <Card title="Project details">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (problems.length === 0) register.mutate();
            }}
          >
            <label className="block text-sm">
              <span className="font-medium text-body">Name</span>
              <input
                className={`${inputClass} mt-1`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mata Atlântica Restoration Block"
                maxLength={120}
              />
            </label>
            <div className="text-sm">
              <span className="font-medium text-body">Owner wallet</span>
              {address ? (
                <p className="mt-1 rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink" title={address}>
                  {shortHex(address, 8)}
                </p>
              ) : (
                <button type="button" onClick={openConnectModal} className={`${buttonClass} mt-1 w-full`}>
                  Connect wallet
                </button>
              )}
              <span className="mt-1 block text-xs text-muted">Credits are minted to the wallet that signs.</span>
            </div>
            <div className="rounded-lg bg-accent/10 px-3 py-2 text-sm">
              <span className="text-muted">Area: </span>
              <strong className="text-ink">{polygon ? fmtHa(areaHa) : "draw a polygon"}</strong>
            </div>

            {problems.length > 0 && (
              <ul className="list-inside list-disc text-xs text-muted">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {register.isError && <ErrorBox>{errorMessage(register.error)}</ErrorBox>}

            <button type="submit" className={`${buttonClass} w-full`} disabled={problems.length > 0 || register.isPending}>
              {register.isPending ? (
                <>
                  <Spinner /> Waiting for signature…
                </>
              ) : (
                "Sign & register"
              )}
            </button>

            <ol className="space-y-1.5 border-t border-line pt-4 text-xs text-muted">
              {NEXT_STEPS.map((step, i) => (
                <li key={step} className="flex gap-2">
                  <span className="font-mono text-accent">{String(i + 1).padStart(2, "0")}</span>
                  {step}
                </li>
              ))}
            </ol>
          </form>
        </Card>
      </div>
    </div>
  );
}
