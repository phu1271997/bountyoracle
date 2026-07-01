// src/genlayer.js
// Thin wrapper around genlayer-js that the React app uses to talk to the
// deployed BountyOracle contract. The contract address comes from the build
// env (VITE_CONTRACT_ADDRESS) — Antigravity will inject the address you get
// from Studio after deploying.

import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

// Address of the deployed BountyOracle contract.
// Set VITE_CONTRACT_ADDRESS in .env (or Vercel env vars) after deploying on
// https://studio.genlayer.com/run-debug
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

let _client = null;
let _account = null;

export function getAccount() {
  if (!_account) {
    // For a demo you may persist a generated key; in production, connect a
    // real wallet. genlayer-js supports an injected account too.
    let stored = localStorage.getItem("bo_pk");
    if (!stored || stored === "undefined") {
      stored = generatePrivateKey();
      localStorage.setItem("bo_pk", stored);
    }
    _account = createAccount(stored);
  }
  return _account;
}

export function getClient() {
  if (!_client) {
    _client = createClient({
      chain: studionet,
      account: getAccount(),
    });
  }
  return _client;
}

// ── Reads ──────────────────────────────────────────────────────────────────
export async function listBounties() {
  const client = getClient();
  const res = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "list_bounties",
    args: [],
  });
  return JSON.parse(res);
}

export async function getBounty(id) {
  const client = getClient();
  const res = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_bounty",
    args: [id],
  });
  return JSON.parse(res);
}

export async function getReputation(addressHex) {
  const client = getClient();
  return await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_reputation",
    args: [addressHex],
  });
}

// ── Writes ─────────────────────────────────────────────────────────────────
export async function createBounty({ issueUrl, repoFullName, title, minConfidence, value }) {
  const client = getClient();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "create_bounty",
    args: [issueUrl, repoFullName, title, minConfidence],
    value: BigInt(value),
  });
  return await client.waitForTransactionReceipt({ hash, status: "FINALIZED" });
}

export async function claimBounty({ id, prUrl }) {
  const client = getClient();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "claim_bounty",
    args: [id, prUrl],
    value: 0n,
  });
  return await client.waitForTransactionReceipt({ hash, status: "FINALIZED" });
}

// resolve() runs the on-chain AI judgement — this is the slow one; the UI shows
// a "waiting for consensus" state while this resolves.
export async function resolveBounty({ id }) {
  const client = getClient();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "resolve",
    args: [id],
    value: 0n,
  });
  return await client.waitForTransactionReceipt({ hash, status: "FINALIZED" });
}

export async function refundBounty({ id }) {
  const client = getClient();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "refund",
    args: [id],
    value: 0n,
  });
  return await client.waitForTransactionReceipt({ hash, status: "FINALIZED" });
}
