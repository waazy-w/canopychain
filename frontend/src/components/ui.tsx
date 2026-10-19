import type { ReactNode } from "react";
import { EXPLORER_URL, addressUrl, txUrl } from "@/lib/config";

export function PrototypeBadge() {
  return (
    <span
      title="Prototype estimate (canopychain-prototype-v0), not a certified carbon methodology"
      className="ml-1.5 inline-block rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-amber-200"
    >
      prototype estimate
    </span>
  );
}

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      {title && <h2 className="mb-3 text-base font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, badge }: { label: string; value: ReactNode; badge?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-ink">
        {value}
        {badge && <PrototypeBadge />}
      </dd>
    </div>
  );
}

const STATUS_STYLES = {
  green: "bg-accent/15 text-emerald-300 border-accent/30",
  red: "bg-red-500/15 text-red-300 border-red-500/30",
  amber: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  gray: "bg-raised text-body border-line",
} as const;

export function Badge({ tone, children }: { tone: keyof typeof STATUS_STYLES; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[tone]}`}>
      {children}
    </span>
  );
}

export function shortHex(hex: string, chars = 6) {
  return hex.length <= chars * 2 + 2 ? hex : `${hex.slice(0, chars + 2)}…${hex.slice(-chars)}`;
}

export function TxLink({ hash, label }: { hash: string; label?: string }) {
  if (!EXPLORER_URL) return <span className="font-mono" title={hash}>{label ?? shortHex(hash)}</span>;
  return (
    <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="font-mono text-accent underline hover:text-ink">
      {label ?? shortHex(hash)}
    </a>
  );
}

export function AddressLink({ address }: { address: string }) {
  if (!EXPLORER_URL) return <span className="font-mono" title={address}>{shortHex(address, 4)}</span>;
  return (
    <a href={addressUrl(address)} target="_blank" rel="noreferrer" className="font-mono text-accent underline hover:text-ink">
      {shortHex(address, 4)}
    </a>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{children}</div>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-line bg-raised px-4 py-3 text-sm text-muted">{children}</div>;
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]"
    />
  );
}

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-body transition hover:border-accent/40 hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";
export const dangerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50";
export const inputClass =
  "w-full rounded-lg border border-line-strong bg-canvas px-3 py-2 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";
