# API / Data Contract (v0)

This is the source of truth for the interfaces between the contracts, the frontend and the backend. If you change one, change this file in the same PR as the code.

Backend base URL (dev): `http://localhost:8000`

---

## 1. Verification report (JSON)

The backend produces this report. Its keccak256 hash goes on-chain.

```json
{
  "reportId": "rep_2026-10-20_ab12cd",
  "kind": "verification | monitoring",
  "projectId": 1,
  "polygon": { "type": "Polygon", "coordinates": [[[lng, lat], "..."]] },
  "areaHa": 1250.4,
  "vintage": 2026,
  "baseline": { "date": "2025-10-11", "targetDate": "2025-10-01", "forestCoverHa": 1180.2, "meanNdvi": 0.71, "validCoveragePct": 100.0 },
  "current":  { "date": "2026-10-01", "targetDate": "2026-10-01", "forestCoverHa": 1176.9, "meanNdvi": 0.70, "validCoveragePct": 98.7 },
  "deforestedHa": 3.3,
  "regionalBaselineLossRatePct": 2.1,
  "avoidedLossHa": 21.48,
  "tco2ePerHa": 450,
  "creditsEstimated": 9668,
  "methodology": "canopychain-prototype-v0 (NOT a certified methodology)",
  "imagery": {
    "source": "sentinel-2-l2a (Microsoft Planetary Computer)",
    "baselineSceneIds": ["..."],
    "currentSceneIds": ["..."],
    "previewBaselineUrl": "/api/reports/rep_.../baseline.png",
    "previewCurrentUrl": "/api/reports/rep_.../current.png",
    "previewBounds": [[-7.2145, -60.6145], [-7.1855, -60.5855]],
    "pixelSizeM": 10.0,
    "simulatedDeforestation": false
  },
  "status": "verified | reversal_detected",
  "createdAt": "2026-10-20T12:00:00Z",
  "reportHash": "0x… (see Report hashing)",
  "txHash": "0x… | null",
  "onChainError": "string | null"
}
```

- `date` is the acquisition date of the main Sentinel-2 scene. `targetDate` is what was asked for: the 1st of the current month for `current`, one year earlier for `baseline`. Vintage = year of `current.targetDate`.
- `validCoveragePct`: share of the polygon with a cloud-free observation (several scenes are mosaicked, least cloudy first).
- `previewBounds` is `[[south, west], [north, east]]` in WGS84, ready for a Leaflet `imageOverlay`. Preview PNGs are 512 px on the long side, NDVI red → yellow → green, transparent outside the polygon, grey where clouded.
- `txHash` / `onChainError` are filled in after the oracle runs. `txHash` is `null` when nothing was sent, and `onChainError` says why (e.g. `oracle disabled: …`, `0 credits estimated: nothing to mint`).
- Monitoring reports (`kind: "monitoring"`) also carry `newlyDeforestedHa` (loss beyond what the reference verification already counted), `reversalOfReportId` (that verification), and `lostCredits` (integer, what was passed to `flagReversal`). Their `vintage` is the vintage being reversed.

Prototype methodology (not certified):
- Forest pixel: NDVI ≥ 0.6 (Sentinel-2 L2A, B08/B04, SCL classes 0, 3, 8, 9, 10 masked). 10 m pixels.
- Deforested pixel: forest at baseline, below 0.6 now, **and** NDVI dropped by at least 0.2, so pixels hovering around the threshold don't count as loss.
- `avoidedLossHa = max(0, baseline.forestCoverHa × regionalBaselineLossRatePct / 100 − deforestedHa)`
- `creditsEstimated = round(avoidedLossHa × tco2ePerHa)`. 1 credit = 1 tCO2e.
- Monitoring: `lostCredits = round(newlyDeforestedHa × tco2ePerHa)`. Simulated deforestation clears a contiguous ~15% of the current forest pixels, growing from the north-west corner of the polygon.

### Report hashing

