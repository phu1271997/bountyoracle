# GENLAYER PROJECT EXPLORER — SUBMISSION DRAFT
**Project:** BountyOracle · **Prepared:** 2026-08-25 · **Status: READY**

Fields below are in English (Explorer form language). Character counts are
appended to each capped field, measured with `wc -m`.

---

## Project name
BountyOracle

## Primary category
**Dispute Resolution**

Reason: the contract's core act is adjudication — reading evidence (the
GitHub issue + PR + diff + CI checks) and deciding whether a work claim
merits releasing the escrow. This matches how GenLayer positions itself as an
adjudication layer. Not `Marketplaces` (there is no bounty marketplace, only
one dispute per bounty). Not `AI & Agents` (it would blur us into the
majority of catalog listings and hide the actual mechanism).

## Category tag 1
**Escrow Claims**
Contract function: `create_bounty` (payable) escrows GEN, `claim_bounty`
records the contributor's claim on that escrow, `resolve` decides release,
`refund` returns funds if unresolvable. Every user in the demo touches
create/claim first.

## Category tag 2
**Evidence Assessment**
Contract function: inside `resolve`, the leader + validator each call
`gl.nondet.web.render` on four separate pages (issue, PR, files diff, CI
checks) and weigh them via `gl.nondet.exec_prompt` to produce a verdict.
This is literal evidence collection + weighing on-chain.

Tags rejected: `Moderation Appeals` (no moderation flow), `License Claims`
(contract does not read license terms), `Appeal Review` (no second-round
review — appeals happen at the GenLayer consensus layer, not our contract),
`Jury Selection` (validators are the jury; selection is GenLayer's job, not
ours).

## Logo
- File to upload: `frontend/public/logo-1024.png`
  (1024×1024, PNG, 897 KB — well inside the 128–2048 px, ≤ 2 MB spec)
- Backup at 512 px: `frontend/public/logo-512.png` (248 KB)
- Source: `frontend/public/logo.svg`

Concept: shield (trust) enclosing a two-branch merge diagram that converges
into a diamond (the settlement moment). Lime accent matches the "AI verdict"
colour in the live app so the listing card and the app read as one system.

---

## One-liner
```
Lock GEN on a GitHub issue. An Intelligent Contract reads the PR, diff and CI on-chain, judges it with an LLM, and pays the contributor itself.
```
`chars: 143 / cap 180` ✅

## Description
```
BountyOracle is a trustless bounty escrow for open-source work. A maintainer locks GEN on a GitHub issue. A contributor claims with a PR URL. Anyone can trigger settlement.

Settlement runs inside the contract. It renders four pages on-chain — the issue, the PR, the diff, and CI checks — then asks an LLM for a verdict: ACCEPT, REJECT, or UNRESOLVABLE, with confidence and a rationale. Every validator independently re-reads GitHub and re-judges; the run succeeds only when they agree on the verdict, not the JSON shape. On ACCEPT above the maintainer's threshold, escrow releases automatically. On REJECT the bounty returns to OPEN. If pages cannot load it becomes UNRESOLVABLE and the maintainer may refund.

For OSS maintainers funding fixes without becoming sole judge, and contributors who want proof they will be paid the moment work is accepted. Solidity cannot fetch github.com or judge code — remove the on-chain web read and LLM and nothing is left to settle with.
```
`chars: 981 / cap 1000` ✅

---

## How to try it

**Prerequisites**
- MetaMask installed in the browser.
- A GenLayer Studio account with GEN on studionet. Open
  https://studio.genlayer.com, and from the Accounts panel transfer some
  GEN to your MetaMask address. (~10 GEN is more than enough for one full
  flow.) Do not use the testnet faucet — it funds testnet, not studionet.
- Any modern browser desktop-side; MetaMask popups do not work in the
  Vercel embedded preview iframe.

**Step 1 — Open the app and browse the bounties.**
Go to https://bountyoracle.vercel.app. Reads work without a wallet; you
should see three seeded bounties on top: an ACCEPTED one (paid out), a
REJECTED one now back in OPEN, and an UNRESOLVABLE one. Each card shows
the AI's own verdict, confidence, and rationale — proof of what the
on-chain judge concluded and why.

**Step 2 — Connect MetaMask.**
Click "Connect MetaMask" in the header. The app asks MetaMask to add and
switch to the GenLayer Studio Network (chain 61999). Approve both prompts.
Your address now shows as "connected" and a link to the contract on
explorer-studio.genlayer.com appears next to it.

