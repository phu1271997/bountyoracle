# ADR 0001 — Wrap non-determinism in `gl.vm.run_nondet_unsafe`

- Status: **Accepted (with planned migration)**
- Date: 2026-08-29
- Deciders: maintainer

## Context

`BountyOracle.resolve()` calls `gl.nondet.web.render` on four GitHub
pages plus `gl.nondet.exec_prompt` on an LLM. Every non-deterministic
call must live inside one of the sanctioned wrappers (Rule #7 of the
project's GenLayer common-errors cheatsheet):

1. `gl.vm.run_nondet(leader_fn, validator_fn)` — the preferred API in
   the official SDK docs. Runs `validator_fn` in a sandbox and treats
   validator crashes as an explicit disagree, not as an ambiguous
   silent failure.
2. `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` — the lower-level
   primitive that `run_nondet` is built on. No sandbox around
   `validator_fn`; an exception becomes an indistinguishable Disagree.
3. `gl.eq_principle.strict_eq / prompt_comparative / prompt_non_comparative`
   — convenience wrappers on top of `run_nondet` for simpler payloads.

Our verdict payload is a JSON object with `verdict`, `confidence`, and
`rationale`. We need the validator to compare the *verdict* (the
semantic conclusion), not the JSON shape and not just the rationale
prose. That rules out `strict_eq` on the whole payload and rules out
`prompt_comparative` because we want a hard equality check on the
verdict enum, not an LLM-mediated similarity.

## Decision

We use **`gl.vm.run_nondet_unsafe(leader_fn, validator_fn)`** on the
current Studio build we target. The validator function is written
defensively:

- Returns `False` immediately if `leader_res` is not a
  `gl.vm.Return`.
- Returns `False` on any exception path — a crashed validator is
  treated identically to an explicit Disagree.
- Re-derives its own verdict by re-reading the same GitHub pages and
  re-prompting the LLM, then compares only the `verdict` enum
  (`ACCEPT` / `REJECT` / `UNRESOLVABLE`).

## Storage types

Related but separate: every persisted integer in `BountyOracle` is
`bigint`, never bare `int`. The simulator's storage-metadata validator
rejects bare `int` with `TypeError: use bigint or one of sized
integers please`. Sized integers like `u256` are legal but we prefer
`bigint` because the values (bounty amount, id, confidence) have no
natural bound tight enough to justify a sized type.

## Why not `run_nondet`

The Studio runtime we deploy against exposes `run_nondet_unsafe` but
not `run_nondet`. Attempting to call `gl.vm.run_nondet` raises
`AttributeError` at contract build time. We have a defensive validator
to compensate for the missing sandbox.

## Migration

When `gl.vm.run_nondet` becomes available on studionet:

1. Change one line — replace `run_nondet_unsafe` with `run_nondet`.
2. Leave the defensive validator in place — nothing about the
   comparison changes.
3. Redeploy the contract, reseed the demo bounties (Phase 2 milestone
   already redeploys anyway to ship the canary defense + multi-source
   expansion, so this migration piggy-backs on that).

## Consequences

- Positive: the contract works today on the exact Studio build we
  target.
- Negative: a validator with a genuine bug is indistinguishable from
  one that legitimately disagreed. We accept this because the
  defensive style keeps the failure loud (`False` on any exception
  path).
- Neutral: the swap to `run_nondet` will be one line + a redeploy,
  bundled with Phase 2 which already redeploys for AI enhancements.

## References

- [SECURITY.md § T1](../../SECURITY.md#t1--prompt-injection-through-the-github-issue-or-pr-body)
- Genlayer SDK docs — `gl.vm.run_nondet` API
- Cheatsheet Rule #7 (from `~GEN_RULES/02-common-errors.md`)
