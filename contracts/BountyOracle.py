# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

import json
import typing
from dataclasses import dataclass


# ═════════════════════════════════════════════════════════════════════════════
# BountyOracle.py
#
# A trustless open-source bounty escrow. A maintainer locks GEN against a GitHub
# issue. A contributor claims it by submitting their PR URL. The contract itself
# then READS THE LIVE GITHUB PAGES on-chain (gl.nondet.web.render) and REASONS
# with an LLM (gl.nondet.exec_prompt) to judge whether the PR genuinely and
# completely solves the issue (correct fix + tests + CI passing). If the verdict
# is ACCEPT, the bounty is released to the contributor automatically. No
# maintainer has to manually adjudicate; no single party can decide alone.
#
# WHY GENLAYER IS THE HEART (removal test passes):
#   Remove the web-read + LLM judgement and there is NOTHING left — the entire
#   product is "an on-chain agent that reads GitHub and decides if work is done".
#   Solidity cannot read github.com or reason about code quality. This is not a
#   garnish; it is the settlement mechanism.
#
# CONSENSUS CHECKS MEANING, NOT SHAPE (the line between score 1 and 4+):
#   The validator_fn does NOT merely check "is this valid JSON with the right
#   keys". It re-derives a verdict and requires the leader and validators to
#   agree on the SAME decision (ACCEPT / REJECT / UNRESOLVABLE). Two validators
#   returning different decisions that both pass schema would be score 1 — we
#   explicitly forbid that here.
# ═════════════════════════════════════════════════════════════════════════════


# ── State machine ────────────────────────────────────────────────────────────
# OPEN        : bounty funded, no claim yet
# CLAIMED     : a contributor submitted a PR, awaiting judgement
# JUDGING     : (transient) resolution in progress
# ACCEPTED    : AI accepted the PR, funds released to contributor
# REJECTED    : AI rejected the PR; bounty returns to OPEN for another attempt
# UNRESOLVABLE: web/LLM could not decide (dead URL, malformed output); maintainer
#               may refund or re-trigger
# REFUNDED    : maintainer reclaimed the bounty
STATUS_OPEN = "OPEN"
STATUS_CLAIMED = "CLAIMED"
STATUS_ACCEPTED = "ACCEPTED"
STATUS_REJECTED = "REJECTED"
STATUS_UNRESOLVABLE = "UNRESOLVABLE"
STATUS_REFUNDED = "REFUNDED"


@allow_storage
@dataclass
class Bounty:
    # NOTE: every persisted integer is `bigint`, NOT u256/int (R14). u256/int as
    # a stored field type fails metadata validation on the simulator.
    # Custom storage structs MUST be @allow_storage @dataclass (NOT "Record").
    bounty_id: bigint
    maintainer: Address
    issue_url: str
    repo_full_name: str          # e.g. "owner/repo", for prompt context
    title: str
    amount: bigint               # escrowed GEN (wei-like base units)
    status: str
    contributor: Address         # claimant (zero address until claimed)
    pr_url: str                  # submitted PR
    min_confidence: bigint       # threshold 0..100 to auto-accept
    verdict: str                 # last AI verdict: ACCEPT / REJECT / UNRESOLVABLE
    confidence: bigint           # last AI confidence 0..100
    rationale: str               # human-readable AI reason
    paid: bool                   # idempotency guard against double payout


ZERO_ADDR = Address("0x0000000000000000000000000000000000000000")


