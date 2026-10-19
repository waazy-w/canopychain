# Putting CanopyChain online

Two free services: **Render** runs the Python backend (verification engine + oracle), **Vercel** runs the Next.js dApp. The contract is already on Polygon Amoy. Allow about 20 minutes. Do the Amoy demo run first if you can (step 0), so the hosted site starts with real projects and transactions.

## 0. Before you start: snapshot the demo data (recommended)

Render's free plan wipes the backend's disk whenever the service restarts or redeploys. So the hosted backend starts from a committed snapshot of projects and reports (`backend/seed_state/`), and the reports that on-chain hashes point to keep resolving.

After the demo run on Amoy (register → approve → verify → retire → simulate deforestation), from `backend/`:

```bash
.venv/Scripts/python -m app.snapshot     # copies data/amoy (or your CANOPY_DATA_DIR) to backend/seed_state
git add backend/seed_state && git commit -m "Seed hosted backend with the Amoy demo data" && git push
```

Projects created on the hosted site after that are lost on the next restart. On-chain records are permanent either way.

## 1. Backend on Render

1. Sign in at <https://dashboard.render.com> with GitHub.
2. **New → Blueprint**, pick the `canopychain` repository. Render reads `render.yaml` and proposes a web service called `canopychain-api`.
3. It asks for three secret values:
   - `ORACLE_PRIVATE_KEY`: the **CanopyChain Oracle** private key (the same as in `backend/.env`). Testnet wallet only.
   - `PUBLIC_BASE_URL`: leave a placeholder like `https://example.com` for now; you'll fix it in step 5.
   - `CANOPY_CORS_ORIGINS`: placeholder for now as well.
4. Click **Apply**. The first build takes 5–10 minutes (it installs the satellite libraries).
5. When it's live, copy its URL (e.g. `https://canopychain-api.onrender.com`). Open `<URL>/api/health`: you should see `"ok": true, "oracleEnabled": true`.
6. In the service's **Environment** tab set `PUBLIC_BASE_URL` to that URL, and save (it redeploys).

## 2. Frontend on Vercel

1. Sign in at <https://vercel.com> with GitHub, **Add New → Project**, import `canopychain`.
2. **Root Directory**: `frontend`. Framework: Next.js (detected). Leave "Include files outside the root directory" on: the build reads `shared/contracts.json`.
3. **Environment Variables**:
   - `NEXT_PUBLIC_API_URL` = the Render URL from step 1.5 (no trailing slash)
   - `NEXT_PUBLIC_AMOY_RPC_URL` = `https://polygon-amoy-bor-rpc.publicnode.com`
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` = optional (cloud.reown.com); without it only browser wallets like MetaMask are offered
4. **Deploy**. Copy the site URL (e.g. `https://canopychain.vercel.app`).

## 3. Connect them

1. On Render, set `CANOPY_CORS_ORIGINS` to the Vercel URL (add `,http://localhost:3000` if you still develop locally). Save.
2. Open the Vercel URL. There should be **no** yellow "Mock data" banner, and the registry should list your projects.

## 4. Keep the backend awake during judging

Render's free plan sleeps after 15 idle minutes, and waking takes about a minute, long enough for the dApp to fall back to mock data. `deploy/keepalive.yml` is a GitHub Action that pings the backend every 10 minutes. It lives outside `.github/` because adding workflows needs an extra GitHub permission:

1. Give your GitHub CLI that permission once: `gh auth refresh -h github.com -s workflow` (it opens the browser).
2. Install the workflow: `mkdir -p .github/workflows && git mv deploy/keepalive.yml .github/workflows/keepalive.yml && git commit -m "Add keep-alive workflow" && git push`
3. GitHub → the repository → **Settings → Secrets and variables → Actions → Variables → New repository variable**: name `BACKEND_URL`, value the Render URL. Then **Actions → Keep backend awake → Run workflow** once to check it's green.

Alternative without GitHub Actions: a free monitor at <https://uptimerobot.com> pinging `<Render URL>/api/health` every 5 minutes does the same.

## 5. Put the links in the submission

- README "Live deployment": add the Vercel and Render URLs.
- Devpost: the Vercel URL as the demo link, the GitHub repository, and the Polygonscan contract link.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Yellow "Mock data" banner | Backend asleep or URL wrong. Open `<Render URL>/api/health`, check `NEXT_PUBLIC_API_URL` on Vercel (redeploy after changing it). |
| Browser console: CORS error | `CANOPY_CORS_ORIGINS` on Render must exactly match the Vercel URL, with `https://` and no trailing slash. |
| `oracleEnabled: false` | `ORACLE_PRIVATE_KEY` missing on Render. |
| Verification fails with an on-chain error about funds | The oracle wallet is out of test POL: claim more at faucet.polygon.technology. |
| Render build fails installing `rasterio` | Make sure `PYTHON_VERSION` is `3.12.8` (set by the blueprint). |
