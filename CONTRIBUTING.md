# Contributing to BountyOracle

Thanks for looking. This is a working project on GenLayer studionet —
patches, bug reports, and threat-model additions are welcome.

The rules below are the minimum needed to keep the repo readable while
still moving quickly.

---

## Ground rules

- Discuss anything that changes contract storage or the state machine
  in an issue **before** opening a PR. Contract migrations require a
  redeploy on studionet and reseed of demo data.
- Do not commit private keys or `.env` files. `.gitignore` already
  ignores them; `tests/test_contract_shape.py` also fails the build
  if the frontend bundle ever contains a `VITE_PRIVATE_KEY` /
  `GENLAYER_PRIVATE_KEY` string.
- Security issues follow the coordinated disclosure path in
  [SECURITY.md](SECURITY.md).

---

## Branch and commit conventions

- Branch names: `feat/…`, `fix/…`, `docs/…`, `test/…`, `chore/…`,
  `refactor/…`. One concern per branch.
- Commit message prefixes (matches what the log already uses):

  | Prefix | Meaning |
  |---|---|
  | `feat:` | New user-visible feature. |
  | `fix:` | Bug fix. |
  | `docs:` | Docs-only changes. |
  | `test:` | Test additions / refactors. |
  | `ui:` | Visual / stylistic UI change. |
  | `ux:` | Interaction-flow change. |
  | `chore:` | Tooling, dependencies, brand assets. |
  | `refactor:` | Behaviour-preserving reshuffle. |
  | `security:` | A hardening change worth calling out. |

  Optionally scope with parentheses: `feat(frontend): …`,
  `docs(security): …`.
- One logical change per commit. Bundle typos into the surrounding
  commit rather than opening a `chore: typo` on its own.

---

## Local setup

```bash
git clone https://github.com/phu1271997/bountyoracle.git
cd bountyoracle

# Frontend
cd frontend && npm install && npm run dev

# Tests (fast lane — no network required)
cd ../tests
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -v

# Tests (slow lane — requires GEN on the target network)
pytest -m slow --network studionet
```

For the full app you also need MetaMask and a funded studionet
address; see [`README.md`](README.md).

---

## Pull requests

Every PR should have:

1. A one-paragraph description of what changes and why.
2. A test plan — even for docs PRs, at minimum "the fast pytest lane
   still passes."
3. A `CHANGELOG.md` entry under `## [Unreleased]` describing the
   user-visible change. Move it under a version heading when we cut a
   release.

For contract-touching PRs also include:

- Whether a redeploy is required.
- A migration note (does this need to reseed demo data?).
- An ADR in `docs/adr/` if the change reverses or invalidates a prior
  decision.

---

## Sample data

`docs/samples/*.json` are paste-ready bounty payloads used to reseed
the app during demos. If you add a new one, update the CHANGELOG and
keep the file under 4 KB — anything larger belongs in an issue
attachment.

---

## Style

- Python: readable over clever. `_normalize_verdict`-style helpers
  live at module scope, prefixed with `_`.
- JS: React function components only. No global state library — the
  composition root passes what it needs.
- Comments explain *why* — the *what* is in the code.
