# User testing results

**Honest scope:** this is a solo hackathon entry. We did **not** run sessions with external testers. What follows is (1) one full first-time walkthrough of the live prototype on Polygon Amoy by the team member, who had not used the finished flow before, (2) the questions that came up while learning the concept, and (3) automated tests. Every issue below happened; nothing is invented or extrapolated. The protocol for proper sessions with 2–3 outside testers is ready in [user-testing-kit.md](user-testing-kit.md) and is the first thing we would do next.

## 1. End-to-end walkthrough on Polygon Amoy (20 Oct 2026)

Setup: hosted dApp (https://canopychain.vercel.app), hosted backend on Render, MetaMask with two testnet wallets (forest owner and approver). Real Sentinel-2 imagery, real transactions.

| Step | Result | What went wrong |
|---|---|---|
| Register a forest (Rondônia, Brazil, 1,133 ha) | Completed, on the second attempt | First time, the tester connected MetaMask and believed the forest was registered. No registration had been sent: connecting a wallet and signing the registration looked like the same step. |
| Approve as reviewer | Completed | None. Project registered on-chain. |
| Satellite verification | Completed: 10,696 tCO2e minted | None. [Tx 0x5763f2…](https://amoy.polygonscan.com/tx/0x5763f29f29211ce03d9d72cfc84fe8d166cca8992cdf704bc9bd6a2694502cbe) |
| Check the verification report | Completed | A grey strip appeared under the project map after the page finished loading. |
| Retire 10 credits for "Acme Corp" | Completed, after two fixes | MetaMask failed with "Request exceeds defined limit", then "Invalid parameters were provided to the RPC method". MetaMask's default Amoy RPC was rejecting the wallet's own gas/fee estimate. The tester also picked "Polygon" (mainnet) before finding the custom "Amoy" network. |
| Simulate deforestation | Completed: 169.8 ha loss flagged, 1,069 buffer credits burned | None. |

### Changes made
| Problem | Fix |
|---|---|
| Connecting a wallet felt like registering | The register form now shows a live checklist (wallet ✓, name ✓, boundary ✓) and says "Not registered yet: press Sign & register" until the signature is sent. |
| Retire failed in MetaMask on Amoy | The dApp now estimates gas itself and sets the fee (35 gwei tip, the Amoy minimum) instead of relying on the wallet; the demo script tells users to point MetaMask's Amoy network at a reliable public RPC. Verified: the same retire then went through. |
| Mainnet vs testnet confusion | Demo script now names the exact MetaMask network entry to pick. The dApp already blocks the retire button and says "Switch your wallet to Polygon Amoy" on the wrong network. |
| Grey strip under the map | The map now re-measures itself whenever its container resizes. |

## 2. Questions a newcomer asked about the concept

While learning how the system works, the same person asked these questions. They show what the landing page and pitch have to answer up front:

1. *"Does the company have to own the forest?"* No: forest **owners** register and earn credits; **companies** buy and retire them. The roles were not obvious.
2. *"What if the forest gets cut down?"* The monitoring and buffer pool answer this, but it was the first trust question asked.
3. *"But the companies still retired 90% of the credits."* The buffer only covers part of a reversal. This is a real limitation of buffer pools in general (see [security.md](security.md), §5).
4. *"So the forest generates credits; it's not a one-time thing?"* Credits are issued per verified period, based on carbon kept in or absorbed by the forest.
5. *"What's the benefit for people who register the forest?"* Income from credits, without an expensive manual audit.

**Takeaway:** the mechanics worked, but the *roles* (owner, approver, buyer) and *permanence* were the main sources of confusion. Both deserve one sentence each near the top of the landing page.

## 3. Automated testing (23 Oct 2026)

- Smart contract: **38 passing** (Hardhat), including attacks on minting, overlap, buffer-pool transfers and roles.
- Backend: **62 passed, 1 skipped** (pytest): analysis, geometry, methodology, oracle, API signatures and snapshot restore.

## Limitations
- One tester, who is also the developer, is not a user study. We report no ratings or completion rates because we don't have honest data for them.
- Next step: run the [user-testing kit](user-testing-kit.md) with 2–3 outside people, ideally one carbon-market buyer and one forest-community representative.
