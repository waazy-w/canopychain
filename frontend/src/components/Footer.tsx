import { METHODOLOGY_NOTE } from "@/lib/config";
import { LogoMark } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <aside className="flex gap-3 rounded-xl border border-line bg-surface/60 px-4 py-3 text-xs leading-relaxed text-muted">
          <span aria-hidden className="mt-px font-mono text-subtle">ⓘ</span>
          <p>
            <span className="font-medium text-body">Testnet prototype.</span> Runs on the Polygon Amoy testnet; tokens
            have no monetary value. Carbon figures: {METHODOLOGY_NOTE} Credits = avoided forest loss (regional baseline
            loss rate minus observed loss) × tCO2e per hectare, shown to demonstrate the pipeline, not to certify real
            offsets.
          </p>
        </aside>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-subtle">
          <span className="flex items-center gap-2">
            <LogoMark className="h-4 w-4" />
            CanopyChain
          </span>
          <span>IEEE ClimateChain Global Hackathon 2026</span>
        </div>
      </div>
    </footer>
  );
}
