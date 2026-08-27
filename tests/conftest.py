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
import json
import pytest

from gltest import get_contract_factory, get_default_account, get_accounts  # noqa: F401


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
    confidence=92,
    rationale="Mock: PR resolves the issue and CI is green.",
    issue_body="Mock issue: please fix the off-by-one bug in parser.",
    pr_body="Mock PR: fixes off-by-one, adds regression test. CI green.",
):
    """Register LLM + web mocks. Call this before any resolve() tx."""
    llm_response = json.dumps({
        "verdict": verdict,
        "confidence": confidence,
        "rationale": rationale,
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
