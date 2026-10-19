"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { useMockMode } from "@/lib/api/mode";
import { API_URL } from "@/lib/config";
import { targetChain } from "@/lib/wagmi";

/** Mock-data and wrong-network banners shown under the header on every page. */
export function StatusBanners() {
  const mock = useMockMode();
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== targetChain.id;

  if (!mock && !wrongNetwork) return null;
  return (
    <div className="no-print">
      {mock && (
        <div className="bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-200">
          <strong>Mock data</strong>: the backend at <code>{API_URL}</code> isn&apos;t reachable, so projects and
          reports are demo data. Nothing you do here is sent on-chain.
        </div>
      )}
      {wrongNetwork && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-red-500/15 px-4 py-2 text-sm text-red-200">
          Your wallet is on the wrong network. CanopyChain runs on {targetChain.name}.
          <button
            type="button"
            onClick={() => switchChain({ chainId: targetChain.id })}
            disabled={isPending}
            className="rounded-md bg-red-500/90 px-3 py-1 font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
          >
            {isPending ? "Switching…" : `Switch to ${targetChain.name}`}
          </button>
        </div>
      )}
    </div>
  );
}