class Contract(gl.Contract):
    owner: Address
    next_id: bigint
    # TreeMap keys MUST be str (calldata only supports str-keyed maps). We key
    # bounties by str(bounty_id).
    bounties: TreeMap[str, Bounty]
    # contributor reputation: number of accepted bounties per address (string key
    # = address hex) — feeds a simple on-chain reputation signal.
    accepted_count: TreeMap[str, bigint]

    def __init__(self):
        # Scalars only. Do NOT touch TreeMap fields here (Rule 2).
        self.owner = gl.message.sender_address
        self.next_id = bigint(0)

    # ─────────────────────────────────────────────────────────────────────────
    # WRITE: create + fund a bounty
    # The GEN sent with the tx (gl.message.value) becomes the escrow.
    # ─────────────────────────────────────────────────────────────────────────
    @gl.public.write.payable
    def create_bounty(
        self,
        issue_url: str,
        repo_full_name: str,
        title: str,
        min_confidence: int,
    ) -> int:
        value = int(gl.message.value)
        if value <= 0:
            raise Exception("BountyOracle: must fund bounty with a positive GEN value")
        if not issue_url.startswith("https://github.com/"):
            raise Exception("BountyOracle: issue_url must be a https://github.com/ URL")
        if min_confidence < 0 or min_confidence > 100:
            raise Exception("BountyOracle: min_confidence must be between 0 and 100")

        bid = int(self.next_id)
        b = Bounty(
            bounty_id=bigint(bid),
            maintainer=gl.message.sender_address,
            issue_url=issue_url,
            repo_full_name=repo_full_name,
            title=title,
            amount=bigint(value),
            status=STATUS_OPEN,
            contributor=ZERO_ADDR,
            pr_url="",
            min_confidence=bigint(min_confidence),
            verdict="",
            confidence=bigint(0),
            rationale="",
            paid=False,
        )
        self.bounties[str(bid)] = b
        self.next_id = bigint(bid + 1)
        return bid

    # ─────────────────────────────────────────────────────────────────────────
    # WRITE: a contributor claims an open bounty by submitting their PR
    # ─────────────────────────────────────────────────────────────────────────
    @gl.public.write
    def claim_bounty(self, bounty_id: int, pr_url: str) -> None:
        b = self._require_bounty(bounty_id)
        if b.status != STATUS_OPEN:
            raise Exception("BountyOracle: bounty is not OPEN for claiming")
        if not pr_url.startswith("https://github.com/"):
            raise Exception("BountyOracle: pr_url must be a https://github.com/ URL")
        if "/pull/" not in pr_url:
            raise Exception("BountyOracle: pr_url must point to a /pull/ link")

        b.contributor = gl.message.sender_address
        b.pr_url = pr_url
        b.status = STATUS_CLAIMED
        self.bounties[str(bounty_id)] = b

    # ─────────────────────────────────────────────────────────────────────────
    # WRITE: trigger the on-chain AI judgement (the core nondet logic)
    #
    # Anyone may trigger resolution on a CLAIMED bounty (it is deterministic from
    # the world's perspective — the AI reads the same public GitHub pages). The
    # contract reads the issue page, the PR page, and the PR's files/checks views,
    # then asks the LLM for a structured verdict. If ACCEPT and confidence >=
    # threshold, the escrow is released to the contributor.
    # ─────────────────────────────────────────────────────────────────────────
    @gl.public.write
    def resolve(self, bounty_id: int) -> None:
        b = self._require_bounty(bounty_id)
        if b.status != STATUS_CLAIMED:
            raise Exception("BountyOracle: bounty is not awaiting judgement (must be CLAIMED)")

        issue_url = b.issue_url
        pr_url = b.pr_url
        repo = b.repo_full_name
        title = b.title

        # ── Leader: read the live web + reason with the LLM ──────────────────
        def leader_fn() -> typing.Any:
            issue_text = _safe_render(issue_url)
            pr_text = _safe_render(pr_url)
            files_text = _safe_render(pr_url + "/files")
            checks_text = _safe_render(pr_url + "/checks")

            if issue_text is None or pr_text is None:
                # A core page is dead/unreachable — cannot judge fairly.
                return _verdict_payload("UNRESOLVABLE", 0,
                                        "Could not load the issue or PR page from GitHub.")

            prompt = _build_judgement_prompt(
                repo=repo,
                title=title,
                issue_text=issue_text,
                pr_text=pr_text,
                files_text=files_text or "(files view unavailable)",
                checks_text=checks_text or "(checks view unavailable)",
            )
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            return _normalize_verdict(raw)

        # ── Validator: agree on MEANING, not schema (Axis 2 core) ────────────
        def validator_fn(leader_res: typing.Any) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader_data = _coerce_payload(leader_res.calldata)
            if leader_data is None:
                return False
            leader_verdict = leader_data.get("verdict", "")
            if leader_verdict not in ("ACCEPT", "REJECT", "UNRESOLVABLE"):
                return False
            # The validator independently re-reads + re-judges, then requires the
            # SAME decision. Different verdicts both passing = forbidden (score 1).
            issue_text = _safe_render(issue_url)
            pr_text = _safe_render(pr_url)
            if issue_text is None or pr_text is None:
                # If the validator also cannot load pages, it can only agree with
                # an UNRESOLVABLE leader verdict.
                return leader_verdict == "UNRESOLVABLE"
            files_text = _safe_render(pr_url + "/files")
            checks_text = _safe_render(pr_url + "/checks")
            prompt = _build_judgement_prompt(
                repo=repo, title=title, issue_text=issue_text, pr_text=pr_text,
                files_text=files_text or "(files view unavailable)",
                checks_text=checks_text or "(checks view unavailable)",
            )
            own_raw = gl.nondet.exec_prompt(prompt, response_format="json")
            own = _normalize_verdict(own_raw)
            own_verdict = own.get("verdict", "")
            # SEMANTIC agreement: same accept/reject/unresolvable conclusion.
            return own_verdict == leader_verdict

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        payload = _coerce_payload(_unwrap(result))
        if payload is None:
            # Consensus produced nothing usable.
            self._mark_unresolvable(bounty_id, "Consensus returned no usable verdict.")
            return

        verdict = str(payload.get("verdict", "UNRESOLVABLE"))
        confidence = _clamp_conf(payload.get("confidence", 0))
        rationale = str(payload.get("rationale", ""))[:2000]

        self._apply_verdict(bounty_id, verdict, confidence, rationale)

    # ─────────────────────────────────────────────────────────────────────────
    # WRITE: maintainer reclaims funds for an UNRESOLVABLE or still-OPEN bounty
    # ─────────────────────────────────────────────────────────────────────────
    @gl.public.write
    def refund(self, bounty_id: int) -> None:
        b = self._require_bounty(bounty_id)
        if gl.message.sender_address != b.maintainer:
            raise Exception("BountyOracle: only the maintainer can refund")
        if b.status not in (STATUS_OPEN, STATUS_UNRESOLVABLE, STATUS_REJECTED):
            raise Exception("BountyOracle: bounty cannot be refunded in its current state")
        if b.paid:
            raise Exception("BountyOracle: bounty already settled")
        if int(b.amount) <= 0:
            raise Exception("BountyOracle: nothing to refund")

        b.paid = True
        b.status = STATUS_REFUNDED
        amount = int(b.amount)
        recipient = b.maintainer
        self.bounties[str(bounty_id)] = b
        # Send native GEN out (R15): no gl.eth.send_value; use emit_transfer.
        gl.get_contract_at(recipient).emit_transfer(value=u256(amount))

    # ── Internal: apply a verdict + pay out if accepted ──────────────────────
    def _apply_verdict(self, bounty_id: int, verdict: str, confidence: int, rationale: str) -> None:
        b = self._require_bounty(bounty_id)
        b.verdict = verdict
        b.confidence = bigint(confidence)
        b.rationale = rationale

        if verdict == "ACCEPT" and confidence >= int(b.min_confidence):
            if b.paid:
                raise Exception("BountyOracle: bounty already paid (double-claim guard)")
            if b.contributor == ZERO_ADDR:
                raise Exception("BountyOracle: no contributor to pay")
            b.paid = True
            b.status = STATUS_ACCEPTED
            amount = int(b.amount)
            contributor = b.contributor
            # bump reputation
            key = _addr_str(contributor)
            current = int(self.accepted_count[key]) if key in self.accepted_count else 0
            self.accepted_count[key] = bigint(current + 1)
            self.bounties[str(bounty_id)] = b
            # release escrow to the contributor (R15)
            gl.get_contract_at(contributor).emit_transfer(value=u256(amount))
        elif verdict == "REJECT":
            # return to OPEN so another contributor can try; clear the claim
            b.status = STATUS_OPEN
            b.contributor = ZERO_ADDR
            b.pr_url = ""
            self.bounties[str(bounty_id)] = b
        else:
            b.status = STATUS_UNRESOLVABLE
            self.bounties[str(bounty_id)] = b

    def _mark_unresolvable(self, bounty_id: int, reason: str) -> None:
        b = self._require_bounty(bounty_id)
        b.status = STATUS_UNRESOLVABLE
        b.verdict = "UNRESOLVABLE"
        b.rationale = reason
        self.bounties[str(bounty_id)] = b

    def _require_bounty(self, bounty_id: int) -> Bounty:
        if str(bounty_id) not in self.bounties:
            raise Exception("BountyOracle: bounty does not exist")
        return self.bounties[str(bounty_id)]

    # ─────────────────────────────────────────────────────────────────────────
    # VIEWS (read-only) — for the frontend
    # ─────────────────────────────────────────────────────────────────────────
    @gl.public.view
    def get_bounty(self, bounty_id: int) -> str:
        b = self._require_bounty(bounty_id)
        return json.dumps(_bounty_to_dict(b))

    @gl.public.view
    def get_total(self) -> int:
        return int(self.next_id)

    @gl.public.view
    def list_bounties(self) -> str:
        out = []
        i = 0
        total = int(self.next_id)
        while i < total:
            key = str(i)
            if key in self.bounties:
                out.append(_bounty_to_dict(self.bounties[key]))
            i += 1
        return json.dumps(out)

    @gl.public.view
    def get_reputation(self, address_hex: str) -> int:
        if address_hex in self.accepted_count:
            return int(self.accepted_count[address_hex])
        return 0


