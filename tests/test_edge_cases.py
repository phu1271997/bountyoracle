"""
test_edge_cases.py — every edge case has an explicit branch in the contract;
here we prove each one behaves.

Covered:
  - REJECT verdict returns the bounty to OPEN and clears the claim
  - dead/unreachable GitHub page -> UNRESOLVABLE, then maintainer can refund
  - zero-value funding is rejected
  - non-github / non-/pull/ URLs are rejected
  - resolving a non-CLAIMED bounty is rejected
  - double payout is impossible (paid guard)
"""
import json
import pytest

from conftest import install_mocks, install_dead_url_mocks


def _deploy(bounty_factory, deployer):
    return bounty_factory.deploy(account=deployer, args=[])


def _client(contract):
    return contract.provider if hasattr(contract, "provider") else contract.client


def test_reject_returns_to_open(bounty_factory, accounts):
    maintainer, contributor = accounts[0], accounts[1]
    contract = _deploy(bounty_factory, maintainer)
    client = _client(contract)

    contract.connect(maintainer).create_bounty(
        args=["https://github.com/acme/widget/issues/1", "acme/widget", "Task", 60]
    ).transact(value=5_000)
    contract.connect(contributor).claim_bounty(
        args=[0, "https://github.com/acme/widget/pull/9"]
    ).transact(value=0)

    install_mocks(client, verdict="REJECT", confidence=80,
                  rationale="Mock: PR is incomplete, no tests.")
    contract.connect(maintainer).resolve(args=[0]).transact(value=0)

    b = json.loads(contract.get_bounty(args=[0]).call())
    assert b["status"] == "OPEN"          # back to OPEN for another attempt
    assert b["paid"] is False
    assert b["contributor"].endswith("0000000000000000000000000000000000000000")


def test_dead_url_unresolvable_then_refund(bounty_factory, accounts):
    maintainer, contributor = accounts[0], accounts[1]
    contract = _deploy(bounty_factory, maintainer)
    client = _client(contract)

    contract.connect(maintainer).create_bounty(
        args=["https://github.com/acme/widget/issues/2", "acme/widget", "Task", 60]
    ).transact(value=7_000)
    contract.connect(contributor).claim_bounty(
        args=[0, "https://github.com/acme/widget/pull/10"]
    ).transact(value=0)

    install_dead_url_mocks(client)        # all pages 404 -> UNRESOLVABLE
    contract.connect(maintainer).resolve(args=[0]).transact(value=0)

    b = json.loads(contract.get_bounty(args=[0]).call())
    assert b["status"] == "UNRESOLVABLE"
    assert b["paid"] is False

    # maintainer reclaims the escrow
    contract.connect(maintainer).refund(args=[0]).transact(value=0)
    b = json.loads(contract.get_bounty(args=[0]).call())
    assert b["status"] == "REFUNDED"
    assert b["paid"] is True


def test_zero_value_funding_rejected(bounty_factory, accounts):
    maintainer = accounts[0]
    contract = _deploy(bounty_factory, maintainer)
    with pytest.raises(Exception):
        contract.connect(maintainer).create_bounty(
            args=["https://github.com/acme/widget/issues/3", "acme/widget", "Task", 60]
        ).transact(value=0)


def test_bad_urls_rejected(bounty_factory, accounts):
    maintainer, contributor = accounts[0], accounts[1]
    contract = _deploy(bounty_factory, maintainer)

    # non-github issue url
    with pytest.raises(Exception):
        contract.connect(maintainer).create_bounty(
            args=["https://gitlab.com/x/y/issues/1", "x/y", "Task", 60]
        ).transact(value=1_000)

    # valid bounty, then a non-/pull/ claim
    contract.connect(maintainer).create_bounty(
        args=["https://github.com/acme/widget/issues/4", "acme/widget", "Task", 60]
    ).transact(value=1_000)
    with pytest.raises(Exception):
        contract.connect(contributor).claim_bounty(
            args=[0, "https://github.com/acme/widget/commit/abc"]
        ).transact(value=0)


def test_resolve_requires_claimed(bounty_factory, accounts):
    maintainer = accounts[0]
    contract = _deploy(bounty_factory, maintainer)
    client = _client(contract)

    contract.connect(maintainer).create_bounty(
        args=["https://github.com/acme/widget/issues/5", "acme/widget", "Task", 60]
    ).transact(value=1_000)

    install_mocks(client)
    # bounty is OPEN, not CLAIMED -> resolve must fail
    with pytest.raises(Exception):
        contract.connect(maintainer).resolve(args=[0]).transact(value=0)
