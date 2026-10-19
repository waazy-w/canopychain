import { parseAbi } from "viem";

// Hand-typed subset of CanopyCredits (contracts/contracts/CanopyCredits.sol, docs/api.md §3) so that
// reads, writes and logs are fully typed even before the ABI is published to shared/contracts.json.
// scripts/sync-contracts.mjs warns if the deployed ABI is missing any of these.
export const canopyCreditsAbi = parseAbi([
  "struct Project { address owner; uint8 status; uint64 registeredAt; uint256 totalIssued; uint256 totalBufferBurned; string metadataURI; }",
  "struct Issuance { uint256 projectId; uint16 vintage; uint256 credits; uint256 buffer; bytes32 reportHash; string reportURI; uint64 issuedAt; }",
  "struct Retirement { uint256 tokenId; address by; uint256 amount; uint64 retiredAt; string beneficiary; string reason; }",
  "function getProject(uint256 projectId) view returns (Project)",
  "function getIssuance(uint256 tokenId) view returns (Issuance)",
  "function getRetirement(uint256 retirementId) view returns (Retirement)",
  "function tokenIdFor(uint256 projectId, uint16 vintage) pure returns (uint256)",
  "function bufferBalance(uint256 tokenId) view returns (uint256)",
  "function retirementCount() view returns (uint256)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function totalSupply(uint256 id) view returns (uint256)",
  "function retire(uint256 tokenId, uint256 amount, string beneficiary, string reason) returns (uint256 retirementId)",
  "event ProjectRegistered(uint256 indexed projectId, address indexed owner, string metadataURI)",
  "event CreditsIssued(uint256 indexed projectId, uint16 vintage, uint256 indexed tokenId, uint256 credits, uint256 buffer, bytes32 reportHash, string reportURI)",
  "event CreditsRetired(uint256 indexed retirementId, uint256 indexed tokenId, address indexed by, uint256 amount, string beneficiary, string reason)",
  "event ReversalFlagged(uint256 indexed projectId, uint16 vintage, uint256 lostCredits, uint256 bufferBurned, bytes32 reportHash)",
  "error NotAdminOrOracle(address account)",
  "error ZeroAddress()",
  "error ZeroAmount()",
  "error InvalidVintage(uint16 vintage)",
  "error ProjectAlreadyRegistered(uint256 projectId)",
  "error ProjectNotFound(uint256 projectId)",
  "error ProjectReversed(uint256 projectId)",
  "error AlreadyVerified(uint256 projectId, uint16 vintage)",
  "error NotVerified(uint256 projectId, uint16 vintage)",
  "error RetirementNotFound(uint256 retirementId)",
  "error ERC1155InsufficientBalance(address sender, uint256 balance, uint256 needed, uint256 tokenId)",
]);
