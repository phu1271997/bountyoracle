"""
conftest.py — shared gltest fixtures for BountyOracle.

The most important thing here is install_mocks(): nondet transactions
(run_nondet_unsafe -> web.render / exec_prompt) will FAIL CONSENSUS in a test
environment without real internet / OPENAI_API_KEY. When they fail, the symptom
is a confusing *state* error (e.g. "bounty is not awaiting judgement") because
the tx never finalized and state never advanced.

So we install mocks BEFORE running any nondet tx (R17).

CRITICAL (R17): the params passed to sim_installMocks MUST be a bare dict, NOT
wrapped in an outer list. A list gets normalized to an int-indexed dict and 0
mocks get registered.
"""
import json
import pytest

from gltest import get_contract_factory, default_account, accounts  # noqa: F401


def install_mocks(client, *, verdict="ACCEPT", confidence=92, rationale="Mock: PR resolves the issue and CI is green.",
                  issue_body="Mock issue: please fix the off-by-one bug in parser.",
                  pr_body="Mock PR: fixes off-by-one, adds regression test. CI green."):
    """Register LLM + web mocks. Call this before any resolve() tx."""
    llm_response = json.dumps({
        "verdict": verdict,
        "confidence": confidence,
        "rationale": rationale,
    })
    client.provider.make_request(
        method="sim_installMocks",
        params={                       # ← bare dict, NOT [ {...} ]  (R17)
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
