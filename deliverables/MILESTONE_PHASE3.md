# Milestone submission — BountyOracle · Phase 3

Paste-ready fields for the GenLayer Contribution Portal. English.
Character count verified with `wc -m`.

---

## Title

```
BountyOracle Phase 3 — Integrations (GitHub REST + ENS + Web Share)
```

---

## Changes & Improvements  (990 / 1000 chars — verified)

```
Phase 3 — Integrations. Frontend only; contract unchanged from v0.3.

Three read-only, key-less integrations in frontend/src/lib/:

- GitHub REST API. lib/github.js hits api.github.com unauth (cached, de-duped). CreateForm shows a live "GitHub: <title> — issue open/closed" hint; closed issue is refused. Cards get a PR badge (merged / draft / open PR / closed unmerged); closed-unmerged PR refused.
- ENS reverse. lib/ens.js calls api.ensdata.net. Maintainer + contributor chips render as "name.eth · 0xAB…cd".
- Web Share + deep links. lib/share.js. Every bounty has ?bounty=<id> URL that scrolls to and outlines that card. Each card has a Share button (navigator.share with clipboard fallback).

IMPACT
- Bad bounties never reach the contract: closed issue or closed-unmerged PR refused client-side.
- Address chips readable, not hex-only. Bounties shareable via a single URL.
- Fast-lane pytest: 41 → 53 invariants, under 0.1s. No key ships in the bundle (test-time assertion).
```

---

## Evidence links (Phase 3 only — none reused from Phase 1 or 2)

1. **Commit — three integration modules (github / ens / share)**
   https://github.com/phu1271997/bountyoracle/commit/a80dc0ae39d0fedcd0c0c30d65374c2d402f7d14
2. **Commit — LiveVerdicts wire-up (GitHub hint, PR badge, ENS chip, deep link, Share button)**
   https://github.com/phu1271997/bountyoracle/commit/21e6968ffa9060bc4972ff5a6fa04a8f464174b2
3. **13 new fast-lane invariants (Phase 3 tests)**
   https://github.com/phu1271997/bountyoracle/blob/main/tests/test_integrations.py
4. **Deep-link demo — bounty #0 pre-scrolled + outlined on load**
   https://bountyoracle.vercel.app/?bounty=0

None of these links overlap with the ten Phase 1 or the four Phase 2
evidence links.

---

## Deploy state

| | |
|---|---|
| Contract (unchanged) | `0xE86573cbFf9c1cF08A175D616a183BFf8eba7aC6` (v0.3, studionet) |
| Frontend prod bundle | rebuilt after Phase 3; new bundle serves `api.github.com`, `api.ensdata.net`, `navigator.share`, and the `?bounty=<id>` reader |
| Vercel env | unchanged (still points at the Phase 2 contract) |
| Rate limits | GitHub 60 req/hr per source IP unauthenticated; the app degrades gracefully — a warn banner in the form, a missing PR badge on cards. No functionality breaks. |

---

## Milestone type + estimate

- **Type:** Integrations (Loại 4 in the strategy playbook — three
  integrations bundled).
- **Estimated points:** 1000–1800 pts.
- **No overlap with Phase 1** (docs + frontend hardening + tests) or
  **Phase 2** (contract-side AI enhancement + redeploy).
- **Phase 4 preview:** Real Traction — target 50+ unique users,
  100+ txs, marketing push. Evidence will be Explorer aggregate
  screenshots + Discord/X posts + a Dune-style dashboard.
