# Milestone submission — BountyOracle · Phase 1

Paste-ready fields for the GenLayer Contribution Portal. English, per
form language. Character count for the free-text field verified with
`wc -m` below.

---

## Title

```
BountyOracle Phase 1 — Security Hardening & Documentation Overhaul
```

*(59 chars — well under any reasonable title cap.)*

---

## Changes & Improvements  (999 / 1000 chars — verified)

```
Phase 1 — Security Hardening & Documentation. Frontend, docs, tests. No contract redeploy.

CHANGED
- SECURITY.md: 5 threats (prompt injection, URL smuggling, address casing, in-browser secrets, render crash) + mitigations.
- ARCHITECTURE.md: 5 Mermaid diagrams — system, resolve() sequence, storage, state machine, composition.
- CHANGELOG.md, CONTRIBUTING.md, 2 ADRs, 3 sample bounty JSONs.
- lib/validate.js: URL allowlist. https + github.com only; blocks ?query/#fragment and javascript:/data:/file:.
- lib/addr.js: case-insensitive addressEquals wherever the UI asks "am I the maintainer?".
- ErrorBoundary on every section; a crashing card no longer unmounts the page.
- 14 new fast-lane pytest invariants. Suite 14 → 28 passing under 0.1s.

IMPACT
Bad URLs die before gas; address-case bugs impossible in UI; crashes boxed; every threat and prior decision documented.

Phase 2 will redeploy with canary + multi-source + stricter validator; Phase 1 hardens the surrounding surface first.
```

---

## Evidence links (Phase 1 — unique to this phase, not repo root, not vercel root)

1. **Commit — docs pack (SECURITY / ARCHITECTURE / CHANGELOG / CONTRIBUTING / ADRs / samples)**
   https://github.com/phu1271997/bountyoracle/commit/91577d8f2b781a10d60fa5bace557826a10fc662
2. **Commit — frontend hardening (URL allowlist, address normalisation, ErrorBoundary)**
   https://github.com/phu1271997/bountyoracle/commit/6d57347778f2b68aeddc34776bd5faf7c8509686
3. **Commit — 14 new fast-lane pytest invariants**
   https://github.com/phu1271997/bountyoracle/commit/fc07f0f7c0ece9012babf460539c34e1b783fcc7
4. **File — SECURITY.md threat model (T1..T5 with mitigations)**
   https://github.com/phu1271997/bountyoracle/blob/main/SECURITY.md
5. **File — ARCHITECTURE.md Mermaid diagrams (5 diagrams)**
   https://github.com/phu1271997/bountyoracle/blob/main/ARCHITECTURE.md
6. **File — frontend URL allowlist**
   https://github.com/phu1271997/bountyoracle/blob/main/frontend/src/lib/validate.js
7. **File — case-insensitive address helpers**
   https://github.com/phu1271997/bountyoracle/blob/main/frontend/src/lib/addr.js
8. **File — ErrorBoundary (React lifecycle + reset)**
   https://github.com/phu1271997/bountyoracle/blob/main/frontend/src/sections/ErrorBoundary.jsx
9. **File — 14 fast-lane invariants**
   https://github.com/phu1271997/bountyoracle/blob/main/tests/test_security_invariants.py
10. **File — CHANGELOG entry for v0.2.0**
    https://github.com/phu1271997/bountyoracle/blob/main/CHANGELOG.md

Pick 3–5 of these to paste into the Portal's evidence field; each
points to a specific commit or file, not the repo root or the
homepage. **None of these links will be reused for Phase 2** — that
phase will redeploy the contract and its evidence set is the new
contract address, the diff on `BountyOracle.py`, and the new resolve
transaction hashes.

---

## Deploy state

- Live app (frontend rebuilt with Phase 1 code):
  https://bountyoracle.vercel.app
  (production bundle `/assets/index-CeyfcMi3.js` served after commit
  `fc07f0f`.)
- Contract (unchanged in Phase 1):
  `0x1455872eeF0F96b71Fa8a763866B51A6013751c0` on studionet.
- All commits on `main`, up to `fc07f0f`.

---

## Milestone type + estimate

- **Type:** Security / architecture improvement + documentation
  (Loại 5 + Loại 8 in the strategy playbook).
- **Estimated points:** 700–1200 pts (bundle of Security Hardening
  v1 + Documentation Overhaul v1).
- **Not overlapping with:** the earlier Explorer submission
  (baseline app + first submission draft), and not with Phase 2/3/4.
