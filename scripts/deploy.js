#!/usr/bin/env node
// scripts/deploy.js
// Optional CLI deploy for BountyOracle (alternative to the Studio UI flow).
// The recommended path is the Studio UI (see README). This script is here so
// the repo has a reproducible, scriptable deploy for engineering credit.
//
// Usage:
//   GENLAYER_PRIVATE_KEY=0x...  node scripts/deploy.js
//
// It reads contracts/BountyOracle.py, deploys it to studionet, waits for the
// deploy tx to finalize, and prints the contract address to paste into
// frontend/.env as VITE_CONTRACT_ADDRESS.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const pk = process.env.GENLAYER_PRIVATE_KEY;
  const account = pk ? createAccount(pk) : createAccount();
  if (!pk) {
    console.log("No GENLAYER_PRIVATE_KEY set — generated a throwaway account:");
    console.log("  address:", account.address);
    console.log("  (fund it on the Studio faucet before deploying for real)\n");
  }

  const client = createClient({ chain: studionet, account });
  const code = fs.readFileSync(
    path.join(__dirname, "..", "contracts", "BountyOracle.py"),
    "utf-8"
  );

  console.log("Deploying BountyOracle.py to studionet…");
  const txHash = await client.deployContract({
    code,
    args: [], // constructor takes no args
  });
  console.log("deploy tx:", txHash);

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: "FINALIZED",
  });
  const address =
    receipt?.data?.contract_address ||
    receipt?.contract_address ||
    receipt?.contractAddress;

  console.log("\n✅ Deployed. Contract address:");
  console.log("   " + address);
  console.log("\nPaste into frontend/.env :");
  console.log("   VITE_CONTRACT_ADDRESS=" + address);
}

main().catch((e) => {
  console.error("Deploy failed:", e);
  process.exit(1);
});
