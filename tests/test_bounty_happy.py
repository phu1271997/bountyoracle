"""
test_bounty_happy.py — the golden path:
  maintainer creates+funds a bounty -> contributor claims with a PR ->
  resolve() reads (mocked) GitHub + LLM -> verdict ACCEPT -> escrow paid out.

All write calls use the fluent client API (R16):
    contract.connect(acct).method(args=[...]).transact(value=X)
Read-only views use .call().
"""
import json

from conftest import install_mocks


def _deploy(bounty_factory, deployer):
    # constructor takes no args; deploy from the maintainer/owner account
    contract = bounty_factory.deploy(account=deployer, args=[])
    return contract


def test_happy_path_accept_and_payout(bounty_factory, accounts):
    maintainer = accounts[0]
    contributor = accounts[1]

    contract = _deploy(bounty_factory, maintainer)
    client = contract.provider if hasattr(contract, "provider") else contract.client

    # 1) create + fund a bounty (payable -> .transact(value=...))  (R16)
    contract.connect(maintainer).create_bounty(
        args=[
            "https://github.com/acme/widget/issues/42",
            "acme/widget",
            "Fix off-by-one in parser",
            70,  # min_confidence
        ]
    ).transact(value=10_000)

    bid = 0
    raw = contract.get_bounty(args=[bid]).call()
    b = json.loads(raw)
    assert b["status"] == "OPEN"
    assert b["amount"] == "10000"

    # 2) contributor claims with a PR
    contract.connect(contributor).claim_bounty(
        args=[bid, "https://github.com/acme/widget/pull/57"]
    ).transact(value=0)

    b = json.loads(contract.get_bounty(args=[bid]).call())
    assert b["status"] == "CLAIMED"
    assert b["pr_url"].endswith("/pull/57")

    # 3) install mocks BEFORE the nondet resolve tx (R17)
    install_mocks(client, verdict="ACCEPT", confidence=92)

    # 4) resolve — AI judges ACCEPT -> payout to contributor
    contract.connect(maintainer).resolve(args=[bid]).transact(value=0)

    b = json.loads(contract.get_bounty(args=[bid]).call())
    assert b["status"] == "ACCEPTED"
    assert b["paid"] is True
    assert b["verdict"] == "ACCEPT"
    assert b["confidence"] >= 70

    # reputation incremented for the contributor
    rep = contract.get_reputation(args=[b["contributor"]]).call()
    assert int(rep) == 1
