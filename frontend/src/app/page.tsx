import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass, secondaryButtonClass, shortHex } from "@/components/ui";
import { IS_LOCAL_CHAIN, addressUrl } from "@/lib/config";
import { CONTRACT_ADDRESS } from "@/lib/contract";

type Tone = "accent" | "sat";

const STEPS: { title: string; body: string; tone: Tone; icon: ReactNode }[] = [
  {
    title: "Register a forest",
    body: "Draw the project boundary on a satellite map. The polygon is stored and the project is registered on-chain.",
    tone: "accent",
    icon: <path d="M4 7l5-3 6 3 5-3v13l-5 3-6-3-5 3V7Zm5-3v13m6-10v13" />,
  },
  {
    title: "Verify by satellite",
    body: "Sentinel-2 imagery measures forest cover (NDVI) against a baseline year and estimates avoided emissions in tCO2e.",
    tone: "sat",
    icon: <path d="M13 7l4 4m-9.5-.5 3-3 6 6-3 3-6-6ZM6 18a4 4 0 0 1 4-4m-6 6a8 8 0 0 1 8-8m4.5-8.5 3 3-2 2-3-3 2-2Z" />,
  },
  {
    title: "Mint credits",
    body: "The report hash is attested on-chain and ERC-1155 credits are minted: 90% to the owner, 10% to a buffer pool.",
    tone: "accent",
    icon: <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 0v18M4 7.5l8 4.5 8-4.5" />,
  },
  {
    title: "Retire for good",
    body: "Retiring burns credits and stores a permanent on-chain certificate, so a credit can never be counted twice.",
    tone: "accent",
    icon: <path d="M12 3.5c3 3.2 5 6 5 9a5 5 0 0 1-10 0c0-1.6.6-3 1.6-4.3.3 1.3 1 2.2 2 2.8 0-2.6.5-5 1.4-7.5Z" />,
  },
  {
    title: "Keep watching",
    body: "Re-checks detect deforestation. A reversal is flagged on-chain and buffer credits are cancelled.",
    tone: "sat",
    icon: <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  },
  {
    title: "Audit everything",
    body: "The public registry lists every project, issuance, retirement and reversal straight from the contract.",
    tone: "accent",
    icon: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  },
];

const TONE = {
  accent: { badge: "text-accent border-accent/25 bg-accent/10", icon: "text-accent", hover: "hover:border-accent/40" },
  sat: { badge: "text-sat border-sat/25 bg-sat/10", icon: "text-sat", hover: "hover:border-sat/40" },
} as const;

const FACTS = [
  { value: "10 m", label: "Sentinel-2 resolution", tone: "sat" },
  { value: "ERC-1155", label: "Credits per project & vintage", tone: "accent" },
  { value: "10%", label: "Buffer pool for reversals", tone: "accent" },
  { value: "100%", label: "Public, on-chain audit trail", tone: "accent" },
] as const;

export default function Home() {
  const network = IS_LOCAL_CHAIN ? "Local Hardhat chain" : "Polygon Amoy Testnet";
  return (
    <div className="space-y-24">
      <section className="relative pt-6 sm:pt-12">
        {/* Ambient glow and grid behind the hero, clipped so the oversized glow never widens the page. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 mx-auto h-[560px] max-w-5xl overflow-hidden">
          <div className="bg-grid absolute inset-0" />
          <div className="absolute left-1/2 top-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />
          <div className="absolute right-0 top-40 h-64 w-64 rounded-full bg-sat/10 blur-[100px]" />
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <a
              href={CONTRACT_ADDRESS && !IS_LOCAL_CHAIN ? addressUrl(CONTRACT_ADDRESS) : undefined}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 py-1 pl-2.5 pr-3 text-xs font-medium text-emerald-300 shadow-[0_0_24px_-6px_rgba(52,211,153,0.5)] transition hover:border-accent/50"
            >
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" />
              {network}
              {CONTRACT_ADDRESS && <span className="font-mono text-emerald-300/60">· {shortHex(CONTRACT_ADDRESS, 4)}</span>}
            </a>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Carbon credits,{" "}
              <span className="bg-gradient-to-r from-accent via-emerald-300 to-sat bg-clip-text text-transparent">
                verified from orbit.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Many forest credits are over-issued, double-counted, or keep trading after the forest is gone. CanopyChain
              ties every credit to a satellite report hash, retires credits permanently, and flags reversals in public.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/register" className={`${buttonClass} glow-accent px-5 py-2.5`}>
                Register a forest
                <span aria-hidden>→</span>
              </Link>
              <Link href="/registry" className={`${secondaryButtonClass} px-5 py-2.5`}>
                Open the registry
              </Link>
            </div>
          </div>

          <ExampleReport />
        </div>

        <dl className="mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {FACTS.map((f) => (
            <div key={f.label} className="bg-surface/90 px-5 py-4">
              <dt className="text-xs text-muted">{f.label}</dt>
              <dd className={`mt-1 text-xl font-semibold tracking-tight ${f.tone === "sat" ? "text-sat" : "text-ink"}`}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">How it works</p>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-ink">
          From satellite pixels to retired credits, in six verifiable steps.
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => {
            const t = TONE[s.tone];
            return (
              <li
                key={s.title}
                className={`group relative rounded-2xl border border-line bg-surface p-6 transition duration-200 hover:-translate-y-0.5 hover:bg-raised ${t.hover}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`rounded-md border px-2 py-0.5 font-mono text-xs font-semibold ${t.badge}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    className={`h-5 w-5 opacity-70 transition group-hover:opacity-100 ${t.icon}`}
                  >
                    {s.icon}
                  </svg>
                </div>
                <h3 className="mt-5 font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/** Hero report card built from the cached Sentinel-2 analysis of the Amazon demo forest (backend/demo_cache). */
function ExampleReport() {
  const rows = [
    { label: "Forest cover", before: "1,022.0 ha", after: "1,024.7 ha" },
    { label: "Mean NDVI", before: "0.84", after: "0.87" },
  ];
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-px rounded-2xl bg-gradient-to-b from-accent/30 via-line to-sat/20" />
      <div className="relative rounded-2xl bg-surface/95 p-5 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted">Verification report · example</p>
            <p className="mt-0.5 font-semibold text-ink">Amazonas Rainforest Block</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Verified
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {["2025", "2026"].map((year) => (
            <div key={year} className="overflow-hidden rounded-xl border border-line">
              <img
                src={`/landing/amazon-ndvi-${year}.png`}
                alt={`NDVI of the Amazon demo forest, ${year}`}
                className="h-24 w-full object-cover opacity-90"
              />
              <p className="flex justify-between bg-raised px-2.5 py-1.5 text-[11px] text-muted">
                <span>NDVI · Sentinel-2</span>
                <span className="font-mono text-sat">{year}</span>
              </p>
            </div>
          ))}
        </div>

        <dl className="mt-4 divide-y divide-line text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2">
              <dt className="text-muted">{r.label}</dt>
              <dd className="font-mono text-body">
                {r.before} <span className="text-subtle">→</span> {r.after}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted">Credits issued</dt>
            <dd className="font-mono font-semibold text-accent">9,658 tCO2e</dd>
          </div>
        </dl>

        <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2 text-xs">
          <span className="text-muted">Report hash</span>
          <span className="flex items-center gap-1.5 font-mono text-body">
            0x9f3c…a41e
            <span className="text-accent" title="Matches the on-chain attestation">✓ on-chain</span>
          </span>
        </div>
      </div>
    </div>
  );
}
