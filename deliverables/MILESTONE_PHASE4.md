# Milestone submission — BountyOracle · Phase 4

Escrow economics: pull-payment settlement, a protocol-fee treasury, tiered
reputation, and an on-chain leaderboard (contract redeployed).

---

## Title

```
BountyOracle Phase 4 — Escrow Economics: Pull Payments, Fees & Reputation Tiers
```

---

## Type

Security / architecture improvement + major feature (new contract functionality
+ new deployment).

---

## Changes & Improvements  (non-technical, no em dashes)

```
BountyOracle gains a full reward economy. Payouts now use a safe claim model:
winnings are held by the contract and each person withdraws their own balance,
so one broken wallet can never block everyone else. A small protocol fee funds
a treasury, and contributors build reputation with every win. Higher tiers pay
a smaller fee, so proven builders keep more of each bounty and top tier
Experts pay nothing. A live leaderboard ranks contributors by wins and total
earned, all stored on chain.
```

---

## What changed — before / after

**Before (v0.4):** the winning payout and refunds were PUSHED with
`emit_transfer` inside settlement; reputation was a bare win counter.

**After (v0.5):**
- **Pull payments.** Settlement credits a `withdrawable` ledger; recipients
  pull with `withdraw()` (balance zeroed before transfer — checks-effects-
  interactions). A reverting recipient can no longer brick settlement.
- **Fee + treasury.** Winning payouts take a basis-point fee (2.5% base) into
  an owner-swept `treasury`.
- **Tiered reputation.** Newcomer → Contributor → Trusted → Expert, from
  lifetime wins; the tier discounts the fee (Expert = 0%). Tracks lifetime GEN
  earned.
- **On-chain leaderboard.** `get_leaderboard()` ranks winners by wins + earned.

Quantifiable: 5 new read views + 2 new write methods; fast-lane invariants
63 → 72.

---

## Deploy state

| | |
|---|---|
| New contract (v0.5, studionet) | `0xb15DCff4869C7D49be9aEaFFc9C21157e4a0184F` |
| Live app | https://bountyoracle.vercel.app |

---

## Evidence links (Phase 4 only — distinct from every other phase)

1. **Contract commit — pull-payment escrow + fee treasury + tiered reputation**
   https://github.com/phu1271997/bountyoracle/commit/ec28edde3993b8380ac864555aec1427a6b9ac7d
2. **Frontend commit — reputation economy section (leaderboard + withdraw)**
   https://github.com/phu1271997/bountyoracle/commit/9d79c57a31a85727dd359092239ce404cdfffc4a
3. **ECONOMICS.md — money-flow diagram, fee model, tier table**
   https://github.com/phu1271997/bountyoracle/blob/main/ECONOMICS.md
4. **Escrow-economics test suite (11 invariants + slow e2e)**
   https://github.com/phu1271997/bountyoracle/blob/main/tests/test_economy.py
5. **Deployed v0.5 contract on the studionet explorer**
   https://explorer-studio.genlayer.com/address/0xb15DCff4869C7D49be9aEaFFc9C21157e4a0184F
