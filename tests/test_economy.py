"""
test_economy.py — FAST lane.

Static invariants for the Phase 4 escrow economics: pull-payment ledger,
protocol-fee treasury, tiered reputation, and the on-chain leaderboard.
These read the on-disk contract source only — no network, no deploy.
"""
from pathlib import Path
import json
import re

import pytest

from conftest import install_mocks, canary_for


CONTRACT = Path(__file__).parent.parent / "contracts" / "BountyOracle.py"


def _read() -> str:
    return CONTRACT.read_text(encoding="utf-8")


# ── Pull-payment escrow ────────────────────────────────────────────
def test_withdrawable_ledger_storage_present():
    body = _read()
    assert "withdrawable: TreeMap[str, bigint]" in body, (
        "a withdrawable ledger TreeMap must back the pull-payment pattern"
    )
    assert "def _credit(self, addr: Address, amount: int) -> None:" in body


def test_no_push_transfer_in_settlement_paths():
    """Settlement (_apply_ranking / refund) must CREDIT the ledger, never PUSH.
    emit_transfer may appear ONLY inside withdraw / withdraw_treasury."""
    body = _read()
    # Grab _apply_ranking + refund bodies and assert no emit_transfer there.
    for fn in ("refund", "_apply_ranking"):
        m = re.search(rf"def {fn}\([^)]*\)\s*->\s*None:\s*(.+?)\n    (?:@|def )", body, re.DOTALL)
        assert m, f"could not locate {fn} body"
        assert "emit_transfer" not in m.group(1), (
            f"{fn} must not PUSH funds — credit the withdrawable ledger instead"
        )
    assert "self._credit(" in body


def test_withdraw_is_checks_effects_interactions():
    body = _read()
    m = re.search(r"def withdraw\(self\)\s*->\s*None:\s*(.+?)\n    @", body, re.DOTALL)
    assert m, "a withdraw() method must exist"
    wd = m.group(1)
    # balance zeroed before the external transfer
    zero_at = wd.find("self.withdrawable[key] = bigint(0)")
    xfer_at = wd.find("emit_transfer")
    assert zero_at != -1 and xfer_at != -1 and zero_at < xfer_at, (
        "withdraw() must zero the balance BEFORE calling emit_transfer (CEI)"
    )


# ── Protocol fee + treasury ────────────────────────────────────────
def test_treasury_and_fee_present():
    body = _read()
    assert "treasury: bigint" in body
    assert re.search(r"BASE_FEE_BPS\s*=\s*\d+", body), "a BASE_FEE_BPS constant must exist"
    assert "fee = (amount * fee_bps) // 10000" in body, "payout must deduct the tiered fee"
    assert "self.treasury = bigint(int(self.treasury) + fee)" in body
    m = re.search(r"def withdraw_treasury\(self\)\s*->\s*None:\s*(.+?)\n    (?:@|def )", body, re.DOTALL)
    assert m and "only the owner" in m.group(1), "treasury sweep must be owner-only"


# ── Tiered reputation ──────────────────────────────────────────────
def test_tier_table_and_helpers():
    body = _read()
    assert "TIER_TABLE" in body
    for tier in ("Expert", "Trusted", "Contributor", "Newcomer"):
        assert tier in body, f"tier `{tier}` must be defined"
    assert "def _tier_for_wins(" in body
    assert "def _fee_bps_for_wins(" in body


def test_fee_discount_is_monotonic_by_tier():
    """Higher tiers must pay a fee that is <= lower tiers (a real discount),
    and the top tier must be free."""
    body = _read()
    m = re.search(r"TIER_TABLE\s*=\s*\[(.+?)\]", body, re.DOTALL)
    assert m, "TIER_TABLE must be a list literal"
    rows = re.findall(r'\(\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(\d+)\s*\)', m.group(1))
    assert len(rows) >= 3
    # rows are ordered high tier -> low tier; fee must be non-decreasing.
    fees = [int(r[2]) for r in rows]
    assert fees == sorted(fees), "fee_bps must rise as tier falls (a discount for higher tiers)"
    assert fees[0] == 0, "the top tier must pay a 0 bps fee"


def test_reputation_tracks_earned_and_wins():
    body = _read()
    assert "earned: TreeMap[str, bigint]" in body
    assert "self.earned[key] = bigint(prev_earned + net)" in body
    assert "self.accepted_count[key] = bigint(wins_before + 1)" in body


# ── Leaderboard ────────────────────────────────────────────────────
def test_leaderboard_view_and_backing_array():
    body = _read()
    assert "winners: DynArray[Address]" in body, "a DynArray must back the leaderboard"
    assert re.search(r"def get_leaderboard\(self\)\s*->\s*str:", body)
    assert "rows.sort(" in body, "leaderboard must be ranked"
    assert "def _track_winner(" in body, "distinct winners must be tracked for the leaderboard"


def test_new_views_exposed():
    body = _read()
    for v in ("get_withdrawable", "get_treasury", "get_reputation_full", "get_leaderboard", "get_fee_bps"):
        assert re.search(rf"def {v}\(", body), f"missing public view `{v}`"


# ── Live behaviour (slow) ──────────────────────────────────────────
ISSUE = "https://github.com/acme/widget/issues/77"
PR = "https://github.com/acme/widget/pull/78"


@pytest.mark.slow
def test_pull_payment_fee_and_leaderboard(bounty_factory, accounts):
    maintainer, alice = accounts[0], accounts[1]
    contract = bounty_factory.deploy(account=maintainer, args=[])
    client = contract.provider if hasattr(contract, "provider") else contract.client

    contract.connect(maintainer).create_bounty(
        args=[ISSUE, "acme/widget", "Fix it", 70]
    ).transact(value=10_000)
    contract.connect(alice).claim_bounty(args=[0, PR]).transact(value=0)

    canary = canary_for(ISSUE, [PR])
    install_mocks(client, verdict="ACCEPT", winner_index=0, confidence=90, canary=canary)
    contract.connect(maintainer).resolve(args=[0]).transact(value=0)

    b = json.loads(contract.get_bounty(args=[0]).call())
    assert b["status"] == "ACCEPTED"
    winner = b["submissions"][0]["contributor"]

    # Newcomer (0 prior wins) pays the base 2.5% fee: 10000 -> fee 250, net 9750.
    assert int(contract.get_treasury(args=[]).call()) == 250
    assert int(contract.get_withdrawable(args=[winner]).call()) == 9750

    rep = json.loads(contract.get_reputation_full(args=[winner]).call())
    assert rep["accepted"] == 1
    assert rep["earned"] == "9750"
    assert rep["tier_name"] == "Newcomer"

    board = json.loads(contract.get_leaderboard(args=[]).call())
    assert any(r["address"] == winner and r["accepted"] == 1 for r in board)

    # Pull the funds: the ledger empties (checks-effects-interactions).
    contract.connect(alice).withdraw(args=[]).transact(value=0)
    assert int(contract.get_withdrawable(args=[winner]).call()) == 0

    # A second withdraw with nothing owed must revert.
    with pytest.raises(Exception):
        contract.connect(alice).withdraw(args=[]).transact(value=0)
