// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CanopyCredits
/// @notice Satellite-verified forest carbon credits (prototype estimate, NOT a certified methodology).
/// One ERC-1155 token id per (project, vintage): tokenId = projectId * 10000 + vintage.
/// 10% of every issuance is held by this contract as a buffer pool. Buffer credits can only
/// leave the pool by being burned in `flagReversal`.
contract CanopyCredits is ERC1155Supply, ERC1155Holder, AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    uint256 public constant BUFFER_BPS = 1_000; // 10%
    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant TOKEN_ID_MULTIPLIER = 10_000;

    enum ProjectStatus {
        None,
        Active,
        Reversed
    }

    struct Project {
        address owner;
        ProjectStatus status;
        uint64 registeredAt;
        uint256 totalIssued; // credits minted across all vintages, buffer included
        uint256 totalBufferBurned;
        string metadataURI;
    }

    struct Issuance {
        uint256 projectId;
        uint16 vintage;
        uint256 credits; // total minted (owner share + buffer)
        uint256 buffer;
        bytes32 reportHash;
        string reportURI;
        uint64 issuedAt;
    }

    struct Retirement {
        uint256 tokenId;
        address by;
        uint256 amount;
        uint64 retiredAt;
        string beneficiary;
        string reason;
    }

    mapping(uint256 projectId => Project) private _projects;
    mapping(uint256 tokenId => Issuance) private _issuances;
    mapping(uint256 retirementId => Retirement) private _retirements;

    /// @notice Number of retirements so far. Retirement ids start at 1.
    uint256 public retirementCount;

    event ProjectRegistered(uint256 indexed projectId, address indexed owner, string metadataURI);
    event CreditsIssued(
        uint256 indexed projectId,
        uint16 vintage,
        uint256 indexed tokenId,
        uint256 credits,
        uint256 buffer,
        bytes32 reportHash,
        string reportURI
    );
    event CreditsRetired(
        uint256 indexed retirementId,
        uint256 indexed tokenId,
        address indexed by,
        uint256 amount,
        string beneficiary,
        string reason
    );
    event ReversalFlagged(
        uint256 indexed projectId,
        uint16 vintage,
        uint256 lostCredits,
        uint256 bufferBurned,
        bytes32 reportHash
    );

    error NotAdminOrOracle(address account);
    error ZeroAddress();
    error ZeroAmount();
    error InvalidVintage(uint16 vintage);
    error ProjectAlreadyRegistered(uint256 projectId);
    error ProjectNotFound(uint256 projectId);
    error ProjectReversed(uint256 projectId);
    error AlreadyVerified(uint256 projectId, uint16 vintage);
    error NotVerified(uint256 projectId, uint16 vintage);
    error RetirementNotFound(uint256 retirementId);

    constructor(address admin, address oracle, string memory baseURI) ERC1155(baseURI) {
        if (admin == address(0) || oracle == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, oracle);
    }

    // ---------------------------------------------------------------------
    // Projects and issuance
    // ---------------------------------------------------------------------

    function registerProject(uint256 projectId, address owner, string calldata metadataURI) external {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(ORACLE_ROLE, msg.sender)) {
            revert NotAdminOrOracle(msg.sender);
        }
        if (owner == address(0)) revert ZeroAddress();
        Project storage p = _projects[projectId];
        if (p.status != ProjectStatus.None) revert ProjectAlreadyRegistered(projectId);

        p.owner = owner;
        p.status = ProjectStatus.Active;
        p.registeredAt = uint64(block.timestamp);
        p.metadataURI = metadataURI;

        emit ProjectRegistered(projectId, owner, metadataURI);
    }

    /// @notice Records a verification report and mints its credits: 90% to the project owner,
    /// 10% (rounded down) to the buffer pool. Each (project, vintage) can be verified once.
    function submitVerification(
        uint256 projectId,
        uint16 vintage,
        uint256 credits,
        bytes32 reportHash,
        string calldata reportURI
    ) external onlyRole(ORACLE_ROLE) {
        Project storage p = _requireProject(projectId);
        if (p.status == ProjectStatus.Reversed) revert ProjectReversed(projectId);
        if (credits == 0) revert ZeroAmount();

        uint256 tokenId = tokenIdFor(projectId, vintage);
        Issuance storage iss = _issuances[tokenId];
        if (iss.issuedAt != 0) revert AlreadyVerified(projectId, vintage);

        uint256 buffer = (credits * BUFFER_BPS) / BPS_DENOMINATOR;
        uint256 ownerShare = credits - buffer;

        iss.projectId = projectId;
        iss.vintage = vintage;
        iss.credits = credits;
        iss.buffer = buffer;
        iss.reportHash = reportHash;
        iss.reportURI = reportURI;
        iss.issuedAt = uint64(block.timestamp);
        p.totalIssued += credits;

        emit CreditsIssued(projectId, vintage, tokenId, credits, buffer, reportHash, reportURI);

        if (buffer > 0) _mint(address(this), tokenId, buffer, "");
        _mint(p.owner, tokenId, ownerShare, "");
    }

    // ---------------------------------------------------------------------
    // Retirement
    // ---------------------------------------------------------------------

    /// @notice Burns `amount` of `tokenId` from the caller and stores a permanent retirement record.
    function retire(
        uint256 tokenId,
        uint256 amount,
        string calldata beneficiary,
        string calldata reason
    ) external returns (uint256 retirementId) {
        if (amount == 0) revert ZeroAmount();

        retirementId = ++retirementCount;
        _retirements[retirementId] = Retirement({
            tokenId: tokenId,
            by: msg.sender,
            amount: amount,
            retiredAt: uint64(block.timestamp),
            beneficiary: beneficiary,
            reason: reason
        });

        // Reverts with ERC1155InsufficientBalance if the caller holds less than `amount`.
        _burn(msg.sender, tokenId, amount);

        emit CreditsRetired(retirementId, tokenId, msg.sender, amount, beneficiary, reason);
    }

    // ---------------------------------------------------------------------
    // Reversals
    // ---------------------------------------------------------------------

    /// @notice Flags lost forest for a verified vintage: burns up to `lostCredits` from the buffer
    /// pool (capped at its balance) and marks the project as Reversed.
    function flagReversal(
        uint256 projectId,
        uint16 vintage,
        uint256 lostCredits,
        bytes32 reportHash
    ) external onlyRole(ORACLE_ROLE) {
        Project storage p = _requireProject(projectId);
        uint256 tokenId = tokenIdFor(projectId, vintage);
        if (_issuances[tokenId].issuedAt == 0) revert NotVerified(projectId, vintage);
        if (lostCredits == 0) revert ZeroAmount();

        uint256 available = balanceOf(address(this), tokenId);
        uint256 bufferBurned = lostCredits < available ? lostCredits : available;

        p.status = ProjectStatus.Reversed;
        p.totalBufferBurned += bufferBurned;

        if (bufferBurned > 0) _burn(address(this), tokenId, bufferBurned);

        emit ReversalFlagged(projectId, vintage, lostCredits, bufferBurned, reportHash);
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setURI(string calldata newURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newURI);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function tokenIdFor(uint256 projectId, uint16 vintage) public pure returns (uint256) {
        if (vintage == 0 || vintage >= TOKEN_ID_MULTIPLIER) revert InvalidVintage(vintage);
        return projectId * TOKEN_ID_MULTIPLIER + vintage;
    }

    function getProject(uint256 projectId) external view returns (Project memory) {
        return _requireProject(projectId);
    }

    function getIssuance(uint256 tokenId) external view returns (Issuance memory) {
        Issuance memory iss = _issuances[tokenId];
        if (iss.issuedAt == 0) revert NotVerified(tokenId / TOKEN_ID_MULTIPLIER, uint16(tokenId % TOKEN_ID_MULTIPLIER));
        return iss;
    }

    function getRetirement(uint256 retirementId) external view returns (Retirement memory) {
        Retirement memory r = _retirements[retirementId];
        if (r.by == address(0)) revert RetirementNotFound(retirementId);
        return r;
    }

    /// @notice Buffer pool balance for a token id.
    function bufferBalance(uint256 tokenId) external view returns (uint256) {
        return balanceOf(address(this), tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, ERC1155Holder, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _requireProject(uint256 projectId) private view returns (Project storage p) {
        p = _projects[projectId];
        if (p.status == ProjectStatus.None) revert ProjectNotFound(projectId);
    }
}
