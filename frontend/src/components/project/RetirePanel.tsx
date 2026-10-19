"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseEventLogs } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { canopyCreditsAbi, CONTRACT_ADDRESS, IS_DEPLOYED } from "@/lib/contract";
import type { VintageOnChain } from "@/lib/contract/hooks";
import { errorMessage, fmtCredits } from "@/lib/format";
import { targetChain } from "@/lib/wagmi";
import { buttonClass, Card, ErrorBox, inputClass, Notice, Spinner, TxLink } from "../ui";
import { NotDeployedNotice } from "./OnChainPanel";

type Stage = "idle" | "signing" | "confirming";

export function RetirePanel({ rows }: { rows: VintageOnChain[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: targetChain.id });
  const { writeContractAsync } = useWriteContract();

  const held = rows.filter((r) => (r.walletBalance ?? 0n) > 0n);
  const [selected, setSelected] = useState<number | null>(null);
  const row = held.find((r) => r.vintage === selected) ?? held[0];
  const [amount, setAmount] = useState("1");
  const [beneficiary, setBeneficiary] = useState("");
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!IS_DEPLOYED) {
    return (
      <Card title="Retire credits">
        <NotDeployedNotice />
      </Card>
    );
  }
  if (!isConnected) {
    return (
      <Card title="Retire credits">
        <p className="mb-3 text-sm text-muted">Connect the wallet that holds credits for this project to retire them.</p>
        <ConnectButton />
      </Card>
    );
  }
  if (held.length === 0 || !row) {
    return (
      <Card title="Retire credits">
        <Notice>Your connected wallet holds no credits for this project.</Notice>
      </Card>
    );
  }

  const balance = row.walletBalance ?? 0n;
  let parsedAmount = 0n;
  try {
    parsedAmount = /^\d+$/.test(amount) ? BigInt(amount) : 0n;
  } catch {
    parsedAmount = 0n;
  }
  const wrongNetwork = chainId !== targetChain.id;
  const invalid = parsedAmount <= 0n || parsedAmount > balance || !beneficiary.trim();

  async function submit() {
    if (!publicClient || !CONTRACT_ADDRESS) return;
    setError(null);
    setTxHash(null);
    try {
      setStage("signing");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: canopyCreditsAbi,
        functionName: "retire",
        args: [row.tokenId, parsedAmount, beneficiary.trim(), reason.trim()],
        chainId: targetChain.id,
      });
      setTxHash(hash);
      setStage("confirming");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The retirement transaction reverted.");
      const [log] = parseEventLogs({ abi: canopyCreditsAbi, eventName: "CreditsRetired", logs: receipt.logs });
      if (!log) throw new Error("Retired, but no CreditsRetired event was found in the receipt.");
      await queryClient.invalidateQueries();
      router.push(`/certificates/${log.args.retirementId}?tx=${hash}`);
    } catch (err) {
      setError(errorMessage(err));
      setStage("idle");
    }
  }

  return (
    <Card title="Retire credits">
      <p className="mb-4 text-sm text-muted">
        Retiring burns credits from your wallet and records a permanent on-chain certificate. It can&apos;t be undone.
      </p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid && !wrongNetwork) void submit();
        }}
      >
        <label className="block text-sm">
          <span className="font-medium text-body">Vintage</span>
          <select
            className={`${inputClass} mt-1`}
            value={row.vintage}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {held.map((r) => (
              <option key={r.vintage} value={r.vintage}>
                {r.vintage} · you hold {fmtCredits(r.walletBalance ?? 0n)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-body">Amount (credits, 1 = 1 tCO2e)</span>
          <div className="mt-1 flex gap-2">
            <input
              className={inputClass}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            />
            <button
              type="button"
              className="rounded-lg border border-line-strong px-3 text-xs hover:bg-raised"
              onClick={() => setAmount(balance.toString())}
            >
              Max
            </button>
          </div>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-body">Beneficiary</span>
          <input
            className={`${inputClass} mt-1`}
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            placeholder="Who the offset is claimed for"
            maxLength={120}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-body">Reason (optional)</span>
          <input
            className={`${inputClass} mt-1`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. 2026 business travel"
            maxLength={200}
          />
        </label>
        {parsedAmount > balance && <p className="text-xs text-red-300">You only hold {fmtCredits(balance)}.</p>}
        {wrongNetwork && <p className="text-xs text-red-300">Switch your wallet to {targetChain.name} first.</p>}
        {error && <ErrorBox>{error}</ErrorBox>}
        {txHash && (
          <p className="text-xs text-muted">
            Transaction: <TxLink hash={txHash} />
          </p>
        )}
        <button type="submit" className={`${buttonClass} w-full`} disabled={invalid || wrongNetwork || stage !== "idle"}>
          {stage === "signing" && (
            <>
              <Spinner /> Confirm in your wallet…
            </>
          )}
          {stage === "confirming" && (
            <>
              <Spinner /> Waiting for confirmation…
            </>
          )}
          {stage === "idle" && `Retire ${parsedAmount > 0n ? fmtCredits(parsedAmount) : "credits"}`}
        </button>
      </form>
    </Card>
  );
}
