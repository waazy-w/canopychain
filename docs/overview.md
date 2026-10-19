# CanopyChain: Overview

**Forest carbon credits verified by satellite and issued on-chain.**
IEEE ClimateChain Global Hackathon 2026. Tracks: Carbon Markets & Emissions Trading · Climate Data & Environmental Monitoring.

## The problem

Forest carbon credits are meant to pay for forests that stay standing. In practice, buyers can't easily tell whether a credit is real:

- **Over-issuance.** Credits are estimated against a baseline that assumes much more deforestation would have happened anyway. If the baseline is inflated, so are the credits. Press and academic investigations in 2023 argued that a large share of rainforest credits from major registries did not represent real reductions.
- **Double counting.** The same tonne of CO2 can be claimed twice, for example when registry records and retirement claims live in separate, opaque databases.
- **Credits outlive the forest.** Credits keep trading after the forest behind them burns or is cleared, because nobody re-checks the site.
- **Slow, manual verification.** Verification is based on site visits and paperwork, runs every few years, and is expensive. Small community forests can't afford it.

## The solution

CanopyChain links every credit to open satellite evidence and a public, permanent on-chain record.

1. **Register.** A project owner draws the forest boundary on a map and signs the registration with their wallet. Boundaries that overlap an existing project are refused, so a forest can only be claimed once.
2. **Approve.** An approver (the contract admin) checks the land documents and signs off, fixing the methodology inputs. Only then is the project registered on-chain, and nobody can change those inputs later.
3. **Verify by satellite.** The verification engine pulls Sentinel-2 imagery (10 m resolution, free and open, via Microsoft Planetary Computer). It masks clouds, computes NDVI, and measures forest cover now and one year earlier.
4. **Estimate.** Avoided loss = how much forest the region would have lost at its baseline rate, minus what this forest actually lost. Credits = avoided loss × carbon per hectare. This is a **prototype estimate, not a certified methodology**.
5. **Issue on-chain.** The full report is hashed (keccak256). An oracle submits the hash and the credit amount to the `CanopyCredits` contract (ERC-1155, one token per project and vintage). 90% goes to the project owner and 10% is locked in a buffer pool that no one can move.
6. **Retire.** Buyers retire credits from their wallet. Retiring burns the tokens and writes a permanent certificate on-chain, so the same credit can't be claimed twice.
7. **Monitor.** The forest is re-checked. If it has been cleared, the oracle flags a **reversal** on-chain: buffer credits are burned, the project is marked as reversed, and no new credits can be issued for it.
8. **Audit.** A public registry lists every project, its satellite evidence, and every issuance, retirement and reversal event. Anyone can re-hash a report and compare it with the on-chain hash.

## What makes it different

| Today | CanopyChain |
|---|---|
| Verification every few years, by site visit | Re-checked on demand from open satellite data |
| Reports in PDFs on registry websites | Report hash on-chain. Anyone can check the report hasn't changed |
| Retirements tracked in registry databases | Retirement burns the token. A permanent certificate is on-chain |
| Lost forests discovered late, if ever | Reversals flagged on-chain and visible in the public registry |
| Buffer pools managed off-chain | Buffer held by the contract itself. Only a reversal can burn it |

## How it's built

- **Contracts:** Solidity, OpenZeppelin ERC-1155 + AccessControl, Hardhat, Polygon Amoy testnet. 38 tests, 100% coverage.
- **Verification engine:** Python, FastAPI, Planetary Computer STAC (Sentinel-2 L2A), NDVI with cloud masking, keccak256 report hashing, web3.py oracle.
- **dApp:** Next.js, wagmi, viem, RainbowKit, Leaflet. Draw a polygon, run verification, compare before and after NDVI images, retire credits, view certificates and the registry.

See `docs/security.md` for the trust model, `docs/impact.md` for climate impact, and `docs/roadmap.md` for adoption and scaling.

## Limits

This is a prototype on a testnet. The carbon estimate uses an NDVI threshold and fixed carbon-per-hectare values. It is not a certified methodology and must not be used to issue real credits. The oracle is a single trusted service. `docs/roadmap.md` explains how to decentralise it.
