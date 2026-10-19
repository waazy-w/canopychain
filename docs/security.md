# Security & Data Integrity Assessment

CanopyChain is a hackathon prototype on the Polygon Amoy testnet. This document describes the trust model, the controls that are in place, and the risks we know are still open. The carbon methodology is a **prototype estimate, not a certified methodology**.

## 1. System and trust boundaries

```
Project owner ──(polygon + wallet signature)──► Backend (FastAPI) ──► Planetary Computer (Sentinel-2 L2A)
Approver (contract admin) ──(signed approve/reject + methodology inputs)──┘   │
                                                                              │ report JSON ──keccak256──► reportHash
                                                                              ▼
                                                     Oracle wallet ──(ORACLE_ROLE tx)──► CanopyCredits (ERC-1155)
                                                                                              ▲
Buyers / retirees ──(own wallet: transfer, retire)────────────────────────────────────────────┘
Anyone ──(read events, getProject, getRetirement)──► public registry
```

| Actor | Trusted for | Holds |
|---|---|---|
| Admin (deployer) | Granting and revoking roles, setting the token URI, **approving projects** (land title, methodology inputs) | `DEFAULT_ADMIN_ROLE` |
| Project owner | Nothing beyond their own claim. They prove control of the owner wallet by signing the registration | Their wallet |
| Oracle wallet | Honestly relaying verification and monitoring results | `ORACLE_ROLE` |
| Backend | Running the satellite analysis correctly and storing reports | The oracle key (server-side only) |
| Token holders | Nothing. They can only move or retire their own credits | ERC-1155 balances |

## 2. Access control

`CanopyCredits` uses OpenZeppelin `AccessControl`.

| Function | Who can call it | Enforced by |
|---|---|---|
| `registerProject` | Admin or oracle | `NotAdminOrOracle` custom check |
| `submitVerification` | Oracle only. The admin **cannot** mint | `onlyRole(ORACLE_ROLE)` |
| `flagReversal` | Oracle only | `onlyRole(ORACLE_ROLE)` |
| `setURI`, `grantRole`, `revokeRole` | Admin only | `onlyRole(DEFAULT_ADMIN_ROLE)` |
| `retire`, `safeTransferFrom` | Any holder, for their own balance (or with approval) | ERC-1155 balance and approval checks |

There is no function that mints tokens outside `submitVerification`. Every access-control path has a test (`contracts/test/CanopyCredits.test.ts`, 38 tests, 100% line and branch coverage).

The deploy script refuses to run on Amoy if the oracle address equals the deployer, so the admin and oracle keys are always separate. If the oracle key leaks, the admin revokes `ORACLE_ROLE` and grants it to a new wallet. Credits already issued are unaffected.

## 3. Registration and review controls (backend)

The contract can't see land titles or geometry, so the backend gates what reaches the chain. Every rule below has a test in `backend/tests/test_api.py`, and the browser end-to-end test (`frontend/e2e/run.mjs`) exercises the signed registration, the duplicate refusal and the signed approval against a local chain.

| Risk | Control |
|---|---|
| Registering a forest in someone else's name, or assigning credits to another wallet | The owner wallet signs an EIP-191 message containing the project name, owner address, a keccak256 hash of the boundary, and a timestamp. The backend rebuilds the message and recovers the signer; it must equal the owner. Changing the name or boundary after signing breaks the signature. |
| Replaying a captured signature | Signatures expire 10 minutes after their timestamp. A replayed registration of the same boundary is also caught by the overlap check. |
| **Claiming the same forest twice** | A boundary that overlaps any project that wasn't rejected by more than 1% of the smaller polygon is refused with `409`. Rejected projects free their boundary for the rightful owner. |
| Credits for land the claimant doesn't own | New projects are **pending** and stay off-chain. An approver (any wallet holding `DEFAULT_ADMIN_ROLE` on CanopyCredits, read live from the contract) signs an approve or reject decision after checking documents. Only approval registers the project on-chain. Pending and rejected projects can't be verified or monitored (`403`). |
| **Inflating credits through the methodology inputs** | The regional baseline loss rate and tCO2e/ha are fixed in the signed approval and stored with the project. `POST /verify` takes no parameters, so whoever triggers verification can't change them. The approver's own inputs are bounded (0–10 % / yr, 10–1000 tCO2e/ha). |
| Draining the oracle wallet with requests | Verification runs once per project and vintage; re-checks are limited to one per project every 30 s; only approved projects reach the oracle. |
| Fake reversals through the demo control | "Simulate deforestation" exists for the demo and can be switched off with `CANOPY_DEMO_CONTROLS=0`; a production deployment would run with it off. |

The owner signature and the approver signature are stored with the project, so anyone can re-verify who registered and who approved it.

## 4. Double counting and over-issuance