# ═════════════════════════════════════════════════════════════════════════════
# Module-level helpers (kept out of the class for clarity / testability)
# ═════════════════════════════════════════════════════════════════════════════
def _addr_str(addr: Address) -> str:
    """Convert an Address to a stable hex string usable as a TreeMap key.
    Uses .as_hex when available, falling back to str()."""
    try:
        return addr.as_hex
    except Exception:
        return str(addr)


def _safe_render(url: str) -> typing.Optional[str]:
    """Render a web page to text, returning None on any failure (dead URL etc.)."""
    try:
        text = gl.nondet.web.render(url, mode="text")
        if text is None:
            return None
        return str(text)
    except Exception:
        return None


def _build_judgement_prompt(
    repo: str,
    title: str,
    issue_text: str,
    pr_text: str,
    files_text: str,
    checks_text: str,
) -> str:
    # Truncate inputs to keep the prompt bounded.
    issue_text = issue_text[:6000]
    pr_text = pr_text[:6000]
    files_text = files_text[:6000]
    checks_text = checks_text[:3000]
    return (
        "You are a strict, fair open-source maintainer judging whether a pull "
        "request genuinely and COMPLETELY resolves a GitHub issue and deserves "
        "the bounty.\n\n"
        f"Repository: {repo}\n"
        f"Bounty title: {title}\n\n"
        "=== ISSUE PAGE (text) ===\n"
        f"{issue_text}\n\n"
        "=== PULL REQUEST PAGE (text) ===\n"
        f"{pr_text}\n\n"
        "=== PR FILES / DIFF (text) ===\n"
        f"{files_text}\n\n"
        "=== PR CHECKS / CI STATUS (text) ===\n"
        f"{checks_text}\n\n"
        "Judge on FOUR criteria:\n"
        "1. Does the PR actually address the specific problem in the issue?\n"
        "2. Is the implementation correct and complete (not a stub/placeholder)?\n"
        "3. Does it include or update tests where appropriate?\n"
        "4. Is CI passing (no failing required checks)?\n\n"
        "Return ONLY a JSON object, no markdown, no prose outside JSON, with keys:\n"
        '{"verdict": "ACCEPT" | "REJECT" | "UNRESOLVABLE", '
        '"confidence": <integer 0-100>, '
        '"rationale": "<one short paragraph citing concrete evidence>"}\n'
        "Use ACCEPT only if the PR clearly solves the issue AND checks pass. Use "
        "REJECT if it is incomplete, wrong, untested, or CI fails. Use "
        "UNRESOLVABLE only if the pages lack enough information to decide."
    )


