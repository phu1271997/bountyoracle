"""
test_integrations.py — FAST lane.

Phase 3 integration invariants. All static — inspect the on-disk
frontend sources; no network calls. These fail loudly if a later edit
drops an integration entry point, removes the cache, or leaks a token
into the bundle.
"""
from pathlib import Path
import re


ROOT = Path(__file__).parent.parent
FE = ROOT / "frontend" / "src"
GH_JS = FE / "lib" / "github.js"
ENS_JS = FE / "lib" / "ens.js"
SHARE_JS = FE / "lib" / "share.js"
LIVE_JSX = FE / "sections" / "LiveVerdicts.jsx"


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


# ── GitHub integration ────────────────────────────────────────────
def test_github_js_exports_expected_surface():
    body = _read(GH_JS)
    for name in (
        "export function parseGithubUrl",
        "export async function fetchIssueMeta",
        "export async function fetchPrMeta",
        "export function prStateBadge",
        "export function issueStateBadge",
    ):
        assert name in body, f"github.js must export {name}"


def test_github_js_uses_public_api_no_token():
    body = _read(GH_JS)
    assert "https://api.github.com/" in body, "must hit api.github.com"
    # No Authorization or hard-coded token — public API only.
    assert "Authorization" not in body, "github.js must not send any Authorization header"
    assert "GITHUB_TOKEN" not in body, "github.js must not reference a token env var"
    assert "Bearer " not in body


def test_github_js_caches_and_dedupes():
    body = _read(GH_JS)
    assert "_cache" in body, "github.js should keep a response cache"
    assert "_pending" in body, "github.js should dedupe concurrent requests"


def test_parse_github_url_kinds_covered():
    body = _read(GH_JS)
    assert "issues" in body and "pull" in body


# ── ENS integration ──────────────────────────────────────────────
def test_ens_js_exports():
    body = _read(ENS_JS)
    assert "export async function resolveEns" in body
    assert "export function formatWithEns" in body


def test_ens_js_uses_public_endpoint_no_key():
    body = _read(ENS_JS)
    assert "https://api.ensdata.net/" in body
    assert "API_KEY" not in body and "apiKey" not in body
    assert "Authorization" not in body


def test_ens_js_caches_and_dedupes():
    body = _read(ENS_JS)
    assert "_cache" in body and "_pending" in body


# ── Share + deep link ────────────────────────────────────────────
def test_share_js_exports():
    body = _read(SHARE_JS)
    for name in (
        "export function bountyDeepLink",
        "export function readDeepLinkId",
        "export function bountyShareText",
        "export async function shareBounty",
    ):
        assert name in body, f"share.js must export {name}"


def test_share_uses_native_api_with_clipboard_fallback():
    body = _read(SHARE_JS)
    assert "navigator.share" in body, "share.js must attempt navigator.share first"
    assert "navigator.clipboard" in body, "share.js must fall back to clipboard"


def test_deep_link_reader_returns_null_on_bad_input():
    """`readDeepLinkId` must guard against non-integer / negative ids."""
    body = _read(SHARE_JS)
    # Static check that the guard is present.
    assert "parseInt" in body
    assert "Number.isInteger" in body
    assert ">= 0" in body


# ── LiveVerdicts wire-up ─────────────────────────────────────────
def test_liveverdicts_wires_all_three_integrations():
    body = _read(LIVE_JSX)
    # Imports
    for imp in ("fetchIssueMeta", "fetchPrMeta", "prStateBadge",
                "resolveEns", "shareBounty", "readDeepLinkId"):
        assert imp in body, f"LiveVerdicts must import {imp}"
    # UI hooks
    assert "highlighted={highlightId === b.bounty_id}" in body, (
        "cards must receive the highlighted prop for deep-link scroll"
    )
    assert "onClick={onShare}" in body, "each card must expose a Share button"


def test_liveverdicts_blocks_closed_issue_and_closed_pr():
    body = _read(LIVE_JSX)
    assert 'issueHint.data.state === "closed"' in body, (
        "CreateForm must refuse a bounty on an already-closed GitHub issue"
    )
    assert 'prMeta.state === "closed" && !prMeta.merged' in body, (
        "submitClaim must refuse a PR that GitHub already closed unmerged"
    )
