# API / Data Contract (v0)

This is the source of truth for everything shared between the frontend/contracts (A) and the backend (B). If you change it, change it in the same PR as the code and tell your teammate.

Backend base URL (dev): `http://localhost:8000`

---

## 1. Verification report (JSON)

The backend produces this report. Its keccak256 hash goes on-chain.

```json
{
  "reportId": "rep_2026-10-20_ab12cd",
  "projectId": 1,
  "polygon": { "type": "Polygon", "coordinates": [[[lng, lat], "..."]] },
  "areaHa": 1250.4,
  "vintage": 2026,
  "baseline": { "date": "2025-10-01", "forestCoverHa": 1180.2, "meanNdvi": 0.71 },
  "current":  { "date": "2026-10-01", "forestCoverHa": 1176.9, "meanNdvi": 0.70 },
  "deforestedHa": 3.3,
  "regionalBaselineLossRatePct": 2.1,
  "avoidedLossHa": 21.5,
  "tco2ePerHa": 450,
  "creditsEstimated": 9675,
  "methodology": "canopychain-prototype-v0 (NOT a certified methodology)",
  "imagery": {
    "source": "sentinel-2-l2a (Microsoft Planetary Computer)",
    "baselineSceneIds": ["..."],
    "currentSceneIds": ["..."],
    "previewBaselineUrl": "/api/reports/rep_.../baseline.png",
    "previewCurrentUrl": "/api/reports/rep_.../current.png"
  },
  "status": "verified | reversal_detected | failed",
  "createdAt": "2026-10-20T12:00:00Z",
  "reportHash": "0x… (keccak256 of the canonical JSON without this field)"
}
```

Prototype methodology: `credits = avoidedLossHa × tco2ePerHa`. Avoided loss is the regional baseline loss rate minus the observed loss (minimum 0). 1 credit = 1 tCO2e.

---

## 2. REST API (backend, owner B)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects` | Register a project. Body: `{ "name", "owner" (wallet address), "polygon" (GeoJSON) }` → `{ "projectId" }` |
| `GET` | `/api/projects` | List projects with their latest report summary |
| `GET` | `/api/projects/{id}` | Project, plus all of its reports |
| `POST` | `/api/projects/{id}/verify` | Run verification → returns a **Verification report**. If `status == verified`, the oracle submits it on-chain and the response includes `txHash`. |
| `POST` | `/api/projects/{id}/monitor` | Re-check the forest. Query `?simulateDeforestation=true` for the demo. If a loss is found, the oracle calls `flagReversal`. |
| `GET` | `/api/reports/{reportId}` | Full report JSON |
| `GET` | `/api/reports/{reportId}/{baseline,current}.png` | NDVI preview images |

Errors: `{ "error": "message" }` with status `400`, `404` or `500`.
CORS: allow `http://localhost:3000`.

---

## 3. Smart contract interface (owner A)

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