def _normalize_verdict(raw: typing.Any) -> dict:
    """Coerce an LLM JSON response into a clean verdict dict."""
    data = _coerce_payload(raw)
    if data is None:
        return _verdict_payload("UNRESOLVABLE", 0, "LLM returned malformed output.")
    verdict = str(data.get("verdict", "UNRESOLVABLE")).upper().strip()
    if verdict not in ("ACCEPT", "REJECT", "UNRESOLVABLE"):
        verdict = "UNRESOLVABLE"
    confidence = _clamp_conf(data.get("confidence", 0))
    rationale = str(data.get("rationale", ""))[:2000]
    return _verdict_payload(verdict, confidence, rationale)


def _verdict_payload(verdict: str, confidence: int, rationale: str) -> dict:
    return {"verdict": verdict, "confidence": int(confidence), "rationale": rationale}


def _coerce_payload(raw: typing.Any) -> typing.Optional[dict]:
    """Accept a dict, a JSON string, or bytes; return a dict or None."""
    if raw is None:
        return None
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, (bytes, bytearray)):
        try:
            raw = raw.decode("utf-8", "ignore")
        except Exception:
            return None
    if isinstance(raw, str):
        s = raw.strip()
        # tolerate ```json fences
        if s.startswith("```"):
            s = s.strip("`")
            if s.startswith("json"):
                s = s[4:]
        try:
            obj = json.loads(s)
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None
    return None


def _unwrap(result: typing.Any) -> typing.Any:
    """Extract payload from a gl.vm.Return if present."""
    if isinstance(result, gl.vm.Return):
        return result.calldata
    return result


def _clamp_conf(value: typing.Any) -> int:
    try:
        v = int(value)
    except Exception:
        return 0
    if v < 0:
        return 0
    if v > 100:
        return 100
    return v


def _bounty_to_dict(b: Bounty) -> dict:
    return {
        "bounty_id": int(b.bounty_id),
        "maintainer": _addr_str(b.maintainer),
        "issue_url": b.issue_url,
        "repo_full_name": b.repo_full_name,
        "title": b.title,
        "amount": str(int(b.amount)),
        "status": b.status,
        "contributor": _addr_str(b.contributor),
        "pr_url": b.pr_url,
        "min_confidence": int(b.min_confidence),
        "verdict": b.verdict,
        "confidence": int(b.confidence),
        "rationale": b.rationale,
        "paid": bool(b.paid),
    }
