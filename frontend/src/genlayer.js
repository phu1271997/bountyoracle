// src/genlayer.js
// BountyOracle frontend ↔ contract wrapper.
//
// SIGNING MODEL — MetaMask signs, SDK forwards.
// We pass `account` as an address STRING (not a full account object). Per
// genlayer-js, that opts into `window.ethereum` for eth_sendTransaction /
// eth_signTransaction — the user's MetaMask is the signer. No private keys
// live in this bundle (R21/R22). If MetaMask is not installed the UI blocks
// writes and shows an install prompt.
//
// CHAIN MANAGEMENT — we explicitly add + switch to studionet (chain 61999,
// 0xF1EF) on connect. `studionet.isStudio === true` means the SDK skips its
// own chain match check; without an explicit switch, MetaMask would sign on
// whatever chain it happened to be on. We do it here (R23).

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

const CHAIN_ID_HEX = "0x" + studionet.id.toString(16); // 0xF1EF
const RPC_URL = studionet.rpcUrls.default.http[0];      // https://studio.genlayer.com/api
const EXPLORER_URL = "https://explorer-studio.genlayer.com";

// ── Wallet state ────────────────────────────────────────────────────────────
let _address = null;
let _client = null;
const _listeners = new Set();

export function getAddress() {
  return _address;
}

export function onAccountChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function _notify() {
  for (const fn of _listeners) {
    try { fn(_address); } catch { /* ignore */ }
  }
}

export function hasMetaMask() {
  return typeof window !== "undefined" && !!window.ethereum;
}

function _readOnlyClient() {
  // Client used for view calls before the user has connected a wallet.
  return createClient({ chain: studionet });
}

function _signingClient(address) {
  return createClient({
    chain: studionet,
    account: address,   // address STRING → SDK uses window.ethereum to sign
  });
}

// ── Chain switching ─────────────────────────────────────────────────────────
async function ensureStudionet() {
  if (!hasMetaMask()) throw new Error("MetaMask not detected. Install it, then reload.");
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err) {
    // 4902 = unrecognized chain, -32603 = internal (some MM builds return this
    // when the chain isn't added). Add it, then MetaMask auto-switches.
    if (err?.code === 4902 || err?.code === -32603) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_ID_HEX,
          chainName: "GenLayer Studio Network",
          nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
          rpcUrls: [RPC_URL],
          blockExplorerUrls: [EXPLORER_URL],
        }],
      });
    } else {
      throw err;
    }
  }
}

export async function connectWallet() {
  if (!hasMetaMask()) throw new Error("MetaMask not detected. Install MetaMask and reload.");
  await ensureStudionet();
  const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
  const addr = accs?.[0];
  if (!addr) throw new Error("No account returned from MetaMask.");
  _address = addr;
  _client = _signingClient(addr);
  _notify();

  // React to MetaMask flips.
  if (window.ethereum && !window.ethereum.__boWired) {
    window.ethereum.__boWired = true;
    window.ethereum.on?.("accountsChanged", (accs2) => {
      _address = accs2?.[0] || null;
      _client = _address ? _signingClient(_address) : null;
      _notify();
    });
    window.ethereum.on?.("chainChanged", () => {
      // Force reload — simplest safe path when chain changes mid-session.
      window.location.reload();
    });
  }

  return addr;
}

export async function autoConnectIfAuthorized() {
  // Best-effort silent reconnect — only pulls up accounts the site already has
  // permission for. Does NOT open the MetaMask popup.
  if (!hasMetaMask()) return null;
  try {
    const accs = await window.ethereum.request({ method: "eth_accounts" });
    const addr = accs?.[0];
    if (addr) {
      _address = addr;
      _client = _signingClient(addr);
      _notify();
      return addr;
    }
  } catch { /* ignore */ }
  return null;
}

// ── Reads (no wallet required) ──────────────────────────────────────────────
function _readClient() {
  return _client || _readOnlyClient();
}

export async function listBounties() {
  const client = _readClient();
  const res = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "list_bounties",
    args: [],
  });
  return JSON.parse(res);
}

export async function getBounty(id) {
  const client = _readClient();
  const res = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_bounty",
    args: [id],
  });
  return JSON.parse(res);
}

export async function getReputation(addressHex) {
  const client = _readClient();
  return await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_reputation",
    args: [addressHex],
  });
}

// ── Writes (wallet required) ────────────────────────────────────────────────
function _requireSigning() {
  if (!_client || !_address) {
    throw new Error("Connect MetaMask first.");
  }
  return _client;
}

export async function createBounty({ issueUrl, repoFullName, title, minConfidence, value }) {
  const client = _requireSigning();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "create_bounty",
    args: [issueUrl, repoFullName, title, minConfidence],
    value: BigInt(value),
  });
  return await client.waitForTransactionReceipt({ hash, status: "FINALIZED" });
}

export async function claimBounty({ id, prUrl }) {
  const client = _requireSigning();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "claim_bounty",
    args: [id, prUrl],
    value: 0n,
  });
  return await client.waitForTransactionReceipt({ hash, status: "FINALIZED" });
}

export async function resolveBounty({ id }) {
  const client = _requireSigning();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "resolve",
    args: [id],
    value: 0n,
  });
  return await client.waitForTransactionReceipt({ hash, status: "FINALIZED" });
}

export async function refundBounty({ id }) {
  const client = _requireSigning();
  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "refund",
    args: [id],
    value: 0n,
  });
  return await client.waitForTransactionReceipt({ hash, status: "FINALIZED" });
}

export const EXPLORER = {
  address: (addr) => `${EXPLORER_URL}/address/${addr}`,
  tx: (hash) => `${EXPLORER_URL}/tx/${hash}`,
};
