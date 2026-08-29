# Architecture

BountyOracle is one Intelligent Contract on GenLayer studionet plus a
static Vercel-hosted frontend that speaks to it through
`window.ethereum`. There is no bespoke backend, no queue, no cron —
every user-visible state change is a real transaction against the
contract.

This document is the layering, the sequences, and the storage model.

---

## System diagram

```mermaid
flowchart LR
    subgraph Client["Browser (Vercel-hosted static bundle)"]
        UI[React app]
        SDK[genlayer-js client]
        MM[MetaMask]
    end

    subgraph Chain["GenLayer studionet · chain 61999"]
        Contract[[BountyOracle contract\n0x1455...3751c0]]
        Validators[(Validator jury\n5 nodes)]
    end

    subgraph External["Public web"]
        GH((github.com))
    end

    UI -->|read/write calls| SDK
    SDK -->|eth_sendTransaction| MM
    MM -->|signed tx| Contract
    Contract -->|gl.nondet.web.render| GH
    Contract -->|gl.nondet.exec_prompt| Validators
    Validators -->|verdict consensus| Contract
    Contract -->|state / events| UI
```

The client never talks to GitHub directly. `resolve()` triggers each
validator to fetch GitHub pages themselves; the resulting verdict lands
inside the contract's storage and is what the client reads back.

---

## `resolve()` sequence

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant FE as Frontend
    participant MM as MetaMask
    participant C as Contract
    participant V as Validator jury
    participant GH as github.com

    U->>FE: click "Run AI judgement"
    FE->>MM: writeContract(resolve, id)
    MM->>C: signed tx
    C->>V: run_nondet_unsafe(leader_fn, validator_fn)
    par leader
        V->>GH: render(issue, pr, /files, /checks)
        V-->>V: exec_prompt(structured evidence)
        V-->>C: verdict JSON
    and each validator
        V->>GH: render(issue, pr, /files, /checks)
        V-->>V: exec_prompt(structured evidence)
        V-->>V: compare verdict to leader
    end
    C->>C: _apply_verdict — pay / reopen / mark UNRESOLVABLE
    C-->>FE: receipt + updated bounty
    FE-->>U: verdict card + payout status
```

The validator function returns `False` on any exception path, so a
crashed validator counts as a Disagree — never as a silent agreement.

---

## Storage model

```mermaid
classDiagram
    class Contract {
        +Address owner
        +bigint next_id
        +TreeMap[str, Bounty] bounties
        +TreeMap[str, bigint] accepted_count
    }
    class Bounty {
        +bigint bounty_id
        +Address maintainer
        +str issue_url
        +str repo_full_name
        +str title
        +bigint amount
        +str status
        +Address contributor
        +str pr_url
        +bigint min_confidence
        +str verdict
        +bigint confidence
        +str rationale
        +bool paid
    }
    Contract "1" o-- "many" Bounty : bounties
```

Every persisted integer is `bigint` (see
[ADR 0001](docs/adr/0001-run-nondet-unsafe.md#storage-types)); bare
`int` is forbidden as a storage type by the simulator.

TreeMap keys are always `str` — calldata only supports string-keyed
maps, so bounty ids are stored as `str(bounty_id)` and addresses as
their `.as_hex` string.

---

## State machine

```mermaid
stateDiagram-v2
    [*] --> OPEN: create_bounty (payable)
    OPEN --> CLAIMED: claim_bounty(pr_url)
    OPEN --> REFUNDED: refund
    CLAIMED --> ACCEPTED: resolve → ACCEPT & conf ≥ min
    CLAIMED --> OPEN: resolve → REJECT (clear claim)
    CLAIMED --> UNRESOLVABLE: resolve → UNRESOLVABLE
    UNRESOLVABLE --> REFUNDED: refund
    ACCEPTED --> [*]
    REFUNDED --> [*]
```

`ACCEPTED` and `REFUNDED` are terminal. `paid = True` is the
double-payout guard; `_apply_verdict` refuses to release if it is
already set.

---

## Frontend composition

```mermaid
flowchart TD
    App[App.jsx composition root]
    App --> Nav
    App --> Hero
    App --> Stats
    App --> Problem
    App --> How[HowItWorks]
    App --> Live[LiveVerdicts]
    App --> Signals
    App --> Arch[Architecture SVG]
    App --> Use[UseCases]
    App --> Cmp[Compare]
    App --> FAQ
    App --> Steps[HowToUse]
    App --> Foot[Footer]
    App --> EB[ErrorBoundary wrap]

    Live --> Card[BountyCard]
    Live --> Form[CreateBountyForm]

    App --> GL[genlayer.js\nMetaMask signer]
    App --> V[lib/validate.js\nURL allowlist]
    App --> A[lib/addr.js\ncase-insensitive]
```

`App.jsx` is composition only. Sections are presentational — the only
one that owns writes is `LiveVerdicts`, and it consumes the wallet
state via props.

---

## Failure modes

| Failure | Where | User-facing behaviour |
|---|---|---|
| Wallet on wrong chain | `wallet_switchEthereumChain` prompt refused | Banner: switch chain manually, then retry |
| GitHub page 404 in leader | `_safe_render` returns `None` | Verdict = `UNRESOLVABLE`, maintainer may refund |
| LLM output not JSON | `_normalize_verdict` coerces | Verdict = `UNRESOLVABLE` with a diagnostic rationale |
| Validator quorum not reached | `run_nondet_unsafe` returns error | State unchanged; the same `resolve()` can be re-called |
| React section throws | `ErrorBoundary` catches | Boxed error inline; other sections stay interactive |

---

## References

- Contract source: [`contracts/BountyOracle.py`](contracts/BountyOracle.py)
- Frontend entry: [`frontend/src/App.jsx`](frontend/src/App.jsx)
- SDK client: [`frontend/src/genlayer.js`](frontend/src/genlayer.js)
- Threat model: [`SECURITY.md`](SECURITY.md)
- Decision records: [`docs/adr/`](docs/adr/)
