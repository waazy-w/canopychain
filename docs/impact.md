# Climate Impact Assessment & Carbon Reduction Projections

> All carbon figures in CanopyChain come from a **prototype estimate, not a certified methodology**. The projections below are illustrative scenarios computed with that prototype formula. They are not forecasts of real-world reductions.

## 1. Why forests and why integrity

Tropical deforestation is one of the largest sources of land-use emissions. Global Forest Watch (World Resources Institute / University of Maryland) reports millions of hectares of tropical primary forest lost every year, including about 3.7 million hectares in 2023 and a record of more than 6 million hectares in 2024, driven largely by fires.

Carbon finance can pay communities and landowners to keep forests standing. It only helps the climate if each credit stands for a real, additional, permanent reduction. When credits are over-issued or double counted, buyers report reductions that never happened, so global emissions are understated while finance flows to projects that didn't earn it. CanopyChain's impact comes mainly from **integrity**: making it harder to issue, double count, or keep trading credits that aren't backed by standing forest.

## 2. How CanopyChain estimates credits (prototype)

For a project polygon and a vintage year:

| Step | Formula | Default |
|---|---|---|
| Forest cover | Pixels with NDVI ≥ 0.6, cloud-masked (Sentinel-2 SCL), 10 m pixels → hectares | — |
| Observed loss | `deforestedHa` = baseline forest − current forest (≥ 0) | — |
| Expected loss without the project | baseline forest × regional baseline loss rate | 2.1% / year |
| Avoided loss | `avoidedLossHa` = max(0, expected loss − observed loss) | — |
| Carbon density | `tco2ePerHa` | 450 tCO2e/ha |
| Credits | `credits` = avoidedLossHa × tco2ePerHa (1 credit = 1 tCO2e) | — |
| Buffer | 10% of credits, locked in the contract | 10% |

The 450 tCO2e/ha default is a conservative placeholder, below typical IPCC Tier 1 above-ground values for tropical moist forest. The regional rate is a placeholder. A real deployment would take it from published regional deforestation statistics per jurisdiction.

### Worked example

A 1,250 ha project. The baseline scene shows 1,180 ha of forest and the current scene shows 1,177 ha, so 3 ha were lost.
- Expected loss: 1,180 × 2.1% ≈ 24.8 ha
- Avoided loss: 24.8 − 3 = 21.8 ha
- Credits: 21.8 × 450 ≈ **9,800 tCO2e**. 980 are locked in the buffer and 8,820 go to the project owner.

If the forest is later cleared and a re-check finds 50 ha lost, that's 50 × 450 = 22,500 tCO2e. That is more than the buffer, so the whole 980-credit buffer is burned, the project is marked **Reversed** on-chain, and no new vintages can be issued for it.

## 3. Projection scenarios (illustrative)

These scenarios use the prototype formula with the defaults above, an average project size of 1,000 ha with 95% forest cover, and observed annual loss of 0.3% (projects that are actually protected).

Per project per year: expected loss 950 × 2.1% ≈ 20.0 ha, observed ≈ 2.9 ha, avoided ≈ 17.1 ha → ≈ **7,700 tCO2e**.

| Scenario | Projects | Forest under monitoring | Credits per year (tCO2e) | Buffer held (tCO2e) |
|---|---|---|---|---|
| Pilot | 10 | 10,000 ha | ~77,000 | ~7,700 |
| Regional programme | 100 | 100,000 ha | ~770,000 | ~77,000 |
| National scale | 1,000 | 1,000,000 ha | ~7,700,000 | ~770,000 |

What these scenarios do **not** claim: that the forests would otherwise have been cut down (additionality), or that the regional rate is right for each project. Those need a certified methodology. CanopyChain's job is to make whatever methodology is used **transparent, checkable, and hard to double count**.

## 4. Integrity impact

The main climate benefit comes from credits that are **not** issued or not counted twice:

- **Over-issuance:** each project-year can be issued once, against a report whose hash is on-chain and whose satellite inputs anyone can re-run.
- **Double counting:** retirement burns the token and records a permanent certificate. A retired tonne can't be resold or claimed again.
- **Permanence:** ongoing monitoring flags reversals publicly. The buffer absorbs part of the loss, and the project is blocked from issuing more credits.
- **Cost of verification:** satellite checks cost cents of compute per project instead of a site visit. That makes monitoring every year, or even every month, affordable for small community forests, which today are often priced out of carbon markets.

## 5. Monitoring & environmental data

- **Data:** Sentinel-2 L2A (ESA Copernicus). 10 m resolution, a revisit time of a few days, free and open, accessed via Microsoft Planetary Computer.
- **Cloud handling:** the scene classification layer (SCL) masks clouds, shadows and cirrus. The least-cloudy scene in a ±60-day window is used.
- **Evidence:** before and after NDVI preview images are kept for every report and shown in the public registry.
- **Limits:** NDVI can't tell natural forest from plantations or dense crops, and it misses degradation under the canopy. Future versions should add radar (Sentinel-1, which sees through cloud) and biomass maps (e.g. GEDI, ESA CCI Biomass) for carbon density per pixel instead of a fixed default.

## 6. Risks to impact

| Risk | Mitigation (now / planned) |
|---|---|
| Baseline rate set too high → over-crediting | Configurable per project; planned: jurisdiction-level published rates only |
| NDVI threshold misclassifies land cover | Planned: land-cover classifier + radar + biomass maps |
| Leakage (deforestation moves next door) | Planned: monitor a buffer ring around each polygon |
| Single oracle could be dishonest | Hashes on-chain + open data; planned: multiple oracles (see `docs/security.md`) |
