# CLAUDE.md

Instructions for every Claude Code session on this project. saaz is the sole developer and owns every area of the repo; Claude Code builds most of it. Keep this file accurate. If you change the stack, commands or layout, update it in the same PR.

## Project: CanopyChain

**IEEE ClimateChain Global Hackathon 2026** submission. Tracks: *Carbon Markets & Emissions Trading* and *Climate Data & Environmental Monitoring*.

**Deadline: Oct 25, 2026, 11:59 PM UTC.** Feature freeze: **Oct 24, 12:00 UTC.**

**Problem:** Many forest carbon credits are over-issued, double-counted, or keep trading after the forest behind them has been cut down. Verification is manual, slow and opaque.

**Solution:** Forest carbon credits are verified by satellite and issued on-chain.
1. A project owner registers a forest area (a GeoJSON polygon).
2. The verification engine pulls Sentinel-2 imagery, measures forest cover (NDVI) and deforestation against a baseline, and estimates tCO2e.
3. The report is hashed. An oracle writes the attestation on-chain, and the contract mints credits (ERC-1155, one token id per project and vintage), holding back 10% in a buffer pool.
4. Buyers buy and **retire** credits. Retirement burns them and records a permanent on-chain certificate, so a credit can't be counted twice.
5. Ongoing monitoring: if a re-check finds deforestation, the oracle flags a **reversal**. The contract cancels credits from the buffer and marks the project.
6. A public registry page shows every project, its satellite evidence, and every issuance and retirement event.

**Demo flow (3-minute video):** register a project → run verification (map plus a before/after NDVI image) → credits minted on testnet → buy and retire one credit (certificate shown) → simulate deforestation → reversal flagged on-chain → registry shows it.

**Out of scope:** a real certification methodology, mainnet, payments in fiat, user accounts beyond wallets.

## Tech stack

- **Contracts:** Solidity ^0.8.24, Hardhat (TypeScript), OpenZeppelin (ERC1155, AccessControl). Network: **Polygon Amoy testnet**.
- **Frontend:** Next.js (App Router, TypeScript), wagmi + viem + RainbowKit, Leaflet for maps, Tailwind.
- **Backend:** Python 3.11+, FastAPI, Microsoft Planetary Computer STAC (Sentinel-2 L2A, no API key needed), `pystac-client`, `planetary-computer`, `stackstac` or `rasterio`, `numpy`, `shapely`. `web3.py` for the oracle.
- **Storage:** report JSON is hashed (keccak256) and stored by the backend. Pinning to IPFS is a stretch goal.

## Commands

```
# contracts/   npm install · npx hardhat test · npx hardhat coverage
#              npm run deploy:amoy   (needs contracts/.env; writes shared/contracts.json)
# frontend/    npm install · npm run dev · npm run build · npm run lint   (optional env: frontend/README.md)
# backend/     python -m venv .venv · pip install -r requirements.txt · uvicorn app.main:app --reload
#              pytest · python -m app.seed_demo   (optional backend/.env enables the oracle)
```

## Layout

| Area | Paths |
|------|-------|
| Smart contracts, deployment, security doc | `contracts/` |
| Frontend dApp (wallet, map, registry, retire) | `frontend/` |
| Verification engine (satellite, NDVI, tCO2e) | `backend/` |
| Oracle service (writes attestations on-chain) | `backend/app/oracle/` |
| Docs and project files | `docs/`, `CLAUDE.md`, `README.md`, `TASKS.md`, root config |

**How the parts connect:**
- Contracts → backend/frontend: each deploy writes the ABI and address to `shared/contracts.json`. The oracle and the frontend read them from there.
- Backend → frontend: the backend serves the REST API in `docs/api.md`. The frontend falls back to mock JSON with the same schemas when the backend is down.

## Interfaces between parts

`docs/api.md` is the source of truth for the REST API, the verification report schema, and the smart contract interface (functions and events).
- Build against it.
- If you change an interface, update `docs/api.md` in the **same PR**.

## Git workflow

- Solo project: commit directly to `main` and push. No feature branches or pull requests.
- `main` must always run. Run the relevant tests (and `npm run build` for frontend changes) before each commit.
- Run `git pull --rebase origin main` before starting work.
- Keep commits small and focused, with clear messages.
- Do not add Claude co-author or attribution lines to commits.

## Rules

- Never commit secrets. Private keys, RPC URLs and API keys go in `.env` (gitignored). Add every new variable name to `.env.example`.
- Use **testnet keys only**, and a separate oracle wallet that holds nothing of value.
- Never commit satellite rasters, `node_modules/`, virtualenvs, or build output.
- Contracts must have tests for every state-changing function and every access-control path.
- Label the carbon methodology as a **prototype estimate** everywhere it appears in the UI and docs.
- When you finish a task, tick it off in `TASKS.md`.
