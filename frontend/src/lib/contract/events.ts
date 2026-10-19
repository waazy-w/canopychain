import { getAbiItem, type Log, type PublicClient } from "viem";
import { canopyCreditsAbi } from "./abi";
import { CONTRACT_ADDRESS, DEPLOY_BLOCK } from "./index";

export const REGISTRY_EVENTS = [
  getAbiItem({ abi: canopyCreditsAbi, name: "ProjectRegistered" }),
  getAbiItem({ abi: canopyCreditsAbi, name: "CreditsIssued" }),
  getAbiItem({ abi: canopyCreditsAbi, name: "CreditsRetired" }),
  getAbiItem({ abi: canopyCreditsAbi, name: "ReversalFlagged" }),
] as const;

export type RegistryEventName = (typeof REGISTRY_EVENTS)[number]["name"];

export interface RegistryEvent {
  eventName: RegistryEventName;
  args: Record<string, unknown>;
  blockNumber: bigint;
  logIndex: number;
  transactionHash: `0x${string}`;
}

// The public Amoy RPC rejects wide eth_getLogs ranges, so scan in small chunks, newest first.
export const CHUNK_SIZE = 2_000n;
export const MAX_SCAN_WITHOUT_DEPLOY_BLOCK = 200_000n;
const CONCURRENCY = 4;
const RETRIES = 3;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw lastErr;
}

function toEvent(log: Log): RegistryEvent {
  const l = log as Log & { eventName: RegistryEventName; args: Record<string, unknown> };
  return {
    eventName: l.eventName,
    args: l.args,
    blockNumber: l.blockNumber!,
    logIndex: l.logIndex!,
    transactionHash: l.transactionHash!,
  };
}

export interface ScanProgress {
  events: RegistryEvent[]; // newest first, everything found so far
  scannedFrom: bigint;
  fromBlock: bigint;
  toBlock: bigint;
  done: boolean;
}

/**
 * Scans the contract's registry events from the latest block back to the deploy block
 * (or the last MAX_SCAN_WITHOUT_DEPLOY_BLOCK blocks if the deploy block is unknown).
 * Calls onProgress after each batch of chunks so the UI can render as results arrive.
 */
export async function scanRegistryEvents(
  client: PublicClient,
  opts: {
    onProgress?: (p: ScanProgress) => void;
    signal?: AbortSignal;
    /** Only CreditsRetired events for this retirement id. */
    retirementId?: bigint;
    stopWhen?: (events: RegistryEvent[]) => boolean;
  } = {},
): Promise<ScanProgress> {
  if (!CONTRACT_ADDRESS) throw new Error("Contract not deployed yet");
  const latest = await withRetry(() => client.getBlockNumber());
  const floor = latest > MAX_SCAN_WITHOUT_DEPLOY_BLOCK ? latest - MAX_SCAN_WITHOUT_DEPLOY_BLOCK : 0n;
  const fromBlock = DEPLOY_BLOCK > 0n ? DEPLOY_BLOCK : floor;

  const ranges: [bigint, bigint][] = [];
  for (let end = latest; end >= fromBlock; end -= CHUNK_SIZE) {
    const start = end - CHUNK_SIZE + 1n > fromBlock ? end - CHUNK_SIZE + 1n : fromBlock;
    ranges.push([start, end]);
    if (start === fromBlock) break;
  }

  const events: RegistryEvent[] = [];
  const sort = () =>
    events.sort((a, b) =>
      a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1,
    );
  let scannedFrom = latest + 1n;

  for (let i = 0; i < ranges.length; i += CONCURRENCY) {
    if (opts.signal?.aborted) break;
    const batch = ranges.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(([start, end]) =>
        withRetry<Log[]>(() =>
          opts.retirementId !== undefined
            ? client.getContractEvents({
                address: CONTRACT_ADDRESS,
                abi: canopyCreditsAbi,
                eventName: "CreditsRetired",
                args: { retirementId: opts.retirementId },
                fromBlock: start,
                toBlock: end,
                strict: true,
              })
            : client.getContractEvents({
                address: CONTRACT_ADDRESS,
                abi: REGISTRY_EVENTS,
                fromBlock: start,
                toBlock: end,
                strict: true,
              }),
        ),
      ),
    );
    for (const logs of results) events.push(...logs.map(toEvent));
    sort();
    scannedFrom = batch[batch.length - 1][0];
    const done = i + CONCURRENCY >= ranges.length || (opts.stopWhen?.(events) ?? false);
    opts.onProgress?.({ events: [...events], scannedFrom, fromBlock, toBlock: latest, done });
    if (done) break;
  }
  return { events, scannedFrom, fromBlock, toBlock: latest, done: true };
}
