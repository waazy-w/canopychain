# CanopyChain

**Forest carbon credits verified by satellite and issued on-chain.** Submission for the **IEEE ClimateChain Global Hackathon 2026** (Tracks: Carbon Markets & Emissions Trading · Climate Data & Environmental Monitoring).

## Problem
Many forest carbon credits are over-issued, double-counted, or keep trading after the forest behind them is gone. Verification is manual, slow and opaque.

## Solution
- **Satellite verification:** Sentinel-2 NDVI analysis measures forest cover and deforestation for a project's polygon.
- **On-chain issuance:** an oracle posts the hash of each verification report, and the ERC-1155 credits are minted only against a verified report. 10% goes into a buffer pool.
- **Permanent retirement:** retiring burns credits and records a public certificate, so a credit can't be counted twice.
- **Ongoing monitoring:** if the forest is lost, the reversal is flagged on-chain and buffer credits are cancelled.
- **Public registry:** every issuance, retirement and reversal can be audited by anyone.

> The carbon methodology here is a prototype estimate, not a certified standard.

## Repo layout
```
contracts/   Solidity + Hardhat (Polygon Amoy)
frontend/    Next.js dApp
backend/     FastAPI verification engine + oracle
shared/      Deployed contract ABI + address
docs/        API contract, architecture, security, impact docs
```

## How to run
TODO: filled in by each owner. Copy `.env.example` to `.env` first.

## Team
- saaz: everything (contracts, frontend, verification engine, oracle)
