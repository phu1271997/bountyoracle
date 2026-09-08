"""
test_ai_hardening.py — FAST lane.

Static invariants for the on-chain AI judgement. These read the on-disk
contract source only — no network, no deploy — and fail loudly if a
future edit weakens the injection defense, drops evidence, or loosens
consensus.

The Phase 2 hardening (canary defense, multi-source reads, stricter
validator, auditable `canary_verified`) is carried forward here into the
Phase 3 COMPARATIVE judgement: resolve() now ranks several rival PRs and
picks one winner, so consensus also has to agree on `winner_index`.
"""
from pathlib import Path
import re


CONTRACT = Path(__file__).parent.parent / "contracts" / "BountyOracle.py"


def _read() -> str:
    return CONTRACT.read_text(encoding="utf-8")


# ── Canary defense (carried from Phase 2) ──────────────────────────
def test_canary_helper_is_deterministic():
    """Canary must derive from the issue + rival PR URLs (deterministic
    across validators)."""
    body = _read()
    assert re.search(r"def _canary_for\(issue_url: str, candidates: list\)", body), (
        "_canary_for(issue_url, candidates) must exist"
    )
    assert 'return "CANARY-" + digest' in body
    assert 'hashlib.sha256(' in body, "canary must use a cryptographic hash"


def test_prompt_embeds_the_canary_and_labels_evidence_untrusted():
    body = _read()
    assert body.count('CANARY: {canary}') >= 1
    assert body.count('{canary}') >= 3, "canary should appear multiple times in prompt"
    assert 'UNTRUSTED user' in body or 'untrusted' in body.lower(), (
        "prompt must label evidence blocks as untrusted (T1 mitigation)"
    )


def test_canary_ok_helper_and_stripper_present():
    body = _read()
    assert "def _canary_ok(" in body
    assert "def _strip_canary(" in body


def test_normalize_coerces_missing_canary_to_unresolvable():
    body = _read()
    assert re.search(
        r"if canary and canary not in rationale:\s*\n\s*return _verdict_payload\(\s*\n?\s*[\"']UNRESOLVABLE[\"']",
        body,
    ), "_normalize_ranking must coerce to UNRESOLVABLE when the canary is absent"


# ── Comparative multi-PR reads ─────────────────────────────────────
def test_reads_issue_repo_and_every_rival_pr():
    body = _read()
    assert "def _collect_pr_blocks(" in body, (
        "resolve must gather every rival PR via _collect_pr_blocks"
    )
    # Each candidate contributes its PR page + its /files diff.
    assert re.search(r'"pr":\s*_safe_render\(pr_url\)', body)
    assert re.search(r'"files":\s*_safe_render\(pr_url \+ "/files"\)', body)
    # The issue page is read directly in both leader and validator.
    assert "_safe_render(issue_url)" in body


def test_leader_and_validator_share_the_same_ranking_prompt():
    body = _read()
    assert body.count("_build_ranking_prompt(") >= 2, (
        "leader + validator must both build the same ranking prompt"
    )


# ── Stricter validator: verdict + winner + confidence + canary ─────
def test_validator_checks_verdict_winner_confidence_and_canary():
    body = _read()
    m = re.search(
        r"def validator_fn\(leader_res:[^)]*\)\s*->\s*bool:\s*(.+?)result\s*=\s*gl\.vm\.run_nondet",
        body, re.DOTALL,
    )
    assert m, "could not locate validator_fn body"
    vf = m.group(1)
    assert '_canary_ok(leader_data, canary)' in vf, "validator must check leader canary"
    assert '_canary_ok(own, canary)' in vf, "validator must check its own canary"
    assert 'own.get("verdict", "") != leader_verdict' in vf, "validator must compare verdicts"
    assert 'winner_index' in vf, (
        "validator must require the two nodes to pick the SAME winning PR"
    )
    assert 'abs(lc - oc) > CONFIDENCE_TOLERANCE' in vf, (
        "validator must reject confidences that diverge by more than CONFIDENCE_TOLERANCE"
    )


def test_confidence_tolerance_is_bounded_and_documented():
    body = _read()
    m = re.search(r"CONFIDENCE_TOLERANCE\s*=\s*(\d+)", body)
    assert m, "CONFIDENCE_TOLERANCE constant must exist"
    n = int(m.group(1))
    assert 0 < n <= 30, f"CONFIDENCE_TOLERANCE should be a small positive number, got {n}"


# ── Comparative rubric ─────────────────────────────────────────────
def test_prompt_declares_the_comparative_rubric():
    body = _read()
    for label in ("Correctness", "Completeness", "Tests", "CI"):
        assert label in body, f'ranking prompt must call out the "{label}" axis'
    assert "winner_index" in body, "prompt must ask for a single winner_index"
    assert re.search(r"REJECT.*winner_index -1", body, re.DOTALL) or \
        "winner_index -1 if NO candidate" in body, (
        "prompt must define winner_index -1 as the 'no PR is good enough' outcome"
    )


# ── ACCEPT with an out-of-range winner is refused ──────────────────
def test_accept_with_bad_winner_index_is_refused():
    body = _read()
    assert re.search(
        r'if verdict == "ACCEPT" and not \(0 <= winner_index < candidate_count\):',
        body,
    ), "an ACCEPT whose winner_index is out of range must be coerced to UNRESOLVABLE"


# ── Auditability: canary_verified + per-PR rank/note ───────────────
def test_bounty_has_canary_verified_field_and_view_exposes_it():
    body = _read()
    assert re.search(r"canary_verified:\s*bool", body), (
        "Bounty dataclass must have `canary_verified: bool` field"
    )
    m = re.search(r"def _bounty_to_dict\(b: Bounty\)\s*->\s*dict:\s*(.+?)\n\s*\}", body, re.DOTALL)
    assert m and '"canary_verified"' in m.group(1), (
        "_bounty_to_dict must expose canary_verified in the JSON view"
    )


def test_apply_ranking_writes_canary_verified_and_per_pr_rank():
    body = _read()
    m = re.search(r"def _apply_ranking\([^)]+\)\s*->\s*None:\s*(.+?)\n    def ", body, re.DOTALL)
    assert m, "could not locate _apply_ranking body"
    ar = m.group(1)
    assert "b.canary_verified = canary_verified" in ar
    assert "_annotate_submissions(" in ar, "each judged PR must get a rank + note"


# ── Contract still keeps the existing hardening ────────────────────
def test_still_no_bare_int_in_storage():
    body = _read()
    match = re.search(
        r"class\s+Contract\s*\(\s*gl\.Contract\s*\)\s*:\n(?P<body>(?:[ \t]+.+\n)+)",
        body,
    )
    assert match
    for line in match.group("body").splitlines():
        m = re.match(r"\s+(\w+)\s*:\s*int\b", line)
        assert not m, f"storage field `{m.group(1)}: int` reintroduced"


def test_still_uses_run_nondet_wrapper():
    body = _read()
    assert "gl.vm.run_nondet_unsafe(leader_fn, validator_fn)" in body, (
        "resolve() must still wrap non-determinism in run_nondet_unsafe (see ADR 0001)"
    )
