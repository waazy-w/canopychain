# Devpost submission draft

Copy each section into the matching Devpost field. 

---

**Project name:** CanopyChain

**Tagline (≤ 200 characters):** Forest carbon credits verified by satellite and issued on-chain: one forest, one project, every credit traceable from Sentinel-2 pixels to a permanent retirement certificate.

**Tracks:** Carbon Markets & Emissions Trading · Climate Data & Environmental Monitoring

**Links**
- Live demo: https://canopychain.vercel.app
- Video: https://youtu.be/TDuQf8nNZao
- Code: https://github.com/waazy-w/canopychain
- User testing: https://github.com/waazy-w/canopychain/blob/main/docs/user-testing.md
- Contract on Polygon Amoy: https://amoy.polygonscan.com/address/0xeC75933ED22042090908Fd39E95afB90c644C4C2

---

## Inspiration

Forests are one of the cheapest climate solutions we have, and carbon credits are supposed to pay people to keep them standing. But the forest carbon market keeps running into the same integrity problems: credits issued for more carbon than a forest actually protected, the same forest sold twice, and credits that keep trading after the trees have burned or been cleared. Meanwhile Global Forest Watch reported more than 6 million hectares of tropical primary forest lost in 2024 alone, a record.

Verification today is mostly site visits every few years and PDFs on registry websites. Yet free, open satellite imagery now covers every forest on Earth every few days. We wanted to see how far you get if every credit is tied to a satellite measurement and every issuance, retirement and reversal is a public, permanent record.

## What it does

CanopyChain is a registry for forest carbon credits where the evidence and the accounting are both public:

1. **Register.** A project owner draws the forest boundary on a satellite map and signs the registration with their wallet. Boundaries that overlap an existing project are refused, so a forest can only be claimed once.
2. **Approve.** An approver (the contract admin) checks the land documents and signs off. The approval fixes the methodology inputs, and only then is the project registered on-chain.
3. **Verify by satellite.** The backend pulls Sentinel-2 imagery for the polygon, masks clouds, computes NDVI and measures forest cover now and a year earlier. It estimates avoided deforestation in tCO2e (a clearly labelled prototype estimate, not a certified methodology).
4. **Issue on-chain.** The full report is hashed (keccak256). An oracle submits the hash and the credit amount to an ERC-1155 contract on Polygon: one token per project and vintage, 90% to the owner and 10% locked in a buffer pool that nobody can move.
5. **Retire.** Buyers retire credits from their wallet. Retiring burns them and writes a permanent on-chain certificate, so the same tonne can never be claimed twice.
6. **Keep watching.** Re-checks compare new imagery. If the forest has been cleared, the oracle flags a **reversal** on-chain: buffer credits are burned and the project can't issue again.
7. **Audit.** A public registry lists every project and every issuance, retirement and reversal, read straight from the contract. Anyone can re-hash a report in the browser and check it matches the on-chain attestation.

## How we built it

- **Smart contract:** Solidity 0.8.24 with OpenZeppelin ERC-1155 and AccessControl, built and tested with Hardhat, deployed to Polygon Amoy. Separate admin and oracle roles; only the oracle can mint; custom errors for every rule (`AlreadyVerified`, `ProjectReversed`, …). 38 tests with 100% line and branch coverage.
- **Verification engine:** Python and FastAPI. Sentinel-2 L2A from Microsoft Planetary Computer's STAC API (free, no key), read as cloud-optimised GeoTIFF windows with rasterio onto a fixed UTM grid, cloud-masked with the scene classification layer, mosaicked until 95% of the polygon is clear. NDVI → forest hectares → avoided loss → tCO2e. Reports are hashed canonically so JavaScript and Python produce identical bytes.
- **Oracle:** web3.py with a dedicated testnet wallet holding only `ORACLE_ROLE`.
- **Integrity gate:** EIP-191 wallet signatures for registration and review (rebuilt and checked server-side), a geometric overlap check with Shapely, approver rights read live from the contract's admin role, and methodology inputs locked at approval.
- **dApp:** Next.js, wagmi, viem and RainbowKit, Leaflet with Geoman for drawing polygons, Tailwind for a dark climate-tech design with scroll-driven animation.
- **Testing:** 62 backend tests (including one per attack we closed: forged and expired signatures, someone else's wallet, duplicate forests, non-admin approvals, inflated inputs, request spamming) and a Playwright end-to-end test that drives the whole flow in a browser against a local chain with real satellite data.

## Challenges we ran into

- **Anyone could mint credits for any forest.** Our first version let anyone register any polygon in anyone's name, register the same forest twice, and even pass a 100% deforestation rate to the verify endpoint to inflate credits a hundredfold. We added wallet signatures, an overlap check, a signed approval step and locked methodology inputs, plus a test for each attack.
- **Rainforest is too green.** Our NDVI previews looked like flat green squares, because healthy rainforest sits at NDVI 0.84–0.89 and our colour scale saturated at 0.8. Stretching the scale over canopy values made rivers, clearings and canopy texture visible.
- **Polygon specifics.** web3.py rejects Polygon's long block headers without a proof-of-authority middleware, and Amoy's fee estimator suggested ~450 gwei on near-empty blocks, which would have made our deployment cost ten times our faucet allowance. A fixed 35 gwei tip cleared the network minimum at a fraction of the cost. The official Amoy RPC was also down for most of a day, so we switched defaults to a public node.
- **Identical bytes in two languages.** Report hashes and signed messages are built in both Python and TypeScript; one stray `450.0` versus `450` breaks every signature. We share a canonical JSON format and number formatting, and test them against each other.

## Accomplishments that we're proud of

- A complete, working flow on a real testnet with real satellite data, not mock-ups: register → approve → verify → mint → retire → reversal → public audit.
- Every report is tamper-evident and checkable in the browser against its on-chain hash.
- The safeguards are enforced and tested, and our security assessment is honest about what is still trusted (the oracle and the backend's checks).

## What we learned

- The hard part of carbon credits isn't the token, it's integrity: who is allowed to claim what, and how anyone can check it later. Blockchain helps most as a shared, append-only record of issuances, retirements and reversals.
- Open satellite data is good enough to make monitoring continuous and cheap. The difficult questions are methodological, especially additionality: would this forest really have been cut down?

## What's next for CanopyChain

- Per-project baselines from the satellite history of the surrounding area, so forests that were never under pressure earn few or no credits (additionality from data, not a fixed rate).
- Move the approval on-chain: `registerProject` verifies the approver's signature and stores a boundary hash.
- Decentralise the oracle (several independent operators signing the same report hash) and add a challenge window before credits can move.
- Pin reports and imagery to IPFS, add Sentinel-1 radar for cloudy regions, and use biomass maps (GEDI, ESA CCI) for carbon density instead of a fixed default.
- Pilot with community forest projects and plug in a recognised methodology with an accredited verifier co-signing each report.

## Built with

solidity · openzeppelin · hardhat · polygon · erc-1155 · python · fastapi · web3.py · sentinel-2 · microsoft-planetary-computer · rasterio · shapely · numpy · next.js · react · typescript · wagmi · viem · rainbowkit · leaflet · tailwindcss · playwright

---

*Carbon figures in CanopyChain are a prototype estimate (canopychain-prototype-v0), not a certified methodology. Testnet only.*
