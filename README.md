# BountyOracle

**Trustless open-source bounties that settle themselves.** A maintainer locks
GEN against a GitHub issue. A contributor claims it with a pull request. Then
an **Intelligent Contract on GenLayer reads the live GitHub pages on-chain**
(the issue, the PR, the diff, the CI checks), **reasons about them with an
LLM**, and **pays the contributor automatically** if the work genuinely and
completely solves the issue. No maintainer has to manually adjudicate. No
single party decides alone.

- **Live app:** https://bountyoracle.vercel.app
- **Contract (studionet, Preview):** [`0xE86573cbFf9c1cF08A175D616a183BFf8eba7aC6`](https://explorer-studio.genlayer.com/address/0xE86573cbFf9c1cF08A175D616a183BFf8eba7aC6)
- **Wallet model:** MetaMask signs. No private key ships in the browser bundle.

> **Why this dies without GenLayer:** the entire product is an on-chain agent
> that *reads github.com and decides whether work is done well enough to
> release money*. A normal smart contract (Solidity) cannot fetch a web page
> or judge code quality. Remove the web-read + LLM judgement and there is
> nothing left — no oracle, nothing can settle. The AI is the settlement
> mechanism, not a garnish.

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

Our validator does **not** merely check "is this valid JSON with the right
keys." Each validator **independently re-reads GitHub and re-judges**, then
the run only succeeds if the validator reaches the **same decision**
(`ACCEPT` / `REJECT` / `UNRESOLVABLE`) as the leader. Two validators
returning different verdicts that both happen to be well-formed JSON would be
a failure — we explicitly forbid that in `validator_fn`.

### `gl.vm.run_nondet_unsafe` — deliberate fallback

`resolve()` wraps its leader + validator in
`gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`. The safer
`gl.vm.run_nondet` is preferred by the SDK docs, but on the current Studio
build we target, only `run_nondet_unsafe` is exposed by the runtime. The
validator is written defensively — it returns `False` on any exception path
so a crashed validator is equivalent to a Disagree. When the newer API lands
in the Studio build we deploy against, this call becomes a one-line swap.

### Edge cases (each has an explicit branch)

| Case | Behaviour |
|---|---|
| Issue or PR page dead / unreachable | verdict `UNRESOLVABLE`, no payout, maintainer may refund |
| LLM returns malformed JSON | coerced to `UNRESOLVABLE` |
| PR incomplete / wrong / no tests / CI failing | `REJECT`, bounty returns to `OPEN` for another contributor |
| Funding with 0 value | rejected at `create_bounty` |
| Non-GitHub or non-`/pull/` URL | rejected |
| Double payout | blocked by per-bounty `paid` flag |
| Resolve before a claim exists | rejected (state machine guard) |
| Consensus produces no usable verdict | bounty marked `UNRESOLVABLE` and rationale explains why |

---

## Live on-chain state (as seeded for the Explorer submission)

Three bounties currently live on the contract, one for each terminal state:

| # | Title | Final state | Verdict |
|---|---|---|---|
| 3 | Add MIT LICENSE file to the repo | `ACCEPTED` (paid out) | `ACCEPT` (100% conf.) |
| 4 | Add a CHANGELOG.md documenting version history | `OPEN` (returned after reject) | `REJECT` (100% conf.) |
| 5 | Investigate 404 handling in dead-repo edge case | `UNRESOLVABLE` | `UNRESOLVABLE` (page unreachable) |

Each is a real GitHub issue on this repo, paired with a real PR that either
resolves it, doesn't, or points at a nonexistent repo. The AI verdicts + full
rationales are visible in the live app.

---

## Repo layout

```
bountyoracle/
├── contracts/
│   ├── BountyOracle.py     # the Intelligent Contract (heart of the project)
│   └── storage_test.py     # minimal sanity contract — deploy FIRST
├── frontend/               # genlayer-js + React (Vite) app
│   ├── src/genlayer.js     # MetaMask-signing contract client
│   ├── src/App.jsx         # full user flow UI
│   ├── public/logo.svg     # brand mark (source)
│   └── ...
├── tests/                  # gltest suite (happy path + edge cases, with mocks)
├── scripts/deploy.js       # scriptable studionet deploy
└── README.md
```

---

## 1. Deploy the contract on GenLayer Studio

1. Open **https://studio.genlayer.com/run-debug**.
2. **Settings → Reset Storage → Confirm**, then hard refresh
   (Cmd+Shift+R / Ctrl+Shift+F5).
3. Deploy **`contracts/storage_test.py` FIRST** to confirm the environment
   works. Click the deploy tx and verify `Result: SUCCESS`.
4. If storage_test succeeds, deploy **`contracts/BountyOracle.py`**. The
   constructor takes no arguments. Verify `Result: SUCCESS`.
5. Copy the contract address — you'll paste it into Vercel.

### (Alternative) Scripted deploy

```bash
npm i -g genlayer-js
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

### Wallet setup for the demo

1. Install **MetaMask** in the browser.
2. On the live app, click **Connect MetaMask** — the site adds and switches
   to the GenLayer Studio Network automatically (chain id `61999` / `0xF1EF`,
   RPC `https://studio.genlayer.com/api`).
3. Fund your MetaMask address on studionet by transferring GEN from the
   Studio **Accounts** panel — this is the studionet-native funding source.
   (Do **not** use the testnet faucet — testnet and studionet are separate
   networks.)
4. You can now post bounties, claim with a PR, and trigger AI judgement.

### Deploy the frontend to Vercel

1. Push this repo to GitHub.
2. Import it on Vercel, set **root directory = `frontend`**.
3. Add env var **`VITE_CONTRACT_ADDRESS`** = your deployed address.
4. Deploy. (`vercel.json` already sets build = `npm run build`, output = `dist`.)

---

## 3. Run the tests

```bash
cd tests
pip install -r requirements.txt
pytest -v
```

The suite installs LLM + web mocks via `sim_installMocks` **before** any
nondet tx, so the tests finalise without needing real internet or an OpenAI
key. Covered: happy-path ACCEPT + payout + reputation bump, REJECT→OPEN,
dead-URL→UNRESOLVABLE→refund, zero-value rejection, bad-URL rejection,
resolve-state guard.

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
- Custom storage structs use `@allow_storage @dataclass` (there is no
  `Record`).
- `TreeMap` keys are `str` — calldata only supports string-keyed maps, so
  bounties are keyed by `str(bounty_id)`.
- All persisted integers are `bigint` (not `u256` / bare `int`) — required by
  the simulator's storage metadata validator.
- Native GEN payouts use `gl.get_contract_at(addr).emit_transfer(value=...)`.
- No `float`, no `dict` / `list` storage, class named `Contract`, `TreeMap` /
  `DynArray` never reassigned in `__init__`.
- All `gl.nondet.*` calls live inside
  `gl.vm.run_nondet_unsafe(leader, validator)` (see fallback note above).
- Frontend uses MetaMask (address-string account) — no private key in
  `VITE_*` env vars; SDK auto-adds/switches to the studionet chain.

---

## Pitch

**BountyOracle dies without GenLayer:** without an on-chain contract that
reads live GitHub and reasons about code quality with an LLM, there is no
trustless judge — bounties would still need a human to decide who gets paid,
which is the exact problem we remove.
