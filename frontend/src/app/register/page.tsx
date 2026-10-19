"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { DrawMap } from "@/components/maps";
import { buttonClass, Card, ErrorBox, inputClass, Spinner } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { GeoJSONPolygon } from "@/lib/api/types";
import { errorMessage, fmtHa } from "@/lib/format";
import { polygonAreaHa } from "@/lib/geo";

const MAX_AREA_HA = 100_000;

export default function RegisterPage() {
  const router = useRouter();
  const { address } = useAccount();
  const [name, setName] = useState("");
  const [ownerInput, setOwnerInput] = useState<string | null>(null);
  const [polygon, setPolygon] = useState<GeoJSONPolygon | null>(null);
  const owner = ownerInput ?? address ?? "";
  const areaHa = polygon ? polygonAreaHa(polygon) : 0;

  const onPolygon = useCallback((p: GeoJSONPolygon | null) => setPolygon(p), []);

  const register = useMutation({
    mutationFn: () => api.registerProject({ name: name.trim(), owner, polygon: polygon! }),
    onSuccess: ({ projectId }) => router.push(`/projects/${projectId}`),
  });

  const problems = [
    !name.trim() && "Give the project a name.",
    !isAddress(owner) && "Enter the owner's wallet address (or connect a wallet).",
    !polygon && "Draw the forest boundary on the map.",
    areaHa > MAX_AREA_HA && `Keep the area under ${fmtHa(MAX_AREA_HA)} so verification stays fast.`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Register a forest project</h1>
        <p className="mt-1 text-sm text-muted">
          Use the polygon or rectangle tool (top left of the map) to outline the forest. Drawing again replaces the shape.
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
            <label className="block text-sm">
              <span className="font-medium text-body">Owner wallet</span>
              <input
                className={`${inputClass} mt-1 font-mono text-xs`}
                value={owner}
                onChange={(e) => setOwnerInput(e.target.value)}
                placeholder="0x… (defaults to your connected wallet)"
              />
              <span className="mt-1 block text-xs text-muted">Credits are minted to this address.</span>
            </label>
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
                  <Spinner /> Registering…
                </>
              ) : (
                "Register project"
              )}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
