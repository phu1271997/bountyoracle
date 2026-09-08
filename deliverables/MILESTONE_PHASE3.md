# Milestone submission — BountyOracle · Phase 3 (rebuilt)

Competitive Bounties with on-chain comparative AI ranking. This replaces the
earlier frontend-only "integrations" Phase 3 with real new on-chain work
(contract redeployed).

---

## Title

```
BountyOracle Phase 3 — Competitive Bounties with On-Chain AI Ranking
```

---

## Type

Major feature + AI enhancement (new contract functionality + new deployment).

---

## Changes & Improvements  (non-technical, no em dashes)

```
BountyOracle now runs bounties as open competitions. Instead of one person
claiming a bounty, many contributors can each submit their own pull request to
it. When the maintainer starts judgement, the smart contract reads every
submitted PR live on GitHub and uses AI to compare them, then pays only the
single best one that fully solves the issue. Validators must independently
agree on the same winner. Every entry gets a public rank and a short AI note
saying why it won or lost.
```

---

## What changed — before / after

**Before (v0.3):** one bounty locked to the first contributor who claimed it.
`resolve()` judged that single PR yes/no.

**After (v0.4):** a bounty stays open and collects rival PRs from many
contributors. `resolve()` reads the issue, repo and *every* rival PR on-chain,
runs ONE comparative LLM judgement that ranks them and returns a single
`winner_index`, and pays only that submission. Validators must agree on the
verdict AND the same `winner_index` (plus confidence ±20 and the injection
canary). Each judged PR persists a rank + AI note.

Quantifiable: 1 PR per bounty → up to 5 ranked per judgement; fast-lane test
invariants 53 → 63.

---

## Deploy state

| | |
|---|---|
| New contract (v0.4, studionet) | `0x19552b11A53eca997152E35E56Ac04DaaaC2DcD4` |
| Live app | https://bountyoracle.vercel.app |

---

## Evidence links (Phase 3 only — distinct from every other phase)

1. **Contract commit — competitive model + comparative ranking**
   https://github.com/phu1271997/bountyoracle/commit/ac90ce0635268d5381e4fab202fbe4ebdc4359a1
2. **Frontend commit — rival-PR competition UI**
   https://github.com/phu1271997/bountyoracle/commit/a9d6ccf0ab2ebbea229b3b3c8096991e5606c1a2
3. **New comparative-ranking test suite (13 invariants)**
   https://github.com/phu1271997/bountyoracle/blob/main/tests/test_competitive.py
4. **Deployed v0.4 contract on the studionet explorer**
   https://explorer-studio.genlayer.com/address/0x19552b11A53eca997152E35E56Ac04DaaaC2DcD4
5. **On-chain create_bounty tx (competition #0)**
   https://explorer-studio.genlayer.com/tx/0x66a2b100d4adc46c81091112df36691ed5fa1031f34a99c45d7ea4756297ac0d