```python
body = {k: v for k, v in report.items() if k not in ("reportHash", "txHash", "onChainError", "lostCredits")}
body = whole_number_floats_as_ints(body)   # 450.0 -> 450, recursively, like JSON.stringify
canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
reportHash = "0x" + keccak256(canonical).hex()
```

This is the `reportHash` passed to `submitVerification` / `flagReversal`. To check a report, fetch `GET /api/reports/{reportId}` and recompute. In JavaScript: drop the four fields above, sort object keys recursively, `JSON.stringify` with no spacing, UTF-8 encode, then `keccak256`. Both languages produce the same bytes.

---

## 2. REST API (backend)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects` | Register a project. Body: `{ "name", "owner" (wallet address), "polygon" (GeoJSON Polygon, or a Feature wrapping one; 1–50,000 ha) }` → `{ "projectId", "txHash", "onChainError" }`. The oracle calls `registerProject(projectId, owner, "<PUBLIC_BASE_URL>/api/projects/{id}")`. |
| `GET` | `/api/projects` | List of projects (see below) |
| `GET` | `/api/projects/{id}` | One project, plus `"reports"`: its full reports, newest first |
| `POST` | `/api/projects/{id}/verify` | Run verification → the **report** above. Optional body `{ "regionalBaselineLossRatePct", "tco2ePerHa" }`. If credits > 0 the oracle registers the project on-chain if needed, then calls `submitVerification`. **409** if this project's vintage is already verified (an earlier off-chain-only verification can be redone once the oracle is live). |
| `POST` | `/api/projects/{id}/monitor` | Re-check the forest → a **monitoring report**. `?simulateDeforestation=true` for the demo. If `lostCredits > 0`: `status = "reversal_detected"`, the project becomes `"reversed"`, and the oracle calls `flagReversal`. **400** if the project was never verified. |
| `GET` | `/api/reports/{reportId}` | Full report JSON |
| `GET` | `/api/reports/{reportId}/{baseline,current}.png` | NDVI preview images |
| `GET` | `/api/health` | `{ "ok", "oracleEnabled", "oracleDisabledReason" }` |

Project object (list and detail):
```json
{
  "projectId": 1, "name": "…", "owner": "0x… (checksummed)", "polygon": { "type": "Polygon", "coordinates": [] },
  "areaHa": 1024.1, "createdAt": "2026-10-19T12:00:00Z", "status": "active | reversed",
  "onChainRegistered": true, "registerTxHash": "0x… | null",
  "latestReport": { "reportId", "kind", "status", "creditsEstimated", "vintage", "txHash", "createdAt" } | null
}
```

Errors: `{ "error": "message" }` with status `400` (validation), `404`, `409` (already verified) or `500` (e.g. satellite analysis failed: no clear scene, Planetary Computer unreachable). No fake data is ever returned.
CORS: allow `http://localhost:3000`.

Speed: a live verification of a ~1,000 ha polygon takes ~10 s (two Planetary Computer reads). The two demo forests in `backend/app/demo_forests.py` are cached in `backend/demo_cache` and return instantly.

---

## 3. Smart contract interface

The ABI and deployed address live in `shared/contracts.json`:

```json
{ "chainId": 80002, "CanopyCredits": { "address": "0x…", "deployBlock": 0, "deployTx": "0x…", "abi": [] } }
```

Written by `contracts/scripts/deploy.ts` (`npm run deploy:amoy`). Use `deployBlock` as the `fromBlock` when reading events.

### `CanopyCredits` (ERC-1155 + AccessControl)

Roles: `DEFAULT_ADMIN_ROLE`, `ORACLE_ROLE` (held by the backend oracle wallet).

Token id = `projectId * 10000 + vintage`.

