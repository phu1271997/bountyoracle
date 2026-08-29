# ADR 0002 — MetaMask signs; the frontend never holds a key

- Status: **Accepted**
- Date: 2026-08-29
- Deciders: maintainer

## Context

Earlier iterations of the frontend generated a burner private key with
`generatePrivateKey()`, stashed it in `localStorage`, and used it as
the `account` on the `genlayer-js` client. That produced two concrete
failure modes:

- A user landing on the live app got a **fresh, unfunded burner**.
  Their first write reverted with `insufficient funds`. There is no
  public studionet faucet that funds arbitrary addresses on demand,
  so the demo simply did not work.
- Any secret ever loaded via a `VITE_*` env var is baked into the
  static bundle and readable by anyone who opens DevTools. This is
  called out explicitly in the project's common-errors cheatsheet
  (R22).

## Decision

The frontend passes `account` to `createClient` as an **address
string**, not as a full signer object. Per `genlayer-js` semantics,
that opts the SDK into routing `eth_sendTransaction` /
`eth_signTransaction` through `window.ethereum` — MetaMask holds the
key and signs each transaction after the user's explicit approval.

Reads work without a wallet: an unauthenticated read-only client is
constructed on page load so the verdict list is visible immediately.

## Chain switch

`studionet.isStudio === true` in the SDK, which means the SDK's
`assertChainMatch` **skips** the wallet-chain check. Without an
explicit switch, a MetaMask that happens to be on Ethereum mainnet
would attempt to send the tx there and fail with an opaque error.

`connectWallet()` therefore issues `wallet_switchEthereumChain` for
chain `61999` (`0xF1EF`) at every connect. On `4902 / -32603` (chain
unknown to the wallet), it falls back to `wallet_addEthereumChain`
with the studionet parameters read from the SDK — never hardcoded.
On `chainChanged` the page reloads to re-sync all state.

## Alternatives considered

- **Keep the burner, add a bespoke faucet.** Rejected — studionet has
  no public sim-faucet on the hosted RPC, and shipping a
  server-side faucet is out of scope for a static frontend.
- **Use RainbowKit / ConnectKit / WalletConnect abstraction.**
  Rejected for Phase 1 — adds ~200 KB, and MetaMask on desktop is
  what reviewers use. Planned Phase 3 integration under Loại 4.

## Consequences

- Positive: no private key ships in the bundle;
  `test_no_private_key_in_frontend_bundle_sources` enforces this at
  test time.
- Positive: reviewers use their own funded wallet, which is what the
  Explorer submission flow assumes anyway.
- Negative: users without MetaMask see the app read-only. Acceptable —
  a banner explains and links to the install page. Mobile-wallet
  bridging is out of scope for Phase 1.

## References

- [SECURITY.md § T4](../../SECURITY.md#t4--in-browser-secrets-leak)
- [`frontend/src/genlayer.js`](../../frontend/src/genlayer.js)
- Cheatsheet R21–R24 (from `~GEN_RULES/02-common-errors.md`)
