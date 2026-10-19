import fs from "node:fs";
import path from "node:path";
import hre, { ethers, network } from "hardhat";

// Deploys CanopyCredits and writes its address and ABI for the frontend and the oracle.
//   Amoy:  npx hardhat run scripts/deploy.ts --network amoy   → ../shared/contracts.json (committed)
//   Local: npx hardhat run scripts/deploy.ts --network localhost → deployments/local.json (gitignored)
// The deployer becomes DEFAULT_ADMIN_ROLE. ORACLE_ADDRESS gets ORACLE_ROLE (required on Amoy).

const AMOY_CHAIN_ID = 80002n;
const CONFIRMATIONS_BEFORE_VERIFY = 5;

async function main() {
  const [deployer, fallbackOracle] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account. Set DEPLOYER_PRIVATE_KEY in contracts/.env.");

  const { chainId } = await ethers.provider.getNetwork();
  const isAmoy = chainId === AMOY_CHAIN_ID;

  // ORACLE_ADDRESS in contracts/.env is the Amoy oracle; local chains always use Hardhat account #1,
  // whose key the local backend runs with (see frontend/README.md).
  const oracle = isAmoy ? process.env.ORACLE_ADDRESS : fallbackOracle?.address;
  if (!oracle || !ethers.isAddress(oracle)) {
    throw new Error("Set ORACLE_ADDRESS in contracts/.env to the oracle wallet address.");
  }
  if (isAmoy && ethers.getAddress(oracle) === deployer.address) {
    throw new Error("ORACLE_ADDRESS must be a separate wallet from the deployer.");
  }
  const baseURI = process.env.TOKEN_BASE_URI ?? "";

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network:  ${network.name} (chainId ${chainId})`);
  console.log(`Deployer: ${deployer.address} (${ethers.formatEther(balance)} POL)`);
  console.log(`Oracle:   ${oracle}`);

  const constructorArgs = [deployer.address, oracle, baseURI] as const;
  const credits = await ethers.deployContract("CanopyCredits", [...constructorArgs]);
  const deployTx = credits.deploymentTransaction()!;
  const receipt = await deployTx.wait(1);
  const address = await credits.getAddress();
  console.log(`CanopyCredits deployed at ${address} (block ${receipt!.blockNumber}, tx ${deployTx.hash})`);

  const artifact = await hre.artifacts.readArtifact("CanopyCredits");
  const output = {
    chainId: Number(chainId),
    CanopyCredits: {
      address,
      deployBlock: receipt!.blockNumber,
      deployTx: deployTx.hash,
      abi: artifact.abi,
    },
  };
  const outFile = isAmoy
    ? path.resolve(__dirname, "../../shared/contracts.json")
    : path.resolve(__dirname, "../deployments/local.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);

  if (!isAmoy) return;
  if (!process.env.ETHERSCAN_API_KEY) {
    console.log("ETHERSCAN_API_KEY not set, skipping Polygonscan verification.");
    return;
  }
  console.log(`Waiting for ${CONFIRMATIONS_BEFORE_VERIFY} confirmations before verifying...`);
  await deployTx.wait(CONFIRMATIONS_BEFORE_VERIFY);
  try {
    await hre.run("verify:verify", { address, constructorArguments: [...constructorArgs] });
  } catch (err) {
    // Verification can be retried without redeploying:
    //   npx hardhat verify --network amoy <address> <admin> <oracle> "<baseURI>"
    console.error("Verification failed (the deployment itself succeeded):", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
