# BountyOracle

**Trustless open-source bounties that settle themselves.** A maintainer locks GEN
against a GitHub issue. A contributor claims it with a pull request. Then an
**Intelligent Contract on GenLayer reads the live GitHub pages on-chain** (the
issue, the PR, the diff, the CI checks), **reasons about them with an LLM**, and
**pays the contributor automatically** if the work genuinely and completely
solves the issue. No maintainer has to manually adjudicate. No single party
decides alone.

> **Why this dies without GenLayer:** the entire product is an on-chain agent
> that *reads github.com and decides whether work is done well enough to release
> money*. A normal smart contract (Solidity) cannot fetch a web page or judge
> code quality. Remove the web-read + LLM judgement and there is nothing left —
> no oracle, nothing can settle. The AI is the settlement mechanism, not a
> garnish.

---

## How it works

```
maintainer                contributor                 anyone
   │ create_bounty(issue, $)   │                          │
   ▼                           │                          │
 [OPEN] ──────────────────────►│ claim_bounty(pr_url)     │
                               ▼                          │
                           [CLAIMED] ─────────────────────►│ resolve()
                               │                          │
                  ┌────────────┴───────────── on-chain ───┴───────────┐
                  │  gl.nondet.web.render(issue, pr, /files, /checks)  │
                  │  gl.nondet.exec_prompt( judge quality + CI )       │
                  │  validators must AGREE on the same verdict         │
                  └────────────┬──────────────────────────────────────┘
            ACCEPT ◄───────────┼───────────► REJECT ──► back to [OPEN]
              │                │
        pay contributor   UNRESOLVABLE ──► maintainer refund
          [ACCEPTED]            │
                            [UNRESOLVABLE]
```

### The part that matters: consensus checks *meaning*, not shape

The hard line between a real GenLayer app and a toy is here. Our validator does
**not** merely check "is this valid JSON with the right keys." Each validator
**independently re-reads GitHub and re-judges**, then the run only succeeds if
the validator reaches the **same decision** (`ACCEPT` / `REJECT` /
`UNRESOLVABLE`) as the leader. Two validators returning different verdicts that
both happen to be well-formed JSON would be a failure — we forbid that
explicitly in `validator_fn`.

### Edge cases (each has an explicit branch)

| Case | Behaviour |
|---|---|
| Issue or PR page dead / unreachable | verdict `UNRESOLVABLE`, no payout, maintainer may refund |
| LLM returns malformed JSON | coerced → `UNRESOLVABLE` |
| PR incomplete / wrong / no tests / CI failing | `REJECT`, bounty returns to `OPEN` for another contributor |
| Funding with 0 value | rejected at `create_bounty` |
| Non-GitHub or non-`/pull/` URL | rejected |
| Double payout | blocked by per-bounty `paid` flag |
| Resolve before a claim exists | rejected (state machine guard) |

---

## Repo layout

```
bountyoracle/
├── contracts/
│   ├── BountyOracle.py     # the Intelligent Contract (heart of the project)
│   └── storage_test.py     # minimal sanity contract — deploy FIRST
├── frontend/               # genlayer-js + React (Vite) app
│   ├── src/genlayer.js     # contract client wrapper
│   ├── src/App.jsx         # full user flow UI
│   └── ...
├── tests/                  # gltest suite (happy path + edge cases, with mocks)
├── scripts/deploy.js       # scriptable testnet deploy
└── README.md
```

---

## 1. Deploy the contract on GenLayer Studio (recommended)

1. Open **https://studio.genlayer.com/run-debug**
2. **Settings → Reset Storage → Confirm**, then **hard refresh** (Cmd+Shift+R / Ctrl+Shift+F5).
3. Deploy **`contracts/storage_test.py` FIRST** to confirm the environment works.
   - Click the deploy tx in the sidebar and verify **`Result: SUCCESS`** (not just `Status: FINALIZED`).
4. If storage_test succeeds, deploy **`contracts/BountyOracle.py`**.
   - The constructor takes **no arguments**.
   - After deploy, click the tx → verify **`Result: SUCCESS`**.
5. **Copy the contract address.** You'll paste it into the frontend env.

> If you see `Contract Queues not found`, line 1 of the file is not exactly
> `# v0.2.16`. If you see `TreeMap <- TreeMap`, a TreeMap was reassigned in
> `__init__`. Neither should happen here — both files already follow the rules.

### (Alternative) Scripted deploy

```bash
cd bountyoracle
npm i -g genlayer-js   # or use a local install
GENLAYER_PRIVATE_KEY=0xYOURKEY node scripts/deploy.js
# prints the contract address + the exact VITE_CONTRACT_ADDRESS line
```

---

## 2. Run the frontend

```bash
cd frontend
cp .env.example .env
# edit .env -> VITE_CONTRACT_ADDRESS=<address from step 1>
npm install
npm run dev        # http://localhost:5173
```

Full flow in the UI: **post a bounty (locks GEN) → claim it with a PR URL →
Run AI judgement → watch the on-chain verdict + rationale appear → contributor
is paid automatically on ACCEPT.** A loading state is shown while validators
reach consensus.

### Deploy the frontend to Vercel

1. Push this repo to GitHub.
2. Import it on Vercel, set **root directory = `frontend`**.
3. Add env var **`VITE_CONTRACT_ADDRESS`** = your deployed address.
4. Deploy. (`vercel.json` already sets build = `npm run build`, output = `dist`.)

---

## 3. Run the tests

The tests use `gltest`. Because `resolve()` is non-deterministic (it reads the
web + calls an LLM), the suite **installs mocks first** via `sim_installMocks`
so consensus can finalize without real internet / API keys.

```bash
cd tests
pip install -r requirements.txt
pytest -v
```

Covered: happy-path ACCEPT + payout + reputation bump, REJECT→OPEN, dead-URL
→UNRESOLVABLE→refund, zero-value rejection, bad-URL rejection, resolve-state
guard.

---

## Contract API

| Method | Kind | Purpose |
|---|---|---|
| `create_bounty(issue_url, repo_full_name, title, min_confidence)` | write payable | fund a bounty with the tx value |
| `claim_bounty(bounty_id, pr_url)` | write | contributor submits a PR |
| `resolve(bounty_id)` | write | run the on-chain AI judgement + settle |
| `refund(bounty_id)` | write | maintainer reclaims an unresolved/open bounty |
| `get_bounty(bounty_id)` | view | one bounty as JSON |
| `list_bounties()` | view | all bounties as JSON |
| `get_total()` | view | bounty count |
| `get_reputation(address_hex)` | view | accepted-bounty count for an address |

---

## Design notes (GenLayer rules honoured)

- Every contract starts with `# v0.2.16` + the `Depends` comment, imports via
  `from genlayer import *` only.
- Custom storage structs use `@allow_storage @dataclass` (there is no `Record`).
- `TreeMap` keys are `str` — calldata only supports string-keyed maps, so
  bounties are keyed by `str(bounty_id)`.
- All persisted integers are `bigint` (not `u256`/`int`) — required by the
  simulator's storage metadata validator.
- Native GEN payouts use `gl.get_contract_at(addr).emit_transfer(value=...)`.
- No `float`, no `dict`/`list` storage, class named `Contract`, `TreeMap`/
  `DynArray` never reassigned in `__init__`.
- All `gl.nondet.*` calls live inside `gl.vm.run_nondet_unsafe(leader, validator)`.

---

## Pitch

**BountyOracle dies without GenLayer:** without an on-chain contract that reads
live GitHub and reasons about code quality with an LLM, there is no trustless
judge — bounties would still need a human to decide who gets paid, which is the
exact problem we remove.
