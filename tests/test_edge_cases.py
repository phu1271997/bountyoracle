"""
test_edge_cases.py — every edge case has an explicit branch in the contract;
here we prove each one behaves (Phase 3, competitive model).

Covered:
  - REJECT (no PR good enough) -> REJECTED, submissions retained, refundable
  - dead/unreachable GitHub page -> UNRESOLVABLE, then maintainer can refund
  - zero-value funding is rejected
  - non-github / non-/pull/ URLs are rejected
  - resolving a bounty with no submissions is rejected
  - a contributor cannot submit twice; a duplicate PR URL is rejected
"""
import json
import pytest

from conftest import install_mocks, install_dead_url_mocks, canary_for


ISSUE = "https://github.com/acme/widget/issues/1"
PR_A = "https://github.com/acme/widget/pull/9"
PR_B = "https://github.com/acme/widget/pull/10"


def _deploy(bounty_factory, deployer):
    return bounty_factory.deploy(account=deployer, args=[])


def _client(contract):
    return contract.provider if hasattr(contract, "provider") else contract.client


@pytest.mark.slow
def test_reject_lands_in_rejected_and_keeps_submissions(bounty_factory, accounts):
    maintainer, contributor = accounts[0], accounts[1]
    contract = _deploy(bounty_factory, maintainer)
    client = _client(contract)

    contract.connect(maintainer).create_bounty(
        args=[ISSUE, "acme/widget", "Task", 60]
    ).transact(value=5_000)
    contract.connect(contributor).claim_bounty(args=[0, PR_A]).transact(value=0)

    canary = canary_for(ISSUE, [PR_A])
    install_mocks(client, verdict="REJECT", winner_index=-1, confidence=80,
                  canary=canary, rationale="Mock: no PR is complete; none has tests.")
    contract.connect(maintainer).resolve(args=[0]).transact(value=0)

    b = json.loads(contract.get_bounty(args=[0]).call())
    assert b["status"] == "REJECTED"          # judged; no winner
    assert b["paid"] is False
    assert b["winner_index"] == -1
    assert b["submission_count"] == 1         # the trail is preserved

    # maintainer can reclaim the escrow from REJECTED
    contract.connect(maintainer).refund(args=[0]).transact(value=0)
    assert json.loads(contract.get_bounty(args=[0]).call())["status"] == "REFUNDED"


@pytest.mark.slow
def test_dead_url_unresolvable_then_refund(bounty_factory, accounts):
    maintainer, contributor = accounts[0], accounts[1]
    contract = _deploy(bounty_factory, maintainer)
    client = _client(contract)

    contract.connect(maintainer).create_bounty(
        args=["https://github.com/acme/widget/issues/2", "acme/widget", "Task", 60]
    ).transact(value=7_000)
    contract.connect(contributor).claim_bounty(args=[0, PR_A]).transact(value=0)

    install_dead_url_mocks(client)        # all pages 404 -> UNRESOLVABLE
    contract.connect(maintainer).resolve(args=[0]).transact(value=0)

    b = json.loads(contract.get_bounty(args=[0]).call())
    assert b["status"] == "UNRESOLVABLE"
    assert b["paid"] is False

    contract.connect(maintainer).refund(args=[0]).transact(value=0)
    b = json.loads(contract.get_bounty(args=[0]).call())
    assert b["status"] == "REFUNDED"
    assert b["paid"] is True


@pytest.mark.slow
def test_zero_value_funding_rejected(bounty_factory, accounts):
    maintainer = accounts[0]
    contract = _deploy(bounty_factory, maintainer)
    with pytest.raises(Exception):
        contract.connect(maintainer).create_bounty(
            args=["https://github.com/acme/widget/issues/3", "acme/widget", "Task", 60]
        ).transact(value=0)


@pytest.mark.slow
def test_bad_urls_rejected(bounty_factory, accounts):
    maintainer, contributor = accounts[0], accounts[1]
    contract = _deploy(bounty_factory, maintainer)

    with pytest.raises(Exception):
        contract.connect(maintainer).create_bounty(
            args=["https://gitlab.com/x/y/issues/1", "x/y", "Task", 60]
        ).transact(value=1_000)

    contract.connect(maintainer).create_bounty(
        args=["https://github.com/acme/widget/issues/4", "acme/widget", "Task", 60]
    ).transact(value=1_000)
    with pytest.raises(Exception):
        contract.connect(contributor).claim_bounty(
            args=[0, "https://github.com/acme/widget/commit/abc"]
        ).transact(value=0)


@pytest.mark.slow
def test_resolve_requires_a_submission(bounty_factory, accounts):
    maintainer = accounts[0]
    contract = _deploy(bounty_factory, maintainer)
    client = _client(contract)

    contract.connect(maintainer).create_bounty(
        args=["https://github.com/acme/widget/issues/5", "acme/widget", "Task", 60]
    ).transact(value=1_000)

    install_mocks(client)
    # bounty is OPEN but has zero submissions -> resolve must fail
    with pytest.raises(Exception):
        contract.connect(maintainer).resolve(args=[0]).transact(value=0)


@pytest.mark.slow
def test_duplicate_submissions_rejected(bounty_factory, accounts):
    maintainer, alice, bob = accounts[0], accounts[1], accounts[2]
    contract = _deploy(bounty_factory, maintainer)

    contract.connect(maintainer).create_bounty(
        args=["https://github.com/acme/widget/issues/6", "acme/widget", "Task", 60]
    ).transact(value=1_000)

    contract.connect(alice).claim_bounty(args=[0, PR_A]).transact(value=0)

    # same contributor entering a second PR -> rejected
    with pytest.raises(Exception):
        contract.connect(alice).claim_bounty(args=[0, PR_B]).transact(value=0)

    # a different contributor re-using the same PR URL -> rejected
    with pytest.raises(Exception):
        contract.connect(bob).claim_bounty(args=[0, PR_A]).transact(value=0)
