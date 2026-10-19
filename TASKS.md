# Tasks: CanopyChain

Deadline **Oct 25, 23:59 UTC**. Feature freeze **Oct 24, 12:00 UTC**.
Format: `- [ ] Task — branch`. Tick tasks off in the PR that completes them.
Tasks marked **(saaz)** need saaz personally (wallets, keys, recording, submitting). Claude Code does the rest.

## Setup (saaz)
- [x] Read CLAUDE.md and docs/api.md, agree on contract v0
- [ ] Create a deployer wallet and a separate oracle wallet, get Amoy test POL from a faucet (saaz)
- [ ] Fill in `contracts/.env` and `backend/.env` (saaz)

## Contracts: `contracts/`
- [x] Scaffold Hardhat (TS) + OpenZeppelin in `contracts/` — feat/canopy-credits
- [x] `CanopyCredits.sol`: registerProject, submitVerification (90/10 buffer, no double verification), retire, flagReversal, views, events — feat/canopy-credits
- [x] Tests: happy paths, access control, double verification, retiring more than the balance, reversal larger than the buffer — feat/canopy-credits
- [x] Deploy script for Amoy that writes the ABI and address to `shared/contracts.json` and verifies on Polygonscan — feat/deploy-amoy
- [ ] Deploy to Amoy and commit `shared/contracts.json` (needs `contracts/.env`)

## Backend: `backend/`
- [ ] Scaffold FastAPI + requirements + CORS + JSON storage — feat/backend
- [ ] Project endpoints: POST/GET /api/projects
- [ ] Satellite pipeline: query Sentinel-2 L2A on Planetary Computer for a polygon and date, apply a cloud mask, compute NDVI, measure forest cover in ha
- [ ] Baseline vs current comparison, then the tCO2e estimate, then the report JSON and canonical keccak256 hash
- [ ] NDVI preview PNGs (baseline and current)
- [ ] POST /verify and GET /reports endpoints
- [ ] Oracle (web3.py): read `shared/contracts.json`, call registerProject and submitVerification, return txHash
- [ ] POST /monitor with `simulateDeforestation`, then call flagReversal
- [ ] Cache results for 2 or 3 demo forests so the live demo is fast and reliable

## Frontend: `frontend/`
- [ ] Scaffold Next.js + Tailwind + wagmi/RainbowKit (Amoy) — feat/frontend
- [ ] Mock data matching the report schema in `docs/api.md`
- [ ] Register project page: draw a polygon on a Leaflet map → POST /api/projects
- [ ] Project page: run verification, before/after NDVI images, report numbers, link to the on-chain transaction
- [ ] Retire flow: retire credits from the wallet → certificate page that reads `getRetirement`
- [ ] Public registry: projects plus a feed of issuance, retirement and reversal events read from the contract
- [ ] Reversal state shown clearly (badge, buffer burned)

## Integration (Oct 22–23)
- [ ] Full end-to-end run on Amoy: register → verify → mint → retire → reversal
- [ ] Fix integration bugs. Freeze the contract interface.

## Submission deliverables (Oct 23–25)
- [ ] Architecture diagram `docs/architecture.png`
- [ ] Security & data integrity assessment `docs/security.md`: roles, oracle trust, double counting, reentrancy, report hashing
- [ ] Climate impact assessment and carbon reduction projections `docs/impact.md`
- [ ] Problem and solution overview, at most 2 pages `docs/overview.md`
- [ ] Implementation & adoption strategy + scalability roadmap `docs/roadmap.md`
- [ ] README: setup, run, deployed address, screenshots
- [ ] 3-minute demo video (saaz)
- [ ] Devpost submission, done before Oct 25 18:00 UTC to leave a buffer; update the team list there too (saaz)
