"""
test_entry_capacity.py — accepted-entry vs judging-capacity.

Reviewer feedback: resolve the accepted-entry versus judging-capacity mismatch,
with five- and six-entry contract tests that include the resulting winner, fee
and withdrawal balances so the pull-payment settlement is checked against every
admitted entrant.

The fix makes admission capacity == judging capacity (MAX_JUDGED): claim_bounty
rejects an entry once MAX_JUDGED entries are already admitted, so no entrant can
ever be accepted-but-never-judged.

Two lanes:
  * fast — source-level invariants (no network).
  * slow — deploy + run the nondet judgement with mocked LLM/web, then assert
    winner / fee / withdrawal balances for EVERY admitted entrant.
"""
from pathlib import Path
import json
import re

import pytest

from conftest import install_mocks, canary_for


CONTRACT = Path(__file__).parent.parent / "contracts" / "BountyOracle.py"


def _read() -> str:
    return CONTRACT.read_text(encoding="utf-8")


# ── FAST: the mismatch is closed in source ─────────────────────────────────
def test_admission_capped_at_judging_capacity():
    body = _read()
    # claim_bounty must refuse once submission_count has reached MAX_JUDGED.
    assert "if count >= MAX_JUDGED:" in body, (
        "claim_bounty must cap admission at the judging capacity (MAX_JUDGED)"
    )
    assert "competition is full" in body


def test_resolve_judges_every_admitted_entry():
    """With admission capped at MAX_JUDGED, judged == count (every admitted
    entry is judged); the min() stays as defense in depth."""
    body = _read()
    assert "judged = min(count, MAX_JUDGED)" in body


def test_get_max_entries_view_present():
    body = _read()
    assert re.search(r"def get_max_entries\(self\)\s*->\s*int:", body), (
        "a get_max_entries view must expose the admission/judging capacity"
    )


# ── SLOW: five and six admitted entries, full settlement ───────────────────
REPO = "acme/widget"
MIN_CONF = 70


def _addr_of(submission):
    return submission["contributor"]


@pytest.mark.slow
def test_five_entries_all_judged_and_settled(bounty_factory, accounts):
    """5 admitted entries (== capacity): every one is judged, a late entrant
    (index 4) wins, and the pull-payment settlement is correct for all five."""
    issue = "https://github.com/acme/widget/issues/500"
    prs = [f"https://github.com/acme/widget/pull/{500 + i}" for i in range(1, 6)]
    maintainer = accounts[0]
    contribs = accounts[1:6]
    assert len(contribs) == 5, "need 5 distinct contributor accounts"

    contract = bounty_factory.deploy(account=maintainer, args=[])
    client = contract.provider if hasattr(contract, "provider") else contract.client

    contract.connect(maintainer).create_bounty(
        args=[issue, REPO, "Fix the parser bug", MIN_CONF]
    ).transact(value=10_000)
    for acct, pr in zip(contribs, prs):
        contract.connect(acct).claim_bounty(args=[0, pr]).transact(value=0)

    b0 = json.loads(contract.get_bounty(args=[0]).call())
    assert len(b0["submissions"]) == 5, "all five entries must be admitted"

    # Winner is the LAST admitted entrant → proves a late entry is judged + can win.
    canary = canary_for(issue, prs)
    install_mocks(
        client, verdict="ACCEPT", winner_index=4, confidence=90, canary=canary,
        notes={str(i): f"candidate {i} note" for i in range(5)},
    )
    contract.connect(maintainer).resolve(args=[0]).transact(value=0)

    b = json.loads(contract.get_bounty(args=[0]).call())
    assert b["status"] == "ACCEPTED"
    assert int(b["winner_index"]) == 4

    subs = b["submissions"]
    winner = _addr_of(subs[4])

    # Newcomer (0 prior wins) pays 2.5%: 10000 -> fee 250, net 9750.
    assert int(contract.get_treasury(args=[]).call()) == 250
    assert int(contract.get_withdrawable(args=[winner]).call()) == 9750

    # Every other admitted entrant is settled to exactly zero.
    for i in range(5):
        if i == 4:
            continue
        assert int(contract.get_withdrawable(args=[_addr_of(subs[i])]).call()) == 0, (
            f"non-winning admitted entrant {i} must have zero withdrawable"
        )

    rep = json.loads(contract.get_reputation_full(args=[winner]).call())
    assert rep["accepted"] == 1
    assert rep["earned"] == "9750"

    # Winner pulls; ledger empties; a second pull reverts.
    contract.connect(contribs[4]).withdraw(args=[]).transact(value=0)
    assert int(contract.get_withdrawable(args=[winner]).call()) == 0
    with pytest.raises(Exception):
        contract.connect(contribs[4]).withdraw(args=[]).transact(value=0)


@pytest.mark.slow
def test_sixth_entry_rejected_then_all_admitted_settled(bounty_factory, accounts):
    """A 6th entry exceeds the judging capacity and is rejected at admission
    time, so accepted-entry count can never exceed what resolve() judges. The
    five admitted entries are then judged and settled in full."""
    issue = "https://github.com/acme/widget/issues/600"
    prs = [f"https://github.com/acme/widget/pull/{600 + i}" for i in range(1, 7)]  # 6 PRs
    maintainer = accounts[0]
    contribs = accounts[1:7]
    assert len(contribs) == 6, "need 6 distinct contributor accounts"

    contract = bounty_factory.deploy(account=maintainer, args=[])
    client = contract.provider if hasattr(contract, "provider") else contract.client

    contract.connect(maintainer).create_bounty(
        args=[issue, REPO, "Fix the race condition", MIN_CONF]
    ).transact(value=20_000)

    for acct, pr in zip(contribs[:5], prs[:5]):
        contract.connect(acct).claim_bounty(args=[0, pr]).transact(value=0)

    # The 6th admission must revert — capacity == judging capacity.
    with pytest.raises(Exception):
        contract.connect(contribs[5]).claim_bounty(args=[0, prs[5]]).transact(value=0)

    b0 = json.loads(contract.get_bounty(args=[0]).call())
    assert len(b0["submissions"]) == 5, "the sixth entry must not be admitted"

    # Judge all five admitted; winner is index 2.
    canary = canary_for(issue, prs[:5])
    install_mocks(
        client, verdict="ACCEPT", winner_index=2, confidence=88, canary=canary,
        notes={str(i): f"candidate {i} note" for i in range(5)},
    )
    contract.connect(maintainer).resolve(args=[0]).transact(value=0)

    b = json.loads(contract.get_bounty(args=[0]).call())
    assert b["status"] == "ACCEPTED"
    assert int(b["winner_index"]) == 2

    subs = b["submissions"]
    winner = _addr_of(subs[2])

    # Newcomer 2.5%: 20000 -> fee 500, net 19500.
    assert int(contract.get_treasury(args=[]).call()) == 500
    assert int(contract.get_withdrawable(args=[winner]).call()) == 19500

    # Every other admitted entrant settles to zero.
    for i in range(5):
        if i == 2:
            continue
        assert int(contract.get_withdrawable(args=[_addr_of(subs[i])]).call()) == 0

    # Winner pulls; ledger empties.
    contract.connect(contribs[2]).withdraw(args=[]).transact(value=0)
    assert int(contract.get_withdrawable(args=[winner]).call()) == 0