| Risk | Control |
|---|---|
| Issuing the same forest-year twice | Each `(projectId, vintage)` maps to one token id (`projectId * 10000 + vintage`). `submitVerification` reverts with `AlreadyVerified` if that token id was already issued. |
| Two projects claiming the same id | `registerProject` reverts with `ProjectAlreadyRegistered`. |
| Counting a credit after it is used | `retire` **burns** the tokens and stores a permanent `Retirement` record (`getRetirement`, `CreditsRetired` event). Burned tokens can't be transferred or retired again. |
| Selling credits for a forest that is gone | `flagReversal` marks the project `Reversed`, burns buffer credits, and blocks any new issuance for that project (`ProjectReversed`). |
| Issuing credits for a project nobody registered | `submitVerification` and `flagReversal` revert with `ProjectNotFound`. |

**Overlapping polygons** are refused by the backend (§3). The contract itself can't see geometry, so this check relies on the backend; storing a boundary hash on-chain is listed under future work.

## 5. Buffer pool

10% of every issuance (rounded down) is minted to the contract's **own address**, which implements `ERC1155Holder`. No one holds a key for that address, and the contract never calls `setApprovalForAll` or transfers from itself, so buffer credits can't be sold or moved. The only way they leave is `_burn` inside `flagReversal`. A test checks that the admin and oracle both fail to transfer buffer credits.

If a reversal is larger than the buffer, the burn is capped at the buffer balance and the event reports both `lostCredits` and `bufferBurned`, so the shortfall is visible on-chain. Owner-held and already retired credits are not clawed back. That matches how buffer pools work in voluntary carbon markets, and it is a known limitation (see §9).

## 6. Report integrity (hashing)

The backend builds the verification report as JSON, serialises it canonically (keys sorted, no whitespace, UTF-8), and hashes it with keccak256. The canonical form is specified in `docs/api.md`. The hash goes on-chain in `submitVerification` and `flagReversal`, together with a `reportURI`.

Anyone can fetch the report from the URI, re-serialise it the same way, and check the hash against the `CreditsIssued` or `ReversalFlagged` event. A report that was edited after issuance no longer matches.

The hash proves the report **was not changed**. It does not prove the report **is correct**: that still depends on trusting the oracle (§7). Reports are stored by the backend. If the backend loses them, the hash can't be checked against anything. Pinning reports to IPFS removes that dependency and is the next step.

## 7. Oracle trust

The oracle is the main centralised trust point. A compromised or dishonest oracle could:
- issue credits based on a false report (bounded by one issuance per project and vintage),
- flag false reversals and burn buffer credits,
- register projects that no approver signed off (the approval check runs in the backend, not the contract).

The prototype limits this by:
- separating the oracle key from the admin key, with revocation by the admin,
- requiring an owner signature and an approver signature before the oracle registers anything, both stored for audit,
- keeping the oracle key server-side only (`backend/.env`, never committed, testnet-only wallet with no real value),
- putting every oracle action on-chain with a report hash, so it can be audited after the fact,
- using open data (Sentinel-2 via Microsoft Planetary Computer), so anyone can re-run the analysis for the same polygon and dates.

To decentralise it in production: several independent oracles signing the same report hash (M-of-N), a challenge window before credits become transferable, and a timelock on role changes.

## 8. Smart contract risks

| Risk | Assessment |
|---|---|
| **Reentrancy** | `retire` writes the retirement record before `_burn`, and burns do not call out (no receiver hook on burn). In `submitVerification`, `_mint` calls `onERC1155Received` on the owner if it is a contract, but every state change happens before the mint, and re-entering requires `ORACLE_ROLE`. `flagReversal` burns from the contract itself. No external calls happen before state updates. |
| **Integer overflow** | Solidity 0.8 checked arithmetic. `tokenIdFor` rejects vintages outside 1–9999, so token ids can't collide across projects. |
| **Rounding** | Buffer = `credits * 1000 / 10000`, rounded down. Owner share = `credits - buffer`, so the total minted equals `credits` exactly. Tested with `credits = 9`. |
| **Denial of service** | No loops over user-controlled arrays. |
| **Upgradeability** | The contract is not upgradeable, so there is no proxy admin to compromise. Fixes require a redeploy. |
| **Dependencies** | OpenZeppelin Contracts 5.6.1, pinned in `package-lock.json`. `npm audit` reports advisories in Hardhat's development dependencies. They don't ship in the deployed bytecode. |
| **Front-running** | No price or ordering-sensitive logic. Retirement order does not matter. |

## 9. Known limitations (prototype)

- The carbon methodology is a prototype estimate (NDVI threshold, fixed tCO2e/ha, regional baseline rate). It is not certified and is not meant for real credits.
- Single oracle, single admin. No multisig, timelock or challenge period.
- The owner-signature, overlap and approval checks run in the backend. The contract trusts the oracle to apply them; a future contract version would take the approver's signature and a boundary hash in `registerProject` and verify them on-chain.
- Additionality is approximated by a fixed regional loss rate chosen at approval. A forest that was never at risk can still earn credits if the approver sets a high rate; per-project baselines from the surrounding area's satellite history are future work (see `docs/roadmap.md`).
- Land title is checked by the approver off-chain; the prototype doesn't store the documents.
- Reversals burn only buffer credits. There is no insurance or clawback beyond the buffer.
- Reports live on the backend. IPFS pinning is a stretch goal.
- Testnet only. No audit has been done.
