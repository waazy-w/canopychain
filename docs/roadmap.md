# Implementation & Adoption Strategy · Scalability Roadmap

> The carbon methodology in CanopyChain is a **prototype estimate, not a certified methodology**. Moving to real credits means pairing the platform with a certified methodology and an accredited verifier (Phase 2).

## 1. Who uses it

| User | What they get |
|---|---|
| **Community and smallholder forest projects** | Cheap, frequent, satellite-based monitoring instead of costly site visits. A public record buyers can trust. |
| **Credit buyers (companies, funds)** | Credits linked to open satellite evidence. Retirement certificates on-chain. Visible reversals, so they don't hold credits for a forest that is gone. |
| **Registries and verifiers** | A monitoring and transparency layer they can plug into existing standards, instead of a competing standard. |
| **Regulators and the public** | An auditable record of every issuance, retirement and reversal. |

## 2. Implementation phases

### Phase 0: Hackathon prototype (Oct 2026, done)
- ERC-1155 credits on Polygon Amoy with a buffer pool, retirement certificates and reversals
- Sentinel-2 NDVI verification with cloud masking and report hashing
- dApp: map registration, verification, retirement, public registry

### Phase 1: Pilot (3–6 months)
- Work with 3–5 community forest projects and one NGO partner
- Pin reports and NDVI previews to IPFS so evidence doesn't depend on our server
- Add an overlap check between project polygons and a monitoring ring around each project to catch leakage
- Add Sentinel-1 radar for cloudy regions and a land-cover classifier on top of NDVI
- Scheduled monitoring (monthly) instead of on-demand
- External smart-contract audit before any mainnet deployment

### Phase 2: Certified credits (6–18 months)
- Plug in a recognised methodology (for example a jurisdictional REDD+ approach) with published regional baseline rates
- An accredited validation and verification body signs each report hash alongside our oracle
- Decentralise the oracle: M-of-N independent operators sign the same report hash, plus a challenge window before credits can be transferred
- Multisig and timelock for admin roles
- Mainnet deployment on Polygon PoS. Bridge or tokenisation partnerships with existing registries, so credits aren't issued twice across systems

### Phase 3: Scale (18+ months)
- Biomass maps (GEDI, ESA CCI Biomass) for carbon density per pixel instead of a fixed default
- Marketplace and integrations with corporate carbon accounting tools, which read retirement certificates directly
- Open API and SDK so other registries can use the monitoring and reversal layer

## 3. Adoption strategy

1. **Start where verification is the bottleneck.** Small community forests are priced out by verification costs. Satellite monitoring makes them viable, which is the strongest early use case.
2. **Complement standards, don't replace them.** Position CanopyChain as the monitoring, transparency and anti-double-counting layer for existing standards and verifiers.
3. **Make transparency the selling point.** Buyers face reputational risk from low-quality credits. A public page with satellite evidence and on-chain history answers that directly.
4. **Open data, open code.** Sentinel-2 is free, and the analysis can be re-run by anyone. Publishing the pipeline builds trust with NGOs and researchers.
5. **Low cost for project owners.** No upfront verification fee in the pilot. A small fee per issued credit later.

## 4. Scalability

| Dimension | Prototype | At scale |
|---|---|---|
| **Imagery processing** | One request per verification, run synchronously in the API | Job queue (e.g. Celery or a cloud batch service) with workers reading cloud-optimised GeoTIFFs near the data. Thousands of polygons per day. |
| **Storage** | JSON files on the backend | Postgres + PostGIS for projects and polygons. IPFS or object storage for reports and previews. |
| **Chain costs** | One transaction per issuance or reversal on Polygon | Polygon PoS fees are a small fraction of a cent to a few cents per transaction. For very high volume, batch several issuances in one transaction or move to an L2 rollup. |
| **Registry reads** | Frontend scans contract events from the deploy block | A subgraph or indexer (e.g. The Graph) so the registry loads instantly at any size. |
| **Oracle** | One server key | M-of-N operators. Signatures checked on-chain or aggregated off-chain. |
| **Token model** | One ERC-1155 token per project and vintage | Scales to millions of token ids. Metadata served per token from the report URI. |

## 5. Risks

| Risk | Response |
|---|---|
| Methodology credibility | Partner with a recognised standard; keep the prototype label until then |
| Regulatory uncertainty around tokenised credits | Work with registries rather than around them; avoid issuing credits outside a recognised standard on mainnet |
| Oracle centralisation | Phased move to multiple independent operators plus verifier signatures |
| Cloud cover in the tropics | Radar (Sentinel-1) and wider date windows |
| Low early liquidity | Focus on retirement (the end use) rather than speculative trading |
