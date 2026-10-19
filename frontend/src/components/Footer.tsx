import { METHODOLOGY_NOTE } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-stone-500">
        <p>
          <strong className="text-earth-800">Carbon figures:</strong> {METHODOLOGY_NOTE} Polygon Amoy testnet only.
        </p>
        <p className="mt-1">CanopyChain · IEEE ClimateChain Global Hackathon 2026</p>
      </div>
    </footer>
  );
}
