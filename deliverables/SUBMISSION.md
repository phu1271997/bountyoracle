# GenLayer Project Explorer — BountyOracle submission

Everything a reviewer needs to paste into the Explorer form. Character
counts are measured with `wc -m` (verified below). All fields are in
English because the Explorer form is English.

**Prepared 2026-08-27. Status: READY.**

---

## 01 — Identity

| Field | Value |
|---|---|
| Project name | **BountyOracle** |
| Primary category | **Dispute Resolution** |
| Category tag 1 | **Escrow Claims** |
| Category tag 2 | **Evidence Assessment** |
| Logo (upload) | `deliverables/logo-1024.png` (1024 × 1024 · PNG · 391 KB) |
| Logo (fallback) | `deliverables/logo-512.png` (512 × 512 · PNG · 106 KB) |
| Logo source | `deliverables/logo.svg` |

**Why Dispute Resolution as primary:** the contract's core act is
adjudication — reading evidence (issue + PR + diff + CI) and deciding
whether a work claim merits releasing the escrow. Matches how GenLayer
positions itself as an adjudication layer.

**Rejected primaries:**
- `Marketplaces` — there is no bounty marketplace; each bounty has one
  dispute at a time.
- `AI & Agents` — too broad; most catalog listings are AI-powered, this
  would hide the actual mechanism.
- `Developer Tools` — the audience is developers but the mechanism is
  dispute resolution, not tooling.

**Why these two tags:** each maps to a real contract function.

- **Escrow Claims** — `create_bounty` (payable) escrows GEN,
  `claim_bounty` records the contributor's claim, `resolve` decides
  release, `refund` returns funds. Every user touches escrow first, so
  this is tag 1.
- **Evidence Assessment** — inside `resolve`, both the leader and
  validator call `gl.nondet.web.render` on four separate pages (issue,
  PR, files diff, CI checks) and weigh them via `gl.nondet.exec_prompt`
  to produce a verdict. Literal evidence weighing on-chain.

**Rejected tags:**
- `Moderation Appeals` — no moderation flow.
- `License Claims` — the contract does not read license terms.
- `Appeal Review` — no second-round review by us; appeals happen at
  the GenLayer consensus layer, not in our contract.
- `Jury Selection` — validators are the jury; selection is GenLayer's
  job, not the app's.

---

## 02 — Project summary

### One-liner (cap 180)

```
Lock GEN on a GitHub issue. An Intelligent Contract reads the PR, diff and CI on-chain, judges it with an LLM, and pays the contributor itself.
```

**143 / 180** ✅

### Description (cap 1000)

```
BountyOracle is a trustless bounty escrow for open-source work. A maintainer locks GEN on a GitHub issue. A contributor claims with a PR URL. Anyone can trigger settlement.

Settlement runs inside the contract. It renders four pages on-chain — the issue, the PR, the diff, and CI checks — then asks an LLM for a verdict: ACCEPT, REJECT, or UNRESOLVABLE, with confidence and a rationale. Every validator independently re-reads GitHub and re-judges; the run succeeds only when they agree on the verdict, not the JSON shape. On ACCEPT above the maintainer's threshold, escrow releases automatically. On REJECT the bounty returns to OPEN. If pages cannot load it becomes UNRESOLVABLE and the maintainer may refund.

For OSS maintainers funding fixes without becoming sole judge, and contributors who want proof they will be paid the moment work is accepted. Solidity cannot fetch github.com or judge code — remove the on-chain web read and LLM and nothing is left to settle with.
```

**981 / 1000** ✅

---

## 03 — How to try it

**Prerequisites**
- MetaMask installed in a desktop browser.
- A GenLayer Studio account. Open https://studio.genlayer.com and, from
  the Accounts panel, transfer GEN to your MetaMask address. Roughly 5
  GEN covers a full flow. **Do not use the testnet faucet** — testnet
  and studionet are different networks.

**Step 1 — Open the app.** Go to https://bountyoracle.vercel.app.
Reads work without a wallet; you should see live bounties immediately.

**Step 2 — Connect MetaMask.** Click *Connect MetaMask* in the header.
Approve two prompts: add and switch to the GenLayer Studio Network
(chain 61999).

**Step 3 — Post a bounty (as maintainer).** Scroll to *Live verdicts* →
*Post a bounty*. Paste a real GitHub issue URL, the `owner/repo`, a
title, a min-confidence threshold (e.g. 70), and a GEN amount. Approve
the transaction in MetaMask. The bounty appears with status *Open*.

**Step 4 — Claim with a PR (from any account).** On the same card,
paste a matching `https://github.com/…/pull/…` URL and click
*Claim with PR*. Approve the tx. Status becomes *Awaiting judgement*.

**Step 5 — Run AI judgement.** Click *Run AI judgement*. The UI shows
"Reading GitHub on-chain and reaching validator consensus" for 30–90
seconds while validators run LLM inference. The verdict card then
shows ACCEPT / REJECT / UNRESOLVABLE, a confidence percentage, and a
rationale.

