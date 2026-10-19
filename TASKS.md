# Tasks: CanopyChain

Deadline **Oct 25, 23:59 UTC**. Feature freeze **Oct 24, 12:00 UTC**.
Format: `- [ ] Task (owner) — branch`. Tick tasks off when they're merged.

## Day 1 (Oct 19): kick-off, together
- [ ] Both read CLAUDE.md and docs/api.md, and agree on contract v0 (A + B)
- [ ] Teammate B accepts the GitHub invite and clones the repo (B)
- [ ] Each person gets Amoy test POL from a faucet. Create an oracle wallet. (A + B)

## Teammate A (saaz): `contracts/` + `frontend/`
**Contracts**
- [x] Scaffold Hardhat (TS) + OpenZeppelin in `contracts/` (A) — feat/contracts-scaffold
- [x] `CanopyCredits.sol`: registerProject, submitVerification (90/10 buffer, no double verification), retire, flagReversal, views, events (A) — feat/canopy-credits
- [x] Tests: happy paths, access control, double verification, retiring more than the balance, reversal larger than the buffer (A)
- [ ] Deploy script for Amoy. Write the ABI and address to `shared/contracts.json`. Verify on Polygonscan. (A) — **by Oct 20 evening, so B can integrate**
**Frontend**
- [ ] Scaffold Next.js + Tailwind + wagmi/RainbowKit (Amoy) (A) — feat/frontend-scaffold
- [ ] Mock data matching the report schema in `docs/api.md` (A)
- [ ] Register project page: draw a polygon on a Leaflet map → POST /api/projects (A)
- [ ] Project page: run verification, before/after NDVI images, report numbers, link to the on-chain transaction (A)
- [ ] Retire flow: retire credits from the wallet → certificate page that reads `getRetirement` (A)
- [ ] Public registry: projects plus a feed of issuance, retirement and reversal events read from the contract (A)
- [ ] Reversal state shown clearly (badge, buffer burned) (A)

## Teammate B: `backend/`
- [ ] Scaffold FastAPI + requirements + CORS + SQLite or JSON storage (B) — feat/backend-scaffold
- [ ] Project endpoints: POST/GET /api/projects (B)
- [ ] Satellite pipeline: query Sentinel-2 L2A on Planetary Computer for a polygon and date, apply a cloud mask, compute NDVI, measure forest cover in ha (B) — feat/ndvi-pipeline
- [ ] Baseline vs current comparison, then the tCO2e estimate, then the report JSON and canonical keccak256 hash (B)
- [ ] NDVI preview PNGs (baseline and current) (B)
- [ ] POST /verify and GET /reports endpoints (B)
- [ ] Oracle (web3.py): read `shared/contracts.json`, call registerProject and submitVerification, return txHash (B) — feat/oracle
- [ ] POST /monitor with `simulateDeforestation`, then call flagReversal (B)
- [ ] Cache results for 2 or 3 demo forests so the live demo is fast and reliable (B)

## Integration (Oct 22–23, together)
- [ ] Full end-to-end run on Amoy: register → verify → mint → retire → reversal (A + B)
- [ ] Fix integration bugs. Freeze the contract interface. (A + B)

## Submission deliverables (Oct 23–25)
- [ ] Architecture diagram `docs/architecture.png` (A)
- [ ] Security & data integrity assessment `docs/security.md`: roles, oracle trust, double counting, reentrancy, report hashing (A)
- [ ] Climate impact assessment and carbon reduction projections `docs/impact.md` (B)
- [ ] Problem and solution overview, at most 2 pages `docs/overview.md` (B)
- [ ] Implementation & adoption strategy + scalability roadmap `docs/roadmap.md` (B)
- [ ] README: setup, run, deployed address, screenshots (A + B)
- [ ] 3-minute demo video (A + B)
- [ ] Devpost submission, done before Oct 25 18:00 UTC to leave a buffer (A + B)
