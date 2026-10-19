import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

const PROJECT_ID = 1n;
const VINTAGE = 2026;
const TOKEN_ID = PROJECT_ID * 10000n + BigInt(VINTAGE);
const CREDITS = 9675n;
const BUFFER = 967n; // floor(9675 * 10%)
const OWNER_SHARE = CREDITS - BUFFER;
const REPORT_HASH = ethers.keccak256(ethers.toUtf8Bytes("report-1"));
const REVERSAL_HASH = ethers.keccak256(ethers.toUtf8Bytes("reversal-1"));
const REPORT_URI = "http://localhost:8000/api/reports/rep_1";
const METADATA_URI = "http://localhost:8000/api/projects/1";

enum Status {
  None,
  Active,
  Reversed,
}

describe("CanopyCredits", function () {
  async function deployFixture() {
    const [admin, oracle, projectOwner, buyer, stranger] = await ethers.getSigners();
    const credits = await ethers.deployContract("CanopyCredits", [
      admin.address,
      oracle.address,
      "https://canopychain.example/token/{id}.json",
    ]);
    const ORACLE_ROLE = await credits.ORACLE_ROLE();
    const DEFAULT_ADMIN_ROLE = await credits.DEFAULT_ADMIN_ROLE();
    return { credits, admin, oracle, projectOwner, buyer, stranger, ORACLE_ROLE, DEFAULT_ADMIN_ROLE };
  }

  async function registeredFixture() {
    const f = await deployFixture();
    await f.credits.connect(f.oracle).registerProject(PROJECT_ID, f.projectOwner.address, METADATA_URI);
    return f;
  }

  async function verifiedFixture() {
    const f = await registeredFixture();
    await f.credits.connect(f.oracle).submitVerification(PROJECT_ID, VINTAGE, CREDITS, REPORT_HASH, REPORT_URI);
    return f;
  }

  describe("deployment", function () {
    it("grants admin and oracle roles", async function () {
      const { credits, admin, oracle, ORACLE_ROLE, DEFAULT_ADMIN_ROLE } = await loadFixture(deployFixture);
      expect(await credits.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.equal(true);
      expect(await credits.hasRole(ORACLE_ROLE, oracle.address)).to.equal(true);
      expect(await credits.hasRole(ORACLE_ROLE, admin.address)).to.equal(false);
    });

    it("rejects zero addresses", async function () {
      const [admin] = await ethers.getSigners();
      const factory = await ethers.getContractFactory("CanopyCredits");
      await expect(factory.deploy(ethers.ZeroAddress, admin.address, "")).to.be.revertedWithCustomError(
        factory,
        "ZeroAddress",
      );
      await expect(factory.deploy(admin.address, ethers.ZeroAddress, "")).to.be.revertedWithCustomError(
        factory,
        "ZeroAddress",
      );
    });

    it("supports ERC-1155, ERC-1155 receiver and AccessControl interfaces", async function () {
      const { credits } = await loadFixture(deployFixture);
      expect(await credits.supportsInterface("0xd9b67a26")).to.equal(true); // IERC1155
      expect(await credits.supportsInterface("0x4e2312e0")).to.equal(true); // IERC1155Receiver
      expect(await credits.supportsInterface("0x7965db0b")).to.equal(true); // IAccessControl
      expect(await credits.supportsInterface("0xffffffff")).to.equal(false);
    });
  });

  describe("tokenIdFor", function () {
    it("computes projectId * 10000 + vintage", async function () {
      const { credits } = await loadFixture(deployFixture);
      expect(await credits.tokenIdFor(PROJECT_ID, VINTAGE)).to.equal(TOKEN_ID);
      expect(await credits.tokenIdFor(42, 2025)).to.equal(422025n);
    });

    it("rejects vintage 0 and vintages >= 10000", async function () {
      const { credits } = await loadFixture(deployFixture);
      await expect(credits.tokenIdFor(1, 0)).to.be.revertedWithCustomError(credits, "InvalidVintage").withArgs(0);
      await expect(credits.tokenIdFor(1, 10000))
        .to.be.revertedWithCustomError(credits, "InvalidVintage")
        .withArgs(10000);
    });
  });

  describe("registerProject", function () {
    it("lets the oracle register a project and emits ProjectRegistered", async function () {
      const { credits, oracle, projectOwner } = await loadFixture(deployFixture);
      await expect(credits.connect(oracle).registerProject(PROJECT_ID, projectOwner.address, METADATA_URI))
        .to.emit(credits, "ProjectRegistered")
        .withArgs(PROJECT_ID, projectOwner.address, METADATA_URI);

      const p = await credits.getProject(PROJECT_ID);
      expect(p.owner).to.equal(projectOwner.address);
      expect(p.status).to.equal(Status.Active);
      expect(p.metadataURI).to.equal(METADATA_URI);
      expect(p.registeredAt).to.be.greaterThan(0n);
      expect(p.totalIssued).to.equal(0n);
    });

    it("lets the admin register a project", async function () {
      const { credits, admin, projectOwner } = await loadFixture(deployFixture);
      await expect(credits.connect(admin).registerProject(7, projectOwner.address, "")).to.emit(
        credits,
        "ProjectRegistered",
      );
    });

    it("rejects callers without admin or oracle role", async function () {
      const { credits, stranger, projectOwner } = await loadFixture(deployFixture);
      await expect(credits.connect(stranger).registerProject(PROJECT_ID, projectOwner.address, METADATA_URI))
        .to.be.revertedWithCustomError(credits, "NotAdminOrOracle")
        .withArgs(stranger.address);
    });

    it("rejects a zero owner", async function () {
      const { credits, oracle } = await loadFixture(deployFixture);
      await expect(
        credits.connect(oracle).registerProject(PROJECT_ID, ethers.ZeroAddress, METADATA_URI),
      ).to.be.revertedWithCustomError(credits, "ZeroAddress");
    });

    it("rejects registering the same project twice", async function () {
      const { credits, admin, buyer } = await loadFixture(registeredFixture);
      await expect(credits.connect(admin).registerProject(PROJECT_ID, buyer.address, ""))
        .to.be.revertedWithCustomError(credits, "ProjectAlreadyRegistered")
        .withArgs(PROJECT_ID);
    });

    it("getProject reverts for an unknown project", async function () {
      const { credits } = await loadFixture(deployFixture);
      await expect(credits.getProject(99)).to.be.revertedWithCustomError(credits, "ProjectNotFound").withArgs(99);
    });
  });

  describe("submitVerification", function () {
    it("mints 90% to the owner and 10% to the buffer pool", async function () {
      const { credits, oracle, projectOwner } = await loadFixture(registeredFixture);
      const tx = credits.connect(oracle).submitVerification(PROJECT_ID, VINTAGE, CREDITS, REPORT_HASH, REPORT_URI);

      await expect(tx)
        .to.emit(credits, "CreditsIssued")
        .withArgs(PROJECT_ID, VINTAGE, TOKEN_ID, CREDITS, BUFFER, REPORT_HASH, REPORT_URI);

      expect(await credits.balanceOf(projectOwner.address, TOKEN_ID)).to.equal(OWNER_SHARE);
      expect(await credits.balanceOf(await credits.getAddress(), TOKEN_ID)).to.equal(BUFFER);
      expect(await credits.bufferBalance(TOKEN_ID)).to.equal(BUFFER);
      expect(await credits["totalSupply(uint256)"](TOKEN_ID)).to.equal(CREDITS);
    });

    it("stores the issuance and updates project totals", async function () {
      const { credits } = await loadFixture(verifiedFixture);
      const iss = await credits.getIssuance(TOKEN_ID);
      expect(iss.projectId).to.equal(PROJECT_ID);
      expect(iss.vintage).to.equal(VINTAGE);
      expect(iss.credits).to.equal(CREDITS);
      expect(iss.buffer).to.equal(BUFFER);
      expect(iss.reportHash).to.equal(REPORT_HASH);
      expect(iss.reportURI).to.equal(REPORT_URI);
      expect(iss.issuedAt).to.be.greaterThan(0n);
      expect((await credits.getProject(PROJECT_ID)).totalIssued).to.equal(CREDITS);
    });

    it("rounds the buffer down and gives the remainder to the owner", async function () {
      const { credits, oracle, projectOwner } = await loadFixture(registeredFixture);
      await credits.connect(oracle).submitVerification(PROJECT_ID, VINTAGE, 9, REPORT_HASH, REPORT_URI);
      expect(await credits.bufferBalance(TOKEN_ID)).to.equal(0n);
      expect(await credits.balanceOf(projectOwner.address, TOKEN_ID)).to.equal(9n);
    });

    it("allows different vintages of the same project", async function () {
      const { credits, oracle, projectOwner } = await loadFixture(verifiedFixture);
      await credits.connect(oracle).submitVerification(PROJECT_ID, 2027, 100, REPORT_HASH, REPORT_URI);
      expect(await credits.balanceOf(projectOwner.address, PROJECT_ID * 10000n + 2027n)).to.equal(90n);
      expect((await credits.getProject(PROJECT_ID)).totalIssued).to.equal(CREDITS + 100n);
    });

    it("rejects verifying the same project and vintage twice", async function () {
      const { credits, oracle } = await loadFixture(verifiedFixture);
      await expect(credits.connect(oracle).submitVerification(PROJECT_ID, VINTAGE, CREDITS, REPORT_HASH, REPORT_URI))
        .to.be.revertedWithCustomError(credits, "AlreadyVerified")
        .withArgs(PROJECT_ID, VINTAGE);
    });

    it("rejects callers without the oracle role, including the admin", async function () {
      const { credits, admin, stranger, ORACLE_ROLE } = await loadFixture(registeredFixture);
      for (const signer of [admin, stranger]) {
        await expect(
          credits.connect(signer).submitVerification(PROJECT_ID, VINTAGE, CREDITS, REPORT_HASH, REPORT_URI),
        )
          .to.be.revertedWithCustomError(credits, "AccessControlUnauthorizedAccount")
          .withArgs(signer.address, ORACLE_ROLE);
      }
    });

    it("rejects unknown projects", async function () {
      const { credits, oracle } = await loadFixture(deployFixture);
      await expect(credits.connect(oracle).submitVerification(5, VINTAGE, CREDITS, REPORT_HASH, REPORT_URI))
        .to.be.revertedWithCustomError(credits, "ProjectNotFound")
        .withArgs(5);
    });

    it("rejects zero credits", async function () {
      const { credits, oracle } = await loadFixture(registeredFixture);
      await expect(
        credits.connect(oracle).submitVerification(PROJECT_ID, VINTAGE, 0, REPORT_HASH, REPORT_URI),
      ).to.be.revertedWithCustomError(credits, "ZeroAmount");
    });

    it("rejects an invalid vintage", async function () {
      const { credits, oracle } = await loadFixture(registeredFixture);
      await expect(credits.connect(oracle).submitVerification(PROJECT_ID, 0, CREDITS, REPORT_HASH, REPORT_URI))
        .to.be.revertedWithCustomError(credits, "InvalidVintage")
        .withArgs(0);
    });

    it("rejects new issuance for a reversed project", async function () {
      const { credits, oracle } = await loadFixture(verifiedFixture);
      await credits.connect(oracle).flagReversal(PROJECT_ID, VINTAGE, 10, REVERSAL_HASH);
      await expect(credits.connect(oracle).submitVerification(PROJECT_ID, 2027, CREDITS, REPORT_HASH, REPORT_URI))
        .to.be.revertedWithCustomError(credits, "ProjectReversed")
        .withArgs(PROJECT_ID);
    });

    it("getIssuance reverts for an unverified token id", async function () {
      const { credits } = await loadFixture(registeredFixture);
      await expect(credits.getIssuance(TOKEN_ID))
        .to.be.revertedWithCustomError(credits, "NotVerified")
        .withArgs(PROJECT_ID, VINTAGE);
    });
  });

  describe("retire", function () {
    it("burns credits, stores a retirement and emits CreditsRetired", async function () {
      const { credits, projectOwner } = await loadFixture(verifiedFixture);
      await expect(credits.connect(projectOwner).retire(TOKEN_ID, 100, "Acme Corp", "2026 offset"))
        .to.emit(credits, "CreditsRetired")
        .withArgs(1, TOKEN_ID, projectOwner.address, 100, "Acme Corp", "2026 offset");

      expect(await credits.balanceOf(projectOwner.address, TOKEN_ID)).to.equal(OWNER_SHARE - 100n);
      expect(await credits["totalSupply(uint256)"](TOKEN_ID)).to.equal(CREDITS - 100n);
      expect(await credits.retirementCount()).to.equal(1n);

      const r = await credits.getRetirement(1);
      expect(r.tokenId).to.equal(TOKEN_ID);
      expect(r.by).to.equal(projectOwner.address);
      expect(r.amount).to.equal(100n);
      expect(r.beneficiary).to.equal("Acme Corp");
      expect(r.reason).to.equal("2026 offset");
      expect(r.retiredAt).to.be.greaterThan(0n);
    });

    it("returns sequential retirement ids", async function () {
      const { credits, projectOwner } = await loadFixture(verifiedFixture);
      const id = await credits.connect(projectOwner).retire.staticCall(TOKEN_ID, 1, "a", "b");
      expect(id).to.equal(1n);
      await credits.connect(projectOwner).retire(TOKEN_ID, 1, "a", "b");
      await expect(credits.connect(projectOwner).retire(TOKEN_ID, 2, "c", "d"))
        .to.emit(credits, "CreditsRetired")
        .withArgs(2, TOKEN_ID, projectOwner.address, 2, "c", "d");
    });

    it("lets a buyer retire credits transferred to them", async function () {
      const { credits, projectOwner, buyer } = await loadFixture(verifiedFixture);
      await credits
        .connect(projectOwner)
        .safeTransferFrom(projectOwner.address, buyer.address, TOKEN_ID, 50, "0x");
      await expect(credits.connect(buyer).retire(TOKEN_ID, 50, "Buyer Ltd", "")).to.emit(credits, "CreditsRetired");
      expect(await credits.balanceOf(buyer.address, TOKEN_ID)).to.equal(0n);
    });

    it("rejects retiring more than the caller's balance", async function () {
      const { credits, buyer, projectOwner } = await loadFixture(verifiedFixture);
      await expect(credits.connect(projectOwner).retire(TOKEN_ID, OWNER_SHARE + 1n, "x", "y"))
        .to.be.revertedWithCustomError(credits, "ERC1155InsufficientBalance")
        .withArgs(projectOwner.address, OWNER_SHARE, OWNER_SHARE + 1n, TOKEN_ID);
      await expect(credits.connect(buyer).retire(TOKEN_ID, 1, "x", "y")).to.be.revertedWithCustomError(
        credits,
        "ERC1155InsufficientBalance",
      );
      expect(await credits.retirementCount()).to.equal(0n);
    });

    it("rejects a zero amount", async function () {
      const { credits, projectOwner } = await loadFixture(verifiedFixture);
      await expect(credits.connect(projectOwner).retire(TOKEN_ID, 0, "x", "y")).to.be.revertedWithCustomError(
        credits,
        "ZeroAmount",
      );
    });

    it("getRetirement reverts for an unknown id", async function () {
      const { credits } = await loadFixture(verifiedFixture);
      await expect(credits.getRetirement(1)).to.be.revertedWithCustomError(credits, "RetirementNotFound").withArgs(1);
    });
  });

  describe("flagReversal", function () {
    it("burns lost credits from the buffer and marks the project Reversed", async function () {
      const { credits, oracle, projectOwner } = await loadFixture(verifiedFixture);
      await expect(credits.connect(oracle).flagReversal(PROJECT_ID, VINTAGE, 300, REVERSAL_HASH))
        .to.emit(credits, "ReversalFlagged")
        .withArgs(PROJECT_ID, VINTAGE, 300, 300, REVERSAL_HASH);

      expect(await credits.bufferBalance(TOKEN_ID)).to.equal(BUFFER - 300n);
      expect(await credits.balanceOf(projectOwner.address, TOKEN_ID)).to.equal(OWNER_SHARE); // owner untouched
      const p = await credits.getProject(PROJECT_ID);
      expect(p.status).to.equal(Status.Reversed);
      expect(p.totalBufferBurned).to.equal(300n);
    });

    it("caps the burn at the buffer balance when the loss is larger", async function () {
      const { credits, oracle } = await loadFixture(verifiedFixture);
      await expect(credits.connect(oracle).flagReversal(PROJECT_ID, VINTAGE, BUFFER * 5n, REVERSAL_HASH))
        .to.emit(credits, "ReversalFlagged")
        .withArgs(PROJECT_ID, VINTAGE, BUFFER * 5n, BUFFER, REVERSAL_HASH);
      expect(await credits.bufferBalance(TOKEN_ID)).to.equal(0n);

      // A further reversal with an empty buffer burns nothing but still succeeds.
      await expect(credits.connect(oracle).flagReversal(PROJECT_ID, VINTAGE, 10, REVERSAL_HASH))
        .to.emit(credits, "ReversalFlagged")
        .withArgs(PROJECT_ID, VINTAGE, 10, 0, REVERSAL_HASH);
      expect((await credits.getProject(PROJECT_ID)).totalBufferBurned).to.equal(BUFFER);
    });

    it("leaves retired credits and retirement records intact", async function () {
      const { credits, oracle, projectOwner } = await loadFixture(verifiedFixture);
      await credits.connect(projectOwner).retire(TOKEN_ID, 10, "x", "y");
      await credits.connect(oracle).flagReversal(PROJECT_ID, VINTAGE, BUFFER, REVERSAL_HASH);
      expect((await credits.getRetirement(1)).amount).to.equal(10n);
    });

    it("rejects callers without the oracle role, including the admin", async function () {
      const { credits, admin, stranger, ORACLE_ROLE } = await loadFixture(verifiedFixture);
      for (const signer of [admin, stranger]) {
        await expect(credits.connect(signer).flagReversal(PROJECT_ID, VINTAGE, 10, REVERSAL_HASH))
          .to.be.revertedWithCustomError(credits, "AccessControlUnauthorizedAccount")
          .withArgs(signer.address, ORACLE_ROLE);
      }
    });

    it("rejects unknown projects and unverified vintages", async function () {
      const { credits, oracle } = await loadFixture(verifiedFixture);
      await expect(credits.connect(oracle).flagReversal(99, VINTAGE, 10, REVERSAL_HASH))
        .to.be.revertedWithCustomError(credits, "ProjectNotFound")
        .withArgs(99);
      await expect(credits.connect(oracle).flagReversal(PROJECT_ID, 2030, 10, REVERSAL_HASH))
        .to.be.revertedWithCustomError(credits, "NotVerified")
        .withArgs(PROJECT_ID, 2030);
    });

    it("rejects zero lost credits", async function () {
      const { credits, oracle } = await loadFixture(verifiedFixture);
      await expect(
        credits.connect(oracle).flagReversal(PROJECT_ID, VINTAGE, 0, REVERSAL_HASH),
      ).to.be.revertedWithCustomError(credits, "ZeroAmount");
    });
  });

  describe("access control administration", function () {
    it("lets the admin grant and revoke the oracle role", async function () {
      const { credits, admin, stranger, projectOwner, ORACLE_ROLE } = await loadFixture(deployFixture);
      await credits.connect(admin).grantRole(ORACLE_ROLE, stranger.address);
      await expect(credits.connect(stranger).registerProject(3, projectOwner.address, "")).to.emit(
        credits,
        "ProjectRegistered",
      );
      await credits.connect(admin).revokeRole(ORACLE_ROLE, stranger.address);
      await expect(credits.connect(stranger).registerProject(4, projectOwner.address, ""))
        .to.be.revertedWithCustomError(credits, "NotAdminOrOracle")
        .withArgs(stranger.address);
    });

    it("rejects role grants from non-admins", async function () {
      const { credits, oracle, stranger, ORACLE_ROLE, DEFAULT_ADMIN_ROLE } = await loadFixture(deployFixture);
      await expect(credits.connect(oracle).grantRole(ORACLE_ROLE, stranger.address))
        .to.be.revertedWithCustomError(credits, "AccessControlUnauthorizedAccount")
        .withArgs(oracle.address, DEFAULT_ADMIN_ROLE);
    });

    it("lets only the admin update the URI", async function () {
      const { credits, admin, oracle, DEFAULT_ADMIN_ROLE } = await loadFixture(deployFixture);
      await credits.connect(admin).setURI("ipfs://new/{id}.json");
      expect(await credits.uri(TOKEN_ID)).to.equal("ipfs://new/{id}.json");
      await expect(credits.connect(oracle).setURI("x"))
        .to.be.revertedWithCustomError(credits, "AccessControlUnauthorizedAccount")
        .withArgs(oracle.address, DEFAULT_ADMIN_ROLE);
    });
  });

  describe("buffer pool safety", function () {
    it("cannot be moved by anyone via transfers", async function () {
      const { credits, admin, oracle } = await loadFixture(verifiedFixture);
      const pool = await credits.getAddress();
      for (const signer of [admin, oracle]) {
        await expect(credits.connect(signer).safeTransferFrom(pool, signer.address, TOKEN_ID, 1, "0x"))
          .to.be.revertedWithCustomError(credits, "ERC1155MissingApprovalForAll")
          .withArgs(signer.address, pool);
      }
      expect(await credits.bufferBalance(TOKEN_ID)).to.equal(BUFFER);
    });
  });
});
