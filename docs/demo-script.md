# Demo video script (3:00)

The rules ask for a **3-minute** demo. This script is timed to about 2:55. Each scene lists what's on screen, what to click, and what to say. Read the narration at a calm pace; it's written to fit.

## Before you record

**Wallets and funds (Amoy)**
- **CanopyChain Oracle** has at least 0.05 POL (faucet.polygon.technology). It pays for approval, verification and the reversal (about 0.02 POL for a full run).
- **Account 1** acts as the forest owner. It needs about 0.01 POL to retire credits: send some from another account, or claim from the faucet.
- **CanopyChain Deployer** is the approver (contract admin). Approving is a free signature; it needs no POL.
- MetaMask's fee estimate on Amoy is inflated (often ~450 gwei). When MetaMask asks to confirm the **retire** transaction: **Market → Advanced**, set **max base fee 40** and **priority fee 35** gwei.

**Screen**
- Backend and frontend running (or the hosted site), no yellow "Mock data" banner.
- Browser at 1920×1080, zoom 110%, bookmarks bar hidden (Ctrl+Shift+B), one tab, notifications off.
- Open in tabs ahead of time: the site's landing page, and Polygonscan for the contract: https://amoy.polygonscan.com/address/0xeC75933ED22042090908Fd39E95afB90c644C4C2
- Pick a forest that isn't already registered. A good choice is a block of intact rainforest near a river, so the NDVI images show detail. Zoom the register map in to it before recording, so drawing takes one take.
- Do one full dry run on the local chain first (README "How to run") so every click is familiar.

**Recording:** Windows Game Bar (Win + Alt + R) or OBS. Record scene by scene and cut out waiting time (verification takes ~10 s, transactions a few seconds). Narration can be recorded separately and laid over.

---

## Scene 1 · Problem (0:00–0:20)
**Screen:** landing page, hero. Slowly scroll to "Why it matters" (the 6M+ ha figure), then back up.
**Say:** "Forest carbon credits are meant to pay people to keep forests standing. But credits get over-issued, the same forest gets sold twice, and credits keep trading after the trees are gone. In 2024 alone, over six million hectares of tropical primary forest were lost. CanopyChain ties every credit to satellite evidence and a public, permanent record on Polygon."

## Scene 2 · Register (0:20–0:40)
**Screen:** Register project. Connected as **Account 1**. Draw the rectangle, type a name, click **Sign & register**, show the MetaMask signature prompt, sign.
**Say:** "A landowner draws their forest on a satellite map and signs the registration with their wallet. No gas, just a signature that proves they control the owner address. If someone tries to register a boundary that overlaps an existing project, it's refused. One forest, one project."
*(Optional 3 s cut: drawing over the existing Amazon project shows the red "overlaps project #1" message.)*

## Scene 3 · Approve (0:40–1:00)
**Screen:** the new project page shows **Pending review** and no verification button. Switch MetaMask to **CanopyChain Deployer**, the review form appears. Type a note ("title deed checked"), click **Sign & approve**, sign. The badge turns **Approved** and a transaction link appears.
**Say:** "New projects stay off-chain until an approver, the contract's admin, checks the land documents. The approval fixes the methodology inputs, so nobody can inflate the numbers later, and only now is the project registered on-chain."

## Scene 4 · Verify by satellite (1:00–1:35)
**Screen:** click **Run verification**. Cut the wait. Show the before and after NDVI images, forest cover, avoided loss and credits. Click the transaction link, show the `CreditsIssued` event on Polygonscan, come back.
**Say:** "Verification pulls free Sentinel-2 imagery from Microsoft's Planetary Computer, masks clouds, and measures forest cover now against a year ago. From the avoided deforestation it estimates the carbon, a clearly labelled prototype estimate. The oracle writes the report's hash and the credits to the contract: ninety percent to the owner, ten percent locked in a buffer pool that nobody can move."

## Scene 5 · Tamper-evident report (1:35–1:50)
**Screen:** click **Verify this report**, the green "Verified: this is exactly the report the oracle attested on-chain" appears.
**Say:** "Anyone can re-hash the report in their browser and check it against the chain. If a single number were edited after issuance, this check would fail."

## Scene 6 · Retire (1:50–2:10)
**Screen:** switch MetaMask back to **Account 1**. In the Retire panel: amount 10, beneficiary "Acme Corp", reason "2026 business travel". Confirm in MetaMask (fees as above). The certificate page opens.
**Say:** "A company retires ten credits to offset its travel. Retiring burns them and stores a permanent certificate on-chain. That tonne can never be sold or claimed again."

## Scene 7 · Forest loss and reversal (2:10–2:35)
**Screen:** back on the project, click **Simulate deforestation**. The after-image now shows a brown cleared patch, the badge turns **Reversal flagged**, buffer credits burned.
**Say:** "Monitoring doesn't stop at issuance. Here we simulate clearing part of the forest. The re-check detects the loss, the oracle flags a reversal on-chain, the buffer credits are burned, and this project can never issue again."

## Scene 8 · Audit and close (2:35–2:55)
**Screen:** Registry page: the on-chain activity feed (registered, issued, retired, reversal). Then scroll the landing page's Safeguards section, end on the hero.
**Say:** "Every registration, issuance, retirement and reversal is public and read straight from the contract. Signed ownership, one project per forest, independent approval, tamper-evident reports and a reversal buffer: integrity enforced by code. CanopyChain. Carbon credits, verified from orbit."

---

## If something goes wrong on camera
- **Verification error about the oracle or funds:** the oracle is out of POL. Claim from the faucet and retry; nothing was minted.
- **"Mock data" banner:** the backend isn't reachable. Restart it (or wait a minute if hosted on Render's free plan, which sleeps).
- **Amoy is slow or down:** record the whole flow on the local Hardhat chain instead (README "How to run"). Everything works the same; mention in the Devpost text that the contract is also deployed on Amoy with a link.
