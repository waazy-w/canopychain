"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { useMockMode } from "@/lib/api/mode";
import { API_URL } from "@/lib/config";
import { amoy } from "@/lib/wagmi";

/** Mock-data and wrong-network banners shown under the header on every page. */
export function StatusBanners() {
  const mock = useMockMode();
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== amoy.id;

  if (!mock && !wrongNetwork) return null;
  return (
    <div className="no-print">
      {mock && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          <strong>Mock data</strong>: the backend at <code>{API_URL}</code> isn&apos;t reachable, so projects and
          reports are demo data. Nothing you do here is sent on-chain.
        </div>
      )}
      {wrongNetwork && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-red-100 px-4 py-2 text-sm text-red-900">
          Your wallet is on the wrong network. CanopyChain runs on Polygon Amoy.
          <button
            type="button"
            onClick={() => switchChain({ chainId: amoy.id })}
            disabled={isPending}
            className="rounded-md bg-red-700 px-3 py-1 font-medium text-white hover:bg-red-800 disabled:opacity-60"
          >
            {isPending ? "Switching…" : "Switch to Amoy"}
          </button>
        </div>
      )}
    </div>
  );
}
