"""
test_competitive.py — FAST lane.

Static invariants for the Phase 3 COMPETITIVE bounty model: many rival
PRs per bounty, one comparative on-chain AI ranking, a single paid
winner. These read the on-disk contract source only — no network, no
deploy.
"""
from pathlib import Path
import re


CONTRACT = Path(__file__).parent.parent / "contracts" / "BountyOracle.py"


def _read() -> str:
    return CONTRACT.read_text(encoding="utf-8")


# ── Storage model ──────────────────────────────────────────────────
def test_submission_struct_is_storage_safe():
    body = _read()
    assert "class Submission:" in body, "a Submission dataclass must exist"
    # @allow_storage immediately above @dataclass Submission.
    assert re.search(r"@allow_storage\s*\n@dataclass\s*\nclass Submission:", body), (
        "Submission must be an @allow_storage @dataclass"
    )
    for field in ("contributor: Address", "pr_url: str", "rank: bigint", "note: str"):
        assert field in body, f"Submission must persist `{field}`"


def test_submissions_treemap_keyed_by_bounty_and_index():
    body = _read()
    assert "submissions: TreeMap[str, Submission]" in body, (
        "rival PRs must live in a TreeMap[str, Submission]"
    )
    assert "def _sub_key(bounty_id: int, index: int) -> str:" in body, (
        "submissions must be keyed by a composite <bounty_id>:<index> key"
    )


def test_bounty_tracks_submission_count_and_winner_index():
    body = _read()
    assert "submission_count: bigint" in body
    assert "winner_index: bigint" in body


def test_max_judged_cap_present():
    body = _read()
    m = re.search(r"MAX_JUDGED\s*=\s*(\d+)", body)
    assert m, "a MAX_JUDGED cap must bound the number of PRs judged per resolve"
    assert 1 <= int(m.group(1)) <= 20


# ── claim_bounty accepts multiple rivals ───────────────────────────
def test_claim_appends_rival_and_keeps_bounty_open():
    body = _read()
    m = re.search(r"def claim_bounty\(self[^)]*\)\s*->\s*None:\s*(.+?)\n    @", body, re.DOTALL)
    assert m, "could not locate claim_bounty body"
    cb = m.group(1)
    assert "b.status != STATUS_OPEN" in cb, "claim only allowed while OPEN"
    assert "submission_count = bigint(count + 1)" in cb, "claim must append a Submission"
    assert "already been submitted" in cb, "must reject a duplicate PR URL"
    assert "already has a submission" in cb, "must reject a second entry from one contributor"


# ── resolve is a maintainer-triggered comparative judgement ────────
def test_resolve_is_maintainer_only_and_needs_submissions():
    body = _read()
    m = re.search(r"def resolve\(self, bounty_id: int\)\s*->\s*None:\s*(.+?)\n    @", body, re.DOTALL)
    assert m, "could not locate resolve body"
    rb = m.group(1)
    assert "b.status != STATUS_OPEN" in rb, "resolve only from OPEN"
    assert "only the maintainer can run judgement" in rb, "resolve must be maintainer-only"
    assert "no submissions to judge" in rb, "resolve must require ≥1 submission"
    assert "MAX_JUDGED" in rb, "resolve must cap judged PRs at MAX_JUDGED"


def test_prompt_lays_out_each_candidate_pr():
    body = _read()
    assert "CANDIDATE PR #" in body, "the ranking prompt must present each rival PR as a block"
    assert "candidate_count" in body


# ── payout goes to the winning submission only ─────────────────────
def test_only_winner_is_paid_and_reputation_credited():
    body = _read()
    m = re.search(r"def _apply_ranking\([^)]+\)\s*->\s*None:\s*(.+?)\n    def ", body, re.DOTALL)
    assert m, "could not locate _apply_ranking body"
    ar = m.group(1)
    assert "self.submissions[_sub_key(bounty_id, winner_index)]" in ar, (
        "payout must resolve the winning Submission by winner_index"
    )
    assert "emit_transfer(value=u256(amount))" in ar, "the winner must be paid the escrow"
    assert "self.accepted_count[key] = bigint(current + 1)" in ar, (
        "the winning contributor's reputation must increment"
    )
    assert "STATUS_REJECTED" in ar, "a no-good-PR outcome must land in REJECTED"


# ── views expose the competition ───────────────────────────────────
def test_views_expose_submissions():
    body = _read()
    assert re.search(r"def get_submissions\(self, bounty_id: int\)\s*->\s*str:", body), (
        "a get_submissions view must exist"
    )
    assert '"submissions"' in body, "get_bounty / list_bounties must embed the submissions list"
    assert '"winner_index"' in body, "the bounty JSON must expose winner_index"