```solidity
function registerProject(uint256 projectId, address owner, string calldata metadataURI) external; // admin or oracle
function submitVerification(uint256 projectId, uint16 vintage, uint256 credits, bytes32 reportHash, string calldata reportURI) external; // ORACLE_ROLE
// mints 90% to project owner and 10% to the buffer pool; reverts if (projectId, vintage) was already verified
function retire(uint256 tokenId, uint256 amount, string calldata beneficiary, string calldata reason) external;
// burns from msg.sender and stores a Retirement record; returns retirementId
function flagReversal(uint256 projectId, uint16 vintage, uint256 lostCredits, bytes32 reportHash) external; // ORACLE_ROLE
// burns from the buffer pool (up to its balance) and sets the project status to Reversed
function getProject(uint256 projectId) external view returns (Project memory);       // reverts ProjectNotFound
function getRetirement(uint256 retirementId) external view returns (Retirement memory); // reverts RetirementNotFound
function getIssuance(uint256 tokenId) external view returns (Issuance memory);       // reverts NotVerified
function tokenIdFor(uint256 projectId, uint16 vintage) external pure returns (uint256); // vintage must be 1..9999
function bufferBalance(uint256 tokenId) external view returns (uint256);
function retirementCount() external view returns (uint256); // retirement ids start at 1
function totalSupply(uint256 tokenId) external view returns (uint256);                // ERC1155Supply
```

Structs and buffer rules:
```solidity
enum ProjectStatus { None, Active, Reversed }
struct Project    { address owner; ProjectStatus status; uint64 registeredAt; uint256 totalIssued; uint256 totalBufferBurned; string metadataURI; }
struct Issuance   { uint256 projectId; uint16 vintage; uint256 credits; uint256 buffer; bytes32 reportHash; string reportURI; uint64 issuedAt; }
struct Retirement { uint256 tokenId; address by; uint256 amount; uint64 retiredAt; string beneficiary; string reason; }
```
- `credits` in `submitVerification` / `CreditsIssued` is the **total** minted. `buffer = credits / 10` (rounded down) goes to the buffer pool, and the owner gets `credits - buffer`.
- The buffer pool is the contract's own address. Nobody can transfer from it. Only `flagReversal` burns from it.
- A `Reversed` project can't receive new issuance. Credits already issued (and retirements) stay valid.
- Reverts use custom errors: `NotAdminOrOracle`, `ZeroAddress`, `ZeroAmount`, `InvalidVintage`, `ProjectAlreadyRegistered`, `ProjectNotFound`, `ProjectReversed`, `AlreadyVerified`, `NotVerified`, `RetirementNotFound`, plus OpenZeppelin's `AccessControlUnauthorizedAccount` and `ERC1155InsufficientBalance`.

Events (the frontend registry is built from these):
```solidity
event ProjectRegistered(uint256 indexed projectId, address indexed owner, string metadataURI);
event CreditsIssued(uint256 indexed projectId, uint16 vintage, uint256 indexed tokenId, uint256 credits, uint256 buffer, bytes32 reportHash, string reportURI);
event CreditsRetired(uint256 indexed retirementId, uint256 indexed tokenId, address indexed by, uint256 amount, string beneficiary, string reason);
event ReversalFlagged(uint256 indexed projectId, uint16 vintage, uint256 lostCredits, uint256 bufferBurned, bytes32 reportHash);
```

Transfers and trading use standard ERC-1155 `safeTransferFrom`. A marketplace is a stretch goal.

---

## Changelog
- v0 (Oct 19): initial draft
- v0.1 (Oct 19): contract section matches `CanopyCredits.sol`. Added structs, `getIssuance`, `tokenIdFor`, `bufferBalance`, `retirementCount`, `totalSupply`, the buffer rounding rule and custom errors. Nothing removed or renamed.
- v0.2 (Oct 19): `shared/contracts.json` gains `deployBlock` and `deployTx`.
- v0.3 (Oct 19): backend implemented. Report gains `kind`, `targetDate`, `validCoveragePct`, `imagery.previewBounds/pixelSizeM/simulatedDeforestation`, `txHash`, `onChainError`, and for monitoring `newlyDeforestedHa`, `reversalOfReportId`, `lostCredits`. `status: "failed"` dropped (failures are HTTP 500). Report hashing rule, project object, 409 on double verification, `/api/health` and methodology details documented.
