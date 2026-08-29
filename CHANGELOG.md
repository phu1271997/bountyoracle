# Changelog

All notable changes to BountyOracle land here. The project follows
[Semantic Versioning](https://semver.org) and
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Unreleased work targets `v0.3.0` (Phase 2 — Contract-side AI
enhancement bundle: canary defense, multi-source cross-reference,
multi-perspective prompt, stricter validator). Redeploy of the
Intelligent Contract is required to ship it.

---

## [0.2.0] — 2026-08-29 · Phase 1 — Security Hardening & Docs Overhaul

**Milestone type:** security / architecture improvement + documentation.
**Deploy state:** frontend redeployed to production; **no contract
redeploy** was needed for this phase.

### Added
- `SECURITY.md` — a versioned threat model covering prompt injection,
  URL smuggling, address casing, in-browser secrets, and uncaught
  render crashes. Documents current mitigations and what is deferred
  to Phase 2.
- `ARCHITECTURE.md` — Mermaid diagrams for the system, the `resolve()`
  sequence, the storage model, the state machine, and the frontend
  composition graph.
- `CONTRIBUTING.md` — how to contribute, branch naming, commit
  prefixes, PR expectations, and how to run the fast/slow test lanes.
- `docs/adr/0001-run-nondet-unsafe.md` — decision record for the
  choice of `gl.vm.run_nondet_unsafe` over `gl.vm.run_nondet` and the
  planned migration path.
- `docs/adr/0002-metamask-signing.md` — decision record for using
  MetaMask (address-string signer) instead of an in-browser burner.
- `docs/samples/` — three sample bounty JSON files usable as
  paste-ready seed data during a demo.
- `frontend/src/lib/validate.js` — a URL allowlist for
  `create_bounty` / `claim_bounty` inputs. Rejects `javascript:`,
  `data:`, `file:` schemes and blocks query strings / fragments
  (defence against sensitive-token smuggling).
- `frontend/src/lib/addr.js` — a case-insensitive address comparator
  used everywhere the UI decides "is this the maintainer?".
- `frontend/src/sections/ErrorBoundary.jsx` — a React error boundary
  wrapping every top-level section so one broken card cannot unmount
  the whole app.
- `tests/test_security_invariants.py` — new fast-lane assertions
  covering the URL allowlist behaviour, address normalisation, the
  absence of any private-key material in the built bundle, and the
  presence of the new docs.

### Changed
- `frontend/src/sections/LiveVerdicts.jsx` — the create form and the
  claim input now go through the URL allowlist before the write is
  submitted; validation errors surface inline rather than reaching
  the contract.
- `frontend/src/sections/LiveVerdicts.jsx` — the maintainer check now
  uses `addressEquals` from `lib/addr.js`.
- `frontend/src/App.jsx` — wraps its section tree in `ErrorBoundary`.

### Security
- Documented [T1](SECURITY.md#t1--prompt-injection-through-the-github-issue-or-pr-body)
  through [T5](SECURITY.md#t5--uncaught-render-crash-locks-the-whole-page).
- CI-time assertion that no `VITE_PRIVATE_KEY` or
  `GENLAYER_PRIVATE_KEY` string ever ships in the frontend bundle.

### Notes for reviewers
- The contract at
  `0x1455872eeF0F96b71Fa8a763866B51A6013751c0` on studionet is
  **unchanged** for this milestone. All Phase 1 improvements are
  observable in the repo, in the built frontend bundle, and in the
  test output — no on-chain migration required.

---

## [0.1.0] — 2026-08-27 · Baseline (Explorer submission)

### Added
- Intelligent Contract `BountyOracle` with `create_bounty`,
  `claim_bounty`, `resolve`, `refund`, plus four views.
- `run_nondet_unsafe` leader + validator that agree on the *verdict*,
  not on JSON shape.
- Frontend rebuild into a pro landing page (Nav, Hero, Stats,
  Problem, HowItWorks, LiveVerdicts, Signals, Architecture, Compare,
  FAQ, HowToUse, Footer) with the infinity brand mark.
- MetaMask signing via genlayer-js address-string account.
- gltest suite split into fast (`test_contract_shape.py`) and slow
  lanes.
- On-chain seed data: bounty #3 ACCEPTED, #4 REJECT cycle, #5
  REFUNDED after UNRESOLVABLE.
- Explorer submission draft in `deliverables/SUBMISSION.md`.
