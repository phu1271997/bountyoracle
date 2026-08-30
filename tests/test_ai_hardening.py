"""
test_ai_hardening.py — FAST lane.

Static invariants for the Phase 2 AI hardening. These read the on-disk
contract source only — no network, no deploy — and fail loudly if a
future edit weakens the injection defense, drops a source, or loosens
consensus.
"""
from pathlib import Path
import re


CONTRACT = Path(__file__).parent.parent / "contracts" / "BountyOracle.py"


def _read() -> str:
    return CONTRACT.read_text(encoding="utf-8")


# ── Canary defense ─────────────────────────────────────────────────
def test_canary_helper_is_deterministic():
    """Canary must derive from URLs (deterministic across validators)."""
    body = _read()
    assert re.search(r"def _canary_for\(issue_url: str, pr_url: str\)", body), (
        "_canary_for(issue_url, pr_url) must exist"
    )
    assert 'return "CANARY-" + digest' in body or 'return "CANARY-"' in body
    assert 'hashlib.sha256(seed)' in body, "canary must use a cryptographic hash"


def test_prompt_embeds_the_canary_and_labels_evidence_untrusted():
    body = _read()
    # The prompt must reference the canary at least twice: once to require
    # echoing, once inside the JSON template.
    assert body.count('CANARY: {canary}') >= 1
    assert body.count('{canary}') >= 3, "canary should appear multiple times in prompt"
    assert 'UNTRUSTED user' in body or 'untrusted' in body.lower(), (
        "prompt must label evidence blocks as untrusted (T1 mitigation)"
    )


def test_canary_ok_helper_and_stripper_present():
    body = _read()
    assert "def _canary_ok(" in body
    assert "def _strip_canary(" in body


def test_normalize_verdict_coerces_missing_canary_to_unresolvable():
    body = _read()
    assert re.search(
        r"if canary and canary not in rationale:\s*\n\s*return _verdict_payload\(\s*\n?\s*[\"']UNRESOLVABLE[\"']",
        body,
    ), "_normalize_verdict must coerce to UNRESOLVABLE when the canary is absent"


# ── Multi-source expansion ─────────────────────────────────────────
def test_collect_sources_reads_six_pages():
    body = _read()
    assert "def _collect_sources(" in body
    # 6 pages: issue, pr, files, checks, commits, repo
    for key in ("issue", "pr", "files", "checks", "commits", "repo"):
        assert re.search(rf'"{key}":\s*_safe_render', body), (
            f'_collect_sources must call _safe_render for `{key}`'
        )


def test_resolve_uses_the_multi_source_collector():
    body = _read()
    assert "_collect_sources(issue_url, pr_url, repo_url)" in body, (
        "resolve() must use _collect_sources so leader + validator read the same six pages"
    )


# ── Stricter validator (verdict + confidence + canary) ─────────────
def test_validator_checks_verdict_confidence_and_canary():
    body = _read()
    # Look at the validator_fn body specifically.
    m = re.search(r"def validator_fn\(leader_res:[^)]*\)\s*->\s*bool:\s*(.+?)result\s*=\s*gl\.vm\.run_nondet",
                  body, re.DOTALL)
    assert m, "could not locate validator_fn body"
    vf = m.group(1)
    assert '_canary_ok(leader_data, canary)' in vf, "validator must check leader canary"
    assert '_canary_ok(own, canary)' in vf, "validator must check its own canary"
    assert 'own.get("verdict", "") != leader_verdict' in vf, "validator must compare verdicts"
    assert 'abs(lc - oc) > CONFIDENCE_TOLERANCE' in vf, (
        "validator must reject confidences that diverge by more than CONFIDENCE_TOLERANCE"
    )


def test_confidence_tolerance_is_bounded_and_documented():
    body = _read()
    m = re.search(r"CONFIDENCE_TOLERANCE\s*=\s*(\d+)", body)
    assert m, "CONFIDENCE_TOLERANCE constant must exist"
    n = int(m.group(1))
    assert 0 < n <= 30, f"CONFIDENCE_TOLERANCE should be a small positive number, got {n}"


# ── Multi-perspective prompt ───────────────────────────────────────
def test_prompt_declares_three_perspectives():
    body = _read()
    for label in ("Correctness", "Tests", "CI"):
        assert label in body, f'prompt must call out the "{label}" perspective'


# ── Bounty gains an auditable canary_verified flag ─────────────────
def test_bounty_has_canary_verified_field_and_view_exposes_it():
    body = _read()
    assert re.search(r"canary_verified:\s*bool", body), (
        "Bounty dataclass must have `canary_verified: bool` field"
    )
    # _bounty_to_dict must include it so the frontend can render it.
    m = re.search(r"def _bounty_to_dict\(b: Bounty\)\s*->\s*dict:\s*(.+?)\n\s*\}", body, re.DOTALL)
    assert m and '"canary_verified"' in m.group(1), (
        "_bounty_to_dict must expose canary_verified in the JSON view"
    )


def test_apply_verdict_writes_canary_verified():
    body = _read()
    m = re.search(r"def _apply_verdict\([^)]+\)\s*->\s*None:\s*(.+?)def ", body, re.DOTALL)
    assert m, "could not locate _apply_verdict body"
    assert "b.canary_verified = canary_verified" in m.group(1)


# ── Contract still keeps the existing hardening ────────────────────
def test_still_no_bare_int_in_storage():
    """Regression guard: the Phase 2 rewrite must not reintroduce bare int fields."""
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
    # Still wrapped, still unsafe on this Studio build (ADR 0001 explains
    # why); the migration to run_nondet is one line when the SDK exposes it.
    assert "gl.vm.run_nondet_unsafe(leader_fn, validator_fn)" in body, (
        "resolve() must still wrap non-determinism in run_nondet_unsafe (see ADR 0001)"
    )
