# CanopyChain backend

FastAPI verification engine + oracle. It measures forest cover from Sentinel-2 imagery (Microsoft Planetary Computer, no API key), builds a hashed verification report, and writes it to the `CanopyCredits` contract.

> The carbon numbers are a **prototype estimate** (`canopychain-prototype-v0`), not a certified methodology.

API, report schema and hashing rule: [`docs/api.md`](../docs/api.md).

## Run

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows (Git Bash); on macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000, check /api/health
python -m app.seed_demo         # register the demo forests (instant, cached)
pytest                          # tests (satellite and chain mocked)
```

Without `.env` the API runs fully off-chain: reports are produced and stored, and every on-chain step returns `txHash: null` with `onChainError: "oracle disabled: …"`.

## Environment (`backend/.env`, gitignored)

| Variable | Required | Meaning |
|---|---|---|
| `ORACLE_PRIVATE_KEY` | for on-chain | Private key of the oracle wallet (testnet only, holds nothing of value). Its address must be the `ORACLE_ADDRESS` the contract was deployed with. |
| `AMOY_RPC_URL` | no | RPC endpoint. Default `https://rpc-amoy.polygon.technology`. |
| `PUBLIC_BASE_URL` | no | Base URL used in on-chain `metadataURI` / `reportURI`. Default `http://localhost:8000`. |
| `CONTRACTS_JSON` | no | Path to the deployment file. Default `../shared/contracts.json` (written by `npm run deploy:amoy` in `contracts/`). |
| `CANOPY_DATA_DIR` | no | Storage directory. Default `backend/data/`. |
| `CANOPY_APPROVERS` | no | Comma-separated wallets allowed to approve projects, on top of the CanopyCredits admin (read on-chain). Handy for local testing. |
| `CANOPY_DEMO_CONTROLS` | no | `0` switches off "Simulate deforestation". Default on, for the demo. |
| `CANOPY_CORS_ORIGINS` | no | Comma-separated frontend origins. Default `http://localhost:3000`. |

The contract address and ABI are re-read on every request, so a new deploy is picked up without restarting.

## How it works

- `app/satellite.py`: STAC search (`sentinel-2-l2a`, ±60 days, <30% cloud), reads B04/B08/SCL as COG windows onto a fixed UTM grid, masks clouds (SCL 0/3/8/9/10), mosaics least-cloudy-first until 95% of the polygon is clear, NDVI.
- `app/analysis.py`: forest cover (NDVI ≥ 0.6), deforestation vs. baseline, simulated deforestation, PNG previews, caches.
- `app/service.py`: verify / monitor flows, report building and hashing (`app/methodology.py`).
- `app/oracle/`: web3.py v7 client for `registerProject`, `submitVerification`, `flagReversal`. One transaction at a time, waits for the receipt (120 s), names custom-error reverts (e.g. `AlreadyVerified`).
- `app/storage.py`: JSON files in `data/` (`projects.json`, `reports/<id>.json` + PNGs).

## Caches

- `data/cache/composites/*.npz`: NDVI arrays per polygon and date (runtime only, gitignored; rasters are never committed).
- `data/cache/analysis/` and the committed `demo_cache/`: per-comparison JSON stats + two 512 px PNGs, keyed by polygon, target dates and the simulate flag. Target dates snap to the 1st of the month, so the demo cache built for October 2026 serves every demo in October.
- Rebuild the demo cache (e.g. in a new month): `python -m app.seed_demo --build-cache --no-register`.

## Oracle integration test (optional)

```bash
# terminal 1, in contracts/
npx hardhat node
# terminal 2, in contracts/
npm run deploy:local            # writes contracts/deployments/local.json, oracle = hardhat account #1
# terminal 3, in backend/
CANOPY_IT_CONTRACTS_JSON=../contracts/deployments/local.json pytest tests/test_oracle.py
```
