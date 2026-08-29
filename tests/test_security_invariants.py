"""
test_security_invariants.py — FAST lane.

These tests protect the Phase 1 hardening promises without touching the
network. They inspect the on-disk repo, the docs, and (if a build
exists) the compiled bundle for regressions.

Every failure here maps to a documented threat in SECURITY.md.
"""
from pathlib import Path
import json
import re


ROOT = Path(__file__).parent.parent
FRONTEND_SRC = ROOT / "frontend" / "src"
VALIDATE_JS = FRONTEND_SRC / "lib" / "validate.js"
ADDR_JS = FRONTEND_SRC / "lib" / "addr.js"
ERR_BOUNDARY = FRONTEND_SRC / "sections" / "ErrorBoundary.jsx"
APP_JSX = FRONTEND_SRC / "App.jsx"
LIVE_JSX = FRONTEND_SRC / "sections" / "LiveVerdicts.jsx"


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


# ─── docs pack presence (T5 / general engineering) ─────────────────
def test_security_md_present_and_has_threat_ids():
    body = _read(ROOT / "SECURITY.md")
    for tid in ("T1", "T2", "T3", "T4", "T5"):
        assert tid in body, f"SECURITY.md missing threat id {tid}"


def test_architecture_md_present_with_mermaid():
    body = _read(ROOT / "ARCHITECTURE.md")
    assert "```mermaid" in body, "ARCHITECTURE.md must ship at least one Mermaid diagram"
    assert "sequenceDiagram" in body
    assert "stateDiagram" in body


def test_changelog_semver_entries():
    body = _read(ROOT / "CHANGELOG.md")
    # At least the current + previous release headings.
    assert re.search(r"^## \[0\.2\.0\]", body, re.MULTILINE), "CHANGELOG missing 0.2.0"
    assert re.search(r"^## \[0\.1\.0\]", body, re.MULTILINE), "CHANGELOG missing 0.1.0"


def test_contributing_md_present():
    body = _read(ROOT / "CONTRIBUTING.md")
    assert "Branch and commit conventions" in body


def test_adrs_present():
    adr_dir = ROOT / "docs" / "adr"
    files = sorted(p.name for p in adr_dir.glob("*.md"))
    assert any(f.startswith("0001-") for f in files), "ADR 0001 missing"
    assert any(f.startswith("0002-") for f in files), "ADR 0002 missing"


def test_samples_valid_json():
    samples = list((ROOT / "docs" / "samples").glob("*.json"))
    assert len(samples) >= 3, f"expected ≥3 sample bounties, found {len(samples)}"
    for s in samples:
        data = json.loads(_read(s))
        # Every sample declares what it does + how to reproduce it.
        for k in ("label", "why", "createBountyArgs", "claimBountyArgs"):
            assert k in data, f"{s.name} missing key `{k}`"


# ─── validate.js allowlist (T2) ─────────────────────────────────────
def test_validate_js_present_and_declares_allowlist():
    body = _read(VALIDATE_JS)
    assert "export function validateIssueUrl" in body
    assert "export function validatePrUrl" in body
    assert "export function validateRepoFullName" in body
    assert "export const ALLOWLIST" in body
    # only https:, only github.com, no query, no fragment
    assert 'u.protocol !== "https:"' in body
    assert 'u.hostname !== GH' in body
    assert "u.search || u.hash" in body


def test_validate_js_rejects_dangerous_schemes():
    """Grep-level assertion that the allowlist source explicitly names https."""
    body = _read(VALIDATE_JS)
    m = re.search(r'schemes:\s*\[\s*"([^"]+)"', body)
    assert m and m.group(1) == "https:", "ALLOWLIST.schemes must be ['https:']"


# ─── addr.js normalisation (T3) ─────────────────────────────────────
def test_addr_js_normalises_and_compares():
    body = _read(ADDR_JS)
    assert "export function normalizeAddr" in body
    assert "export function addressEquals" in body
    assert "toLowerCase()" in body, "normalizeAddr must lowercase — case bug in T3"


def test_liveverdicts_uses_address_helpers():
    body = _read(LIVE_JSX)
    assert "addressEquals(me, b.maintainer)" in body, (
        "the maintainer check must go through addressEquals (T3)"
    )
    assert "isZeroAddr(b.contributor)" in body, (
        "contributor presence must go through isZeroAddr (T3)"
    )


# ─── ErrorBoundary (T5) ─────────────────────────────────────────────
def test_error_boundary_wraps_every_section():
    body_eb = _read(ERR_BOUNDARY)
    assert "componentDidCatch" in body_eb
    assert "getDerivedStateFromError" in body_eb

    body_app = _read(APP_JSX)
    # At minimum the LiveVerdicts + several static sections must be
    # wrapped through the guard helper.
    assert 'ErrorBoundary from "./sections/ErrorBoundary.jsx"' in body_app
    assert body_app.count("guard(") >= 6, (
        "expected ≥6 sections wrapped in <ErrorBoundary>; keep the coverage broad"
    )


# ─── T4 — no private keys ever ship ────────────────────────────────
def test_no_private_key_references_in_frontend_sources():
    for p in FRONTEND_SRC.rglob("*.*"):
        if p.suffix.lower() not in {".js", ".jsx", ".ts", ".tsx", ".html"}:
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        assert "VITE_PRIVATE_KEY" not in text, f"{p.name}: forbidden VITE_PRIVATE_KEY"
        assert "GENLAYER_PRIVATE_KEY" not in text, f"{p.name}: forbidden GENLAYER_PRIVATE_KEY"


def test_no_private_key_leaked_into_built_bundle_if_any():
    """If a build has been produced locally, scan the emitted JS as well."""
    dist_js = list((ROOT / "frontend" / "dist" / "assets").glob("index-*.js")) if (
        ROOT / "frontend" / "dist" / "assets"
    ).is_dir() else []
    for js in dist_js:
        text = js.read_text(encoding="utf-8", errors="ignore")
        assert "VITE_PRIVATE_KEY" not in text, f"built bundle {js.name} leaks VITE_PRIVATE_KEY"
        assert "GENLAYER_PRIVATE_KEY" not in text, f"built bundle {js.name} leaks GENLAYER_PRIVATE_KEY"
        # Guard against a raw private-key literal — but only when it is
        # tagged as such. Public magic constants (ERC-6492 selector,
        # dead-code sentinels used by wallet SDKs) are 64-hex literals
        # too, and matching those unqualified is noise.
        assert not re.search(
            r'(?i)(private[_-]?key|pk)\s*[:=]\s*["\']0x[0-9a-fA-F]{64}',
            text,
        ), f"built bundle {js.name}: literal private key detected"


# ─── T2 — SDK client does NOT accept a full account object ─────────
def test_frontend_signer_passes_address_string_not_key():
    """genlayer.js must pass `account` as an address string (MetaMask signs)."""
    body = _read(FRONTEND_SRC / "genlayer.js")
    # We route through window.ethereum, so no createAccount/generatePrivateKey.
    assert "generatePrivateKey" not in body, (
        "generatePrivateKey must not appear in the bundle (R21/R22)"
    )
    assert "createAccount(" not in body, (
        "createAccount must not appear — MetaMask holds the key"
    )
    assert 'account: address' in body, (
        "createClient({..., account: address}) — pass a string, not an object"
    )
