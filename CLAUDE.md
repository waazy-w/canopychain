# CLAUDE.md

Shared instructions for every Claude Code session on this project. Two teammates work on this repo at the same time, each with their own Claude Code. Keep this file accurate. If you change the stack, commands or ownership, update it in the same PR.

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

TODO: each owner fills in their section after scaffolding.
```
# contracts/   npm install · npx hardhat test · npx hardhat ignition deploy ... --network amoy
# frontend/    npm install · npm run dev
# backend/     python -m venv .venv · pip install -r requirements.txt · uvicorn app.main:app --reload
```

## Ownership: who works where

Stay inside your own area. If you need to change something in your teammate's area, or a shared file, say so first.

| Area | Owner | Paths |
|------|-------|-------|
| Smart contracts, deployment, security doc | **Teammate A (saaz)** | `contracts/` |
| Frontend dApp (wallet, map, registry, retire) | **Teammate A (saaz)** | `frontend/` |
| Verification engine (satellite, NDVI, tCO2e) | **Teammate B** | `backend/` |
| Oracle service (writes attestations on-chain) | **Teammate B** | `backend/app/oracle/` |
| Shared: coordinate before editing | both | `docs/`, `CLAUDE.md`, `README.md`, `TASKS.md`, root config |

**Hand-off points:**
- A → B: after each deploy, commit the ABI and address to `shared/contracts.json`. The backend oracle reads them from there.
- B → A: the backend serves the REST API in `docs/api.md`. Until it's live, the frontend uses mock JSON that matches the same schemas.

## Contract between parts

`docs/api.md` is the source of truth for the REST API, the verification report schema, and the smart contract interface (functions and events).
- Build against it. Use mocks until the real thing exists.
- If you change it, update `docs/api.md` in the **same PR** and tell your teammate.

## Git workflow

- `main` must always run. Never commit directly to `main`.
- Use one branch per task: `feat/<short-name>`, `fix/<short-name>`.
- Run `git pull --rebase origin main` before starting work and before opening a PR.
- Keep PRs small and merge them often (at least daily). Reference the task (`Closes #4`).
- Do not add Claude co-author or attribution lines to commits or PRs.

## Rules

- Never commit secrets. Private keys, RPC URLs and API keys go in `.env` (gitignored). Add every new variable name to `.env.example`.
- Use **testnet keys only**, and a separate oracle wallet that holds nothing of value.
- Never commit satellite rasters, `node_modules/`, virtualenvs, or build output.
- Contracts must have tests for every state-changing function and every access-control path.
- Label the carbon methodology as a **prototype estimate** everywhere it appears in the UI and docs.
- When you finish a task, tick it off in `TASKS.md`.
