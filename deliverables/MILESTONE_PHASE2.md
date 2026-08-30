# Milestone submission — BountyOracle · Phase 2

Paste-ready fields for the GenLayer Contribution Portal. English.
Character count verified with `wc -m`.

---

## Title

```
BountyOracle Phase 2 — Contract-side AI Enhancement Bundle
```

---

## Changes & Improvements  (981 / 1000 chars — verified)

```
Phase 2 — Contract AI Enhancement. Redeployed at new studionet address; Vercel env updated; 3 demos reseeded.

CHANGED (BountyOracle.py v0.3)
- Canary defense. Deterministic CANARY-<12hex> from sha256(issue|pr). LLM must echo in rationale; missing canary → UNRESOLVABLE. Evidence blocks labeled UNTRUSTED.
- Multi-source. 6 pages per resolve (issue, PR, /files, /checks, /commits, repo README), up from 4.
- Multi-perspective prompt. LLM scores Correctness, Tests, CI separately before one verdict.
- Stricter validator. Consensus needs same verdict + canary preserved on leader + validator + confidences within ±20.
- Auditability. Bounty.canary_verified: bool persisted every resolve, exposed in the JSON view.

IMPACT
- Sources 4 → 6. Validator conditions 1 → 3. T1 in SECURITY.md: partial → closed.
- Fast-lane pytest: 28 → 41 invariants, under 0.1s.

Reseeded #0..#2 with real GitHub URLs: ACCEPT/95, REJECT/100, UNRESOLVABLE/0. canary_verified=true on all three.
```

---

## Evidence links (Phase 2 only — none reused from Phase 1)

1. **Contract v0.3 commit — canary + multi-source + stricter validator (191 insertions, 129 deletions in one file)**
   https://github.com/phu1271997/bountyoracle/commit/b16ec495b31b82ca57bc0beed6758406d16c4938
2. **New contract on Explorer (v0.3, redeployed)**
   https://explorer-studio.genlayer.com/address/0xE86573cbFf9c1cF08A175D616a183BFf8eba7aC6
3. **First `resolve()` tx on the new contract — verdict ACCEPT / 95%, canary_verified=true**
   https://explorer-studio.genlayer.com/tx/0x05017267be2e43a7f80f82f0bbf86bea027487b36fb9b5ba892e0e6b1dc9058a
4. **13 new fast-lane pytest invariants locking in the hardening**
   https://github.com/phu1271997/bountyoracle/blob/main/tests/test_ai_hardening.py

Every link is either a Phase 2 commit or a Phase 2 on-chain artifact.
**None overlap with the four Phase 1 evidence links** (docs commit,
frontend commit, invariants commit, SECURITY.md, ARCHITECTURE.md,
validate.js, addr.js, ErrorBoundary.jsx, test_security_invariants.py,
CHANGELOG.md).

---

## Deploy state

| | |
|---|---|
| Old contract (retired) | `0x1455872eeF0F96b71Fa8a763866B51A6013751c0` |
| **New contract (v0.3)** | **`0xE86573cbFf9c1cF08A175D616a183BFf8eba7aC6`** |
| Network | studionet (chain 61999) |
| Vercel `VITE_CONTRACT_ADDRESS` | updated to the new address |
| Prod bundle | rebuilt after the env change; new address baked in |
| On-chain state on the new contract | bounty #0 ACCEPTED (paid), #1 OPEN (post-REJECT cycle), #2 UNRESOLVABLE, all with `canary_verified=true` |

---

## Milestone type + estimate

- **Type:** AI enhancement bundle (Loại 1b + 1c + 1d + 1e in the
  strategy playbook).
- **Estimated points:** 1500–2500 pts (four Loại-1 sub-improvements
  bundled with a real redeploy and a full reseed of the demo state).
- **No overlap with Phase 1** (Phase 1 was docs + frontend + tests
  only; Phase 2 is the actual contract rewrite + redeploy).
- **Phase 3 preview:** integrations (The Graph subgraph, Push
  Protocol notifications on state change, ENS resolution).
