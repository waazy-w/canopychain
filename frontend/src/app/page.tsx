import Link from "next/link";
import { buttonClass, secondaryButtonClass } from "@/components/ui";
import { METHODOLOGY_NOTE } from "@/lib/config";

const STEPS = [
  { title: "Register a forest", body: "Draw the project boundary on a satellite map. The polygon is stored and the project is registered on-chain." },
  { title: "Verify by satellite", body: "Sentinel-2 imagery measures forest cover (NDVI) against a baseline year and estimates avoided emissions in tCO2e." },
  { title: "Mint credits", body: "The report hash is attested on-chain and ERC-1155 credits are minted: 90% to the owner, 10% to a buffer pool." },
  { title: "Retire for good", body: "Retiring burns credits and stores a permanent on-chain certificate, so a credit can never be counted twice." },
  { title: "Keep watching", body: "Re-checks detect deforestation. A reversal is flagged on-chain and buffer credits are cancelled." },
  { title: "Audit everything", body: "The public registry lists every project, issuance, retirement and reversal straight from the contract." },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="rounded-2xl bg-gradient-to-br from-forest-800 to-forest-900 px-6 py-12 text-white sm:px-10">
        <p className="text-sm font-medium uppercase tracking-widest text-forest-200">Polygon Amoy testnet prototype</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">
          Forest carbon credits verified by satellite and issued on-chain.
        </h1>
        <p className="mt-4 max-w-2xl text-forest-100">
          Many forest credits are over-issued, double-counted, or keep trading after the forest is gone. CanopyChain ties
          every credit to a satellite report hash, retires credits permanently, and flags reversals in public.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className={`${buttonClass} bg-white !text-forest-900 hover:bg-forest-50`}>
            Register a forest
          </Link>
          <Link href="/registry" className={`${secondaryButtonClass} border-forest-200 bg-transparent !text-white hover:bg-forest-700`}>
            Open the registry
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-forest-900">How it works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-xl border border-stone-200 bg-white p-5">
              <span className="text-sm font-semibold text-forest-600">Step {i + 1}</span>
              <h3 className="mt-1 font-semibold text-stone-900">{s.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-earth-300 bg-earth-100 p-5 text-sm text-earth-800">
        <h2 className="font-semibold">About the numbers</h2>
        <p className="mt-1">
          {METHODOLOGY_NOTE} Credits = avoided forest loss (regional baseline loss rate minus observed loss) × tCO2e per
          hectare. It exists to demonstrate the verification and issuance pipeline, not to certify real offsets.
        </p>
      </section>
    </div>
  );
}
