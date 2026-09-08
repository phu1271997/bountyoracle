"""
test_bounty_happy.py — the golden path (Phase 3, competitive):
  maintainer creates+funds a bounty -> TWO contributors each submit a rival
  PR -> maintainer resolve() reads (mocked) GitHub + LLM -> the comparative
  jury picks winner_index=1 -> only that contributor is paid.

All write calls use the fluent client API (R16):
    contract.connect(acct).method(args=[...]).transact(value=X)
Read-only views use .call().
"""
import json
import pytest

from conftest import install_mocks, canary_for


ISSUE = "https://github.com/acme/widget/issues/42"
PR_A = "https://github.com/acme/widget/pull/57"   # index 0
PR_B = "https://github.com/acme/widget/pull/58"   # index 1 (winner)


def _deploy(bounty_factory, deployer):
    # constructor takes no args; deploy from the maintainer/owner account
    return bounty_factory.deploy(account=deployer, args=[])


@pytest.mark.slow
def test_competitive_accept_pays_only_the_winner(bounty_factory, accounts):
    maintainer = accounts[0]
    alice = accounts[1]
    bob = accounts[2]

    contract = _deploy(bounty_factory, maintainer)
    client = contract.provider if hasattr(contract, "provider") else contract.client

    # 1) create + fund a bounty (payable -> .transact(value=...))  (R16)
    contract.connect(maintainer).create_bounty(
        args=[ISSUE, "acme/widget", "Fix off-by-one in parser", 70]
    ).transact(value=10_000)

    bid = 0
    b = json.loads(contract.get_bounty(args=[bid]).call())
    assert b["status"] == "OPEN"
    assert b["amount"] == "10000"
    assert b["submission_count"] == 0

    # 2) two contributors enter rival PRs; the bounty stays OPEN
    contract.connect(alice).claim_bounty(args=[bid, PR_A]).transact(value=0)
    contract.connect(bob).claim_bounty(args=[bid, PR_B]).transact(value=0)

    b = json.loads(contract.get_bounty(args=[bid]).call())
    assert b["status"] == "OPEN"
    assert b["submission_count"] == 2
    assert len(b["submissions"]) == 2

    # 3) install mocks BEFORE the nondet resolve tx (R17). The comparative
    #    jury names candidate 1 (Bob) as the winner. The mocked rationale
    #    must carry the exact canary the contract derives.
    canary = canary_for(ISSUE, [PR_A, PR_B])
    install_mocks(
        client, verdict="ACCEPT", winner_index=1, confidence=92, canary=canary,
        notes={"0": "Partial fix, no tests.", "1": "Complete fix with tests. Winner."},
    )

    # 4) only the maintainer may trigger judgement
    contract.connect(maintainer).resolve(args=[bid]).transact(value=0)

    b = json.loads(contract.get_bounty(args=[bid]).call())
    assert b["status"] == "ACCEPTED"
    assert b["paid"] is True
    assert b["verdict"] == "ACCEPT"
    assert b["winner_index"] == 1
    assert b["confidence"] >= 70
    assert b["pr_url"] == PR_B

    # the winning submission is ranked 1; the loser 2
    subs = {s["index"]: s for s in b["submissions"]}
    assert subs[1]["rank"] == 1
    assert subs[0]["rank"] == 2

    # reputation incremented for the WINNER only
    assert int(contract.get_reputation(args=[subs[1]["contributor"]]).call()) == 1
    assert int(contract.get_reputation(args=[subs[0]["contributor"]]).call()) == 0


@pytest.mark.slow
def test_only_maintainer_can_resolve(bounty_factory, accounts):
    maintainer, alice = accounts[0], accounts[1]
    contract = _deploy(bounty_factory, maintainer)

    contract.connect(maintainer).create_bounty(
        args=[ISSUE, "acme/widget", "Task", 60]
    ).transact(value=1_000)
    contract.connect(alice).claim_bounty(args=[0, PR_A]).transact(value=0)

    # a contributor cannot force an early judgement
    with pytest.raises(Exception):
        contract.connect(alice).resolve(args=[0]).transact(value=0)
