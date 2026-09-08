"""
conftest.py — shared gltest fixtures + pytest markers for BountyOracle.

Two lanes:
  * fast  — tests marked (implicitly) without `slow`. Do not touch the
    network; safe to run without any funded account.
  * slow  — tests marked `@pytest.mark.slow`. Deploy a fresh contract and
    run non-deterministic transactions. Require a funded account on the
    target network.

install_mocks() is the R17-compliant mock installer for the local
simulator. `params` must be a bare dict — a list would be normalized to
an int-indexed dict and register 0 mocks.
"""
import hashlib
import json
import pytest

from gltest import get_contract_factory, get_default_account, get_accounts  # noqa: F401


def canary_for(issue_url, pr_urls):
    """Mirror of the contract's `_canary_for` so mocked LLM output can echo
    the exact canary a resolve() will demand (v0.4 competitive form:
    issue_url + every rival PR URL, in submission order)."""
    seed = issue_url
    for u in pr_urls:
        seed += "|" + u
    digest = hashlib.sha256(seed.encode("utf-8", "ignore")).hexdigest()[:12]
    return "CANARY-" + digest


@pytest.fixture
def accounts():
    """Backwards-compat: expose gltest's account list as a fixture."""
    return get_accounts()


@pytest.fixture
def default_account():
    return get_default_account()


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "slow: deploys a contract + runs non-deterministic transactions "
        "against a live network. Skipped unless -m slow is given.",
    )


def pytest_collection_modifyitems(config, items):
    """Skip @pytest.mark.slow tests unless -m slow (or -m 'slow or …') is set."""
    marker_expr = config.getoption("-m") or ""
    if "slow" in marker_expr:
        return
    skip_slow = pytest.mark.skip(
        reason="marked slow; opt in with `pytest -m slow` "
        "(needs a funded account on the target network)."
    )
    for item in items:
        if "slow" in item.keywords:
            item.add_marker(skip_slow)


def install_mocks(
    client, *,
    verdict="ACCEPT",
    winner_index=0,
    confidence=92,
    canary="",
    rationale="Mock: the winning PR resolves the issue and CI is green.",
    notes=None,
    issue_body="Mock issue: please fix the off-by-one bug in parser.",
    pr_body="Mock PR: fixes off-by-one, adds regression test. CI green.",
):
    """Register LLM + web mocks. Call this before any resolve() tx.

    v0.4 (competitive) LLM shape: verdict + winner_index + confidence +
    rationale (must contain the canary) + per-candidate notes. Pass
    `canary=canary_for(issue_url, [pr_url, ...])` so the mocked rationale
    carries the token the contract will look for."""
    full_rationale = rationale if not canary else (rationale + " " + canary)
    llm_response = json.dumps({
        "verdict": verdict,
        "winner_index": winner_index,
        "confidence": confidence,
        "rationale": full_rationale,
        "notes": notes or {"0": "Mock note for candidate 0."},
    })
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {
                ".*": llm_response,
            },
            "web_mocks": {
                ".*issue.*": {"status": 200, "body": issue_body},
                ".*pull.*": {"status": 200, "body": pr_body},
                ".*": {"status": 200, "body": "Mock GitHub page content."},
            },
        },
    )


def install_dead_url_mocks(client):
    """Simulate an unreachable GitHub page so the contract returns UNRESOLVABLE."""
    client.provider.make_request(
        method="sim_installMocks",
        params={
            "llm_mocks": {".*": json.dumps({"verdict": "UNRESOLVABLE", "confidence": 0, "rationale": "no data"})},
            "web_mocks": {".*": {"status": 404, "body": ""}},
        },
    )


@pytest.fixture
def bounty_factory():
    return get_contract_factory("BountyOracle")


@pytest.fixture
def storage_test_factory():
    return get_contract_factory("storage_test")
