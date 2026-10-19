import type { ReactNode } from "react";
import { addressUrl, txUrl } from "@/lib/config";

export function PrototypeBadge() {
  return (
    <span
      title="Prototype estimate (canopychain-prototype-v0), not a certified carbon methodology"
      className="ml-1.5 inline-block rounded border border-earth-300 bg-earth-100 px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-earth-800"
    >
      prototype estimate
    </span>
  );
}

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-stone-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-base font-semibold text-forest-900">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, badge }: { label: string; value: ReactNode; badge?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-stone-900">
        {value}
        {badge && <PrototypeBadge />}
      </dd>
    </div>
  );
}

const STATUS_STYLES = {
  green: "bg-forest-100 text-forest-800 border-forest-200",
  red: "bg-red-100 text-red-800 border-red-200",
  amber: "bg-amber-100 text-amber-900 border-amber-200",
  gray: "bg-stone-100 text-stone-700 border-stone-200",
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
  return (
    <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="font-mono text-forest-700 underline hover:text-forest-900">
      {label ?? shortHex(hash)}
    </a>
  );
}

export function AddressLink({ address }: { address: string }) {
  return (
    <a href={addressUrl(address)} target="_blank" rel="noreferrer" className="font-mono text-forest-700 underline hover:text-forest-900">
      {shortHex(address, 4)}
    </a>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{children}</div>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">{children}</div>;
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
  "inline-flex items-center justify-center gap-2 rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50";
export const dangerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";
export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-200";