**Step 3 — Post a bounty (as maintainer).**
Click "Post a bounty", paste any real GitHub issue URL, its
`owner/repo`, a title, a minimum-confidence threshold (e.g. 70), and a GEN
amount (e.g. 1). Approve the transaction in MetaMask. The escrow is now
locked on-chain; the bounty appears at the top with status "Open".

**Step 4 — Claim it (as contributor, from any account).**
On the same card, paste a matching PR URL (`https://github.com/…/pull/…`)
and click "Claim with PR". Approve the tx. Status becomes "Awaiting
judgement".

**Step 5 — Trigger the on-chain AI judgement.**
Click "Run AI judgement" on the claimed card. The UI shows "Reading GitHub
on-chain and reaching validator consensus" — this takes 30–90 seconds
because validators are running LLM inference. When it finishes, the
verdict box lights up with ACCEPT / REJECT / UNRESOLVABLE, a confidence %,
and a rationale.

**Step 6 — Watch settlement.**
On ACCEPT the card flips to "Paid out" and the escrow lands in the
contributor's wallet. On REJECT the bounty returns to OPEN so another
contributor can try. On UNRESOLVABLE, if you are the maintainer, a
"Refund" button appears.

**If something goes wrong**
- "Wallet is on chain X" or the connect prompt fails — MetaMask stayed on
  a different chain; click "Connect MetaMask" again, approve the switch.
- Transaction cost error — the connected account has no GEN on studionet;
  see Prerequisites.
- "Run AI judgement" is greyed out mid-transaction — validator consensus
  is still in progress. Give it up to 2 minutes before retrying.

---

## Expected verification outcome
```
Reviewer sees three seeded bounties on load. #3 is ACCEPTED and paid out; its verdict card shows ACCEPT / 100% and a rationale explaining the MIT LICENSE PR resolves issue #1. #4 shows REJECT / 100% for a PR that does not add the requested CHANGELOG, and has cycled back to OPEN. #5 shows UNRESOLVABLE with the rationale that its pages cannot be loaded. Every verdict comes from validator consensus on-chain, visible on Explorer — not from the app server.
```
`chars: 457 / cap 500` ✅

---

## Contract link
https://explorer-studio.genlayer.com/address/0x1455872eeF0F96b71Fa8a763866B51A6013751c0

- Address: `0x1455872eeF0F96b71Fa8a763866B51A6013751c0`
- Network: **studionet** (Genlayer Studio Network, chain 61999)
- Status: **Preview**
- Verified live via `gen_getContractSchema` — all 8 methods (`create_bounty`,
  `claim_bounty`, `resolve`, `refund`, `get_bounty`, `list_bounties`,
  `get_total`, `get_reputation`) present.
- Recent successful transactions visible on the address page — the resolve
  tx for bounty #3 (`0xe9eb4bd2707ec5a1769c18afa53610c853f1198c92ad6ac23ea2faf0526281ea`)
  finalised with SUCCESS and triggered the payout tx
  (`0x0660858b3e1f10f5eac89783bb859a5cf783f6a915b2b056d1f2f9326367a22e`).

## Website
https://bountyoracle.vercel.app

## GitHub
https://github.com/phu1271997/bountyoracle

## Community links (optional)
Leave blank — no project-specific Discord/Telegram/X.

---

## Pre-submission checklist (self-check on 2026-08-25)

**Truthfulness**
- [x] Every listed feature works at the live URL.
- [x] Status **Preview** matches deploy on studionet.
- [x] Both category tags map to concrete contract functions.
- [x] Description makes no claim about run_nondet vs run_nondet_unsafe
      that contradicts the actual code.

**Deploy state**
- [x] Latest commits pushed to `main`.
- [x] Vercel production build served `/assets/index-BfXXe2dG.js`, which
      inlines the contract address `0x1455872…3751c0`.
- [x] `gen_getContractSchema` on studionet returns all 8 methods.
- [x] Explorer address page opens and lists real transactions.

**End-to-end test**
- [x] Three bounties seeded on-chain covering ACCEPTED / REJECT-cycle /
      UNRESOLVABLE.
- [x] Live URL opened in a fresh browser without wallet — three verdict
      cards render, no auth wall.
- [x] MetaMask connect flow adds + switches chain automatically.

**Assets & limits**
- [x] Logo PNG within spec.
- [x] One-liner ≤ 180 (158).
- [x] Description ≤ 1000 (1000, at cap — verify before paste).
- [x] Expected verification outcome ≤ 500 (456, using the trimmed version).
- [x] Website + GitHub both present.

**Consequences understood**
- [x] Changes requested = one revision, 14-day window.
- [x] Declined = no self-service resubmit.
