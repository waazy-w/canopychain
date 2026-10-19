# CanopyChain frontend

Next.js dApp for CanopyChain: register forest projects, run satellite verification, retire credits, and browse the public registry. Carbon figures are a **prototype estimate, not a certified methodology**.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (type-checks)
npm run lint
npm run typecheck
```

`predev` and `prebuild` run `scripts/sync-contracts.mjs`, which copies `../shared/contracts.json` into `src/generated/contracts.json` (gitignored). If the shared file has no ABI yet, it falls back to `../contracts/artifacts/...`. Reads and writes are typed by the hand-written ABI in `src/lib/contract/abi.ts`, and the sync script warns if the deployed ABI is missing anything it uses.

## Environment variables

All are optional. Put them in `frontend/.env.local` (gitignored).

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL (`docs/api.md` §2) |
| `NEXT_PUBLIC_AMOY_RPC_URL` | `https://rpc-amoy.polygon.technology` | Polygon Amoy RPC for reads and event logs |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | _(empty)_ | Enables RainbowKit's full wallet list. Without it, only injected browser wallets (MetaMask) are offered |
| `NEXT_PUBLIC_CHAIN` | _(empty = Amoy)_ | `local` runs against a Hardhat node (chain 31337) using `contracts/deployments/local.json` instead of `shared/contracts.json` |
| `NEXT_PUBLIC_LOCAL_RPC_URL` | `http://127.0.0.1:8545` | RPC for `NEXT_PUBLIC_CHAIN=local` |

## Running everything locally (no Amoy needed)

1. `cd contracts && npx hardhat node` (leave running), then in another shell `npm run deploy:local`.
2. Start the backend with the oracle pointed at the local chain. These are Hardhat's public test keys, never real ones:
   ```
   cd backend
   CONTRACTS_JSON=../contracts/deployments/local.json AMOY_RPC_URL=http://127.0.0.1:8545 \
   ORACLE_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
   CANOPY_APPROVERS=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC \
   .venv/Scripts/python -m uvicorn app.main:app --port 8000
   ```
3. `cd frontend && NEXT_PUBLIC_CHAIN=local npm run dev`. In MetaMask, add network "Hardhat" (RPC `http://127.0.0.1:8545`, chain id 31337) and import a Hardhat test account to retire credits.

Running `npm run typecheck` or `npm run build` re-syncs `src/generated/contracts.json`. If you set `NEXT_PUBLIC_CHAIN=local` only in your shell, run those with it too, or put it in `.env.local`.

## Browser end-to-end test

With the three services from "Running everything locally" up: `npx playwright install chromium` (once), then `npm run e2e`. It drives a headless browser through connect wallet → draw, sign and register a forest → try to register the same forest again (must be refused) → approve it with a signed review → verify → verify report integrity → retire → certificate → simulate deforestation → integrity of the reversal → registry, with a test wallet backed by Hardhat account #2, which the backend lists in `CANOPY_APPROVERS` (step 2 above). It also checks that the register form's area matches the area the backend stores, and that "Run verification" locks once the vintage is verified or the project is reversed. It fails on any step or browser console error and saves screenshots to `e2e/shots/`.

## Behaviour without the backend or the contract

- **Backend unreachable:** GET requests fall back to in-memory mock data (`src/lib/mock/`, two demo projects: one verified, one reversed), and a yellow "Mock data" banner appears. The backend is re-tried every 15 s. In mock mode, register, verify and monitor also work against the mock, and nothing is sent on-chain.
- **Contract not deployed** (`shared/contracts.json` has no address): on-chain panels show "Contract not deployed yet". Everything else works.

## Pages

| Route | What it does |
|---|---|
| `/` | Overview, how it works, methodology note |
| `/register` | Draw a polygon on a satellite map (Leaflet + Geoman), name it, set the owner wallet → `POST /api/projects` |
| `/projects/[id]` | Map, on-chain status (Active/Reversed, issued, buffer burned), run verification / re-check / simulate deforestation, before/after NDVI previews, report numbers and hash check against the on-chain attestation, retire credits |
| `/certificates/[id]` | Printable retirement certificate read from `getRetirement` |
| `/registry` | All projects plus a live feed of `ProjectRegistered`, `CreditsIssued`, `CreditsRetired` and `ReversalFlagged` events, scanned from the deploy block in 2,000-block chunks |

## Notes

- `next.config.ts` aliases the optional `@x402/*` peers of `@coinbase/cdp-sdk` (pulled in by RainbowKit's Base connector) to an empty stub, so the build doesn't fail on modules this app never uses.
- Cache Components is off: the app is almost entirely client-side wallet and map UI.