**Step 6 — Watch settlement.** On ACCEPT the escrow lands in the
contributor's wallet. On REJECT the bounty returns to OPEN so another
contributor can try. On UNRESOLVABLE, the maintainer can click
*Refund*.

**If something goes wrong**
- *Wallet on wrong chain* — click *Connect MetaMask* again and approve
  the switch.
- *Transaction fails with insufficient funds* — the connected account
  has no GEN on studionet; see prerequisites.
- *"AI judging on-chain" hangs* — validator consensus can take up to 2
  minutes; give it that long before retrying.

---

## 04 — Expected verification outcome (cap 500)

```
Reviewer sees four seeded bounties on load. #3 is ACCEPTED and paid out; its verdict card shows ACCEPT / 100% and a rationale explaining the MIT LICENSE PR resolves issue #1. #4 shows REJECT / 100% for a PR that does not add the requested CHANGELOG, and has cycled back to OPEN. #5 shows REFUNDED after an earlier UNRESOLVABLE verdict, proving the maintainer-refund path. Every verdict comes from validator consensus on-chain — not from the app server.
```

**454 / 500** ✅ *(measured; re-run `wc -m` before pasting if any word is edited)*

---

## 05 — Links

| Field | Value |
|---|---|
| Contract link | https://explorer-studio.genlayer.com/address/0x1455872eeF0F96b71Fa8a763866B51A6013751c0 |
| Contract address | `0x1455872eeF0F96b71Fa8a763866B51A6013751c0` |
| Network | studionet (chain 61999) |
| Status | **Preview** |
| Website | https://bountyoracle.vercel.app |
| GitHub | https://github.com/phu1271997/bountyoracle |
| Community links (optional) | Leave blank |

The RPC `gen_getContractSchema` returns all eight methods; the address
page on Explorer shows real transactions with SUCCESS. The
recent-most notable pair is the resolve tx for bounty #3
`0xe9eb4bd2707ec5a1769c18afa53610c853f1198c92ad6ac23ea2faf0526281ea`
and its triggered payout
`0x0660858b3e1f10f5eac89783bb859a5cf783f6a915b2b056d1f2f9326367a22e`.

---

## 06 — On-chain state seeded for the reviewer

| # | Title | Final status | Verdict |
|---|---|---|---|
| 3 | Add MIT LICENSE file to the repo | `ACCEPTED` (paid) | `ACCEPT` / 100% |
| 4 | Add a CHANGELOG.md documenting version history | `OPEN` (post-reject cycle) | `REJECT` / 100% |
| 5 | Investigate 404 handling in dead-repo edge case | `REFUNDED` | `UNRESOLVABLE` |

Each is a real GitHub issue on the project's repo paired with a real
PR that either resolves it, does not, or points at a nonexistent repo.
The full AI rationales are visible in the live app.

---

## 07 — Pre-submission checklist (walked 2026-08-27)

**Truthfulness**
- [x] Every listed feature works at the live URL.
- [x] Status **Preview** matches the studionet deployment.
- [x] Both category tags map to concrete contract functions.
- [x] Description makes no claim about `run_nondet` vs
      `run_nondet_unsafe` that contradicts the code.

**Deploy state**
- [x] Latest commits pushed to `main` on GitHub.
- [x] Vercel production build served `/assets/index-BNNvRWHW.js`,
      which inlines the contract address `0x14558…3751c0`.
- [x] `gen_getContractSchema` returns all 8 methods.
- [x] Explorer address page opens and lists real SUCCESS transactions.

**End-to-end test**
- [x] Four seeded bounties on-chain covering
      ACCEPTED, OPEN (post-REJECT), REFUNDED — plus three legacy
      OPEN test entries kept at the bottom of the list.
- [x] Live URL opened in a fresh browser without a wallet — verdict
      cards render, no auth wall.
- [x] MetaMask connect flow adds + switches chain automatically.

**Assets & limits**
- [x] Logo PNG within spec (128 – 2048 px, ≤ 2 MB).
- [x] One-liner ≤ 180 (143).
- [x] Description ≤ 1000 (981).
- [x] Expected verification outcome ≤ 500 (454).
- [x] Website + GitHub both present.

**Consequences understood**
- [x] *Changes requested* = one revision, 14-day window.
- [x] *Declined* = no self-service resubmit.

---

## 08 — Hard character counts (reproduce with `wc -m`)

```bash
$ printf '%s' "Lock GEN on a GitHub issue. An Intelligent Contract reads the PR, diff and CI on-chain, judges it with an LLM, and pays the contributor itself." | wc -m
143
$ printf '%s' "$(cat description.txt)" | wc -m       # 981
$ printf '%s' "$(cat verify.txt)"     | wc -m         # 454
```
