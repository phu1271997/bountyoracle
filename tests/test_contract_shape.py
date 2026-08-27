"""
test_contract_shape.py — FAST lane.

These tests only inspect the on-disk contract source and its schema. They
run offline: no deploy, no chain call, no funded account required. They
exist so `pytest` returns a green suite in CI even when a live network is
unavailable, and so obvious contract drift (renamed methods, dropped
storage fields, missing pragma) fails loudly.
"""
from pathlib import Path
import re


CONTRACT_PATH = Path(__file__).parent.parent / "contracts" / "BountyOracle.py"
STORAGE_TEST_PATH = Path(__file__).parent.parent / "contracts" / "storage_test.py"


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_bounty_oracle_source_exists():
    assert CONTRACT_PATH.is_file(), "contracts/BountyOracle.py missing"


def test_pragma_on_line_1():
    """R1: line 1 must be the version pragma."""
    first = _read(CONTRACT_PATH).splitlines()[0]
    assert first.startswith("# v0.2."), (
        "First line of BountyOracle.py must be the version pragma (e.g. `# v0.2.16`)."
    )


def test_depends_hash_present():
    """R1: the `Depends` comment with a py-genlayer hash must be at the top."""
    head = "\n".join(_read(CONTRACT_PATH).splitlines()[:5])
    assert re.search(r'"Depends":\s*"py-genlayer:[0-9a-z]+"', head), (
        "`Depends` comment with a py-genlayer:… hash must appear in the first 5 lines."
    )


def test_star_import_only():
    """R13: never alias-import genlayer; only `from genlayer import *`."""
    body = _read(CONTRACT_PATH)
    assert "from genlayer import *" in body, "must use `from genlayer import *`"
    assert not re.search(r"^import\s+genlayer\b", body, re.MULTILINE), (
        "do not use `import genlayer` — the SDK relies on the star import to inject globals."
    )
    assert not re.search(r"import\s+genlayer\s+as\s+", body), "no `import genlayer as gl`"


def test_single_contract_subclass_named_Contract():
    """Rule #6: safest convention is exactly one class named `Contract`."""
    body = _read(CONTRACT_PATH)
    matches = re.findall(r"^class\s+(\w+)\s*\(\s*gl\.Contract\s*\)\s*:", body, re.MULTILINE)
    assert matches == ["Contract"], (
        f"expected exactly one class `Contract(gl.Contract)`, got: {matches}"
    )


def test_no_bare_int_in_storage_fields():
    """R14: storage annotations must not use bare `int` — use `bigint` or sized."""
    body = _read(CONTRACT_PATH)
    # Grab class-level annotations of `Contract`
    match = re.search(
        r"class\s+Contract\s*\(\s*gl\.Contract\s*\)\s*:\n(?P<body>(?:[ \t]+.+\n)+)",
        body,
    )
    assert match, "could not locate Contract class body"
    for line in match.group("body").splitlines():
        m = re.match(r"\s+(\w+)\s*:\s*int\b", line)
        assert not m, f"storage field `{m.group(1)}: int` is forbidden; use bigint (R14)"


def test_dataclass_storage_structs_use_allow_storage():
    """R18: custom persisted structs must be @allow_storage @dataclass, not `Record`."""
    body = _read(CONTRACT_PATH)
    # Every @dataclass immediately preceded by @allow_storage
    lines = body.splitlines()
    for i, line in enumerate(lines):
        if line.strip().startswith("@dataclass"):
            prev = lines[i - 1].strip() if i > 0 else ""
            assert prev.startswith("@allow_storage"), (
                f"line {i + 1}: `@dataclass` used without `@allow_storage` above it"
            )
    assert "class Record" not in body, "there is no `Record` base class (R18); use dataclass instead"


def test_no_dict_or_list_storage_types():
    """R5: storage uses TreeMap / DynArray, never dict / list."""
    body = _read(CONTRACT_PATH)
    match = re.search(
        r"class\s+Contract\s*\(\s*gl\.Contract\s*\)\s*:\n(?P<body>(?:[ \t]+.+\n)+)",
        body,
    )
    assert match, "could not locate Contract class body"
    for line in match.group("body").splitlines():
        stripped = line.strip()
        if stripped.startswith("#") or stripped.startswith('"""') or not stripped:
            continue
        assert not re.match(r"\s+\w+\s*:\s*dict\b", line), "no `dict` in storage (R5)"
        assert not re.match(r"\s+\w+\s*:\s*list\b", line), "no `list` in storage (R5)"


def test_nondet_calls_are_wrapped():
    """Rule #7: every gl.nondet.* call sits inside a nondet wrapper."""
    body = _read(CONTRACT_PATH)
    # Cheap check: BountyOracle must reference either run_nondet or eq_principle.
    assert any(marker in body for marker in (
        "gl.vm.run_nondet",
        "gl.vm.run_nondet_unsafe",
        "gl.eq_principle.",
    )), "gl.nondet.* calls must be inside gl.vm.run_nondet(_unsafe) or gl.eq_principle.*"
    # And no bare, unwrapped `gl.nondet.exec_prompt(` call at module scope.
    assert not re.search(
        r"^\s*[^\s#]*gl\.nondet\.exec_prompt\(",
        body,
        re.MULTILINE,
    ), "found what looks like a module-scope gl.nondet.exec_prompt call"


def test_storage_test_contract_exists_and_is_wired():
    body = _read(STORAGE_TEST_PATH)
    assert body.splitlines()[0].startswith("# v0.2."), (
        "storage_test.py must have the version pragma on line 1"
    )
    assert "class Contract(gl.Contract):" in body


def test_public_write_methods_present():
    """Sanity: the four public writes the frontend calls exist by name."""
    body = _read(CONTRACT_PATH)
    for name in ("create_bounty", "claim_bounty", "resolve", "refund"):
        assert re.search(rf"def\s+{name}\s*\(", body), f"missing public write `{name}`"


def test_public_views_present():
    body = _read(CONTRACT_PATH)
    for name in ("get_bounty", "get_total", "list_bounties", "get_reputation"):
        assert re.search(rf"def\s+{name}\s*\(", body), f"missing public view `{name}`"


def test_validator_compares_verdict_meaning():
    """
    Trục 2: the validator_fn must compare the SEMANTIC verdict field,
    not the raw JSON shape.
    """
    body = _read(CONTRACT_PATH)
    assert "validator_fn" in body, "no validator_fn defined"
    # We expect a comparison against a verdict string (`ACCEPT` etc.)
    # inside validator_fn; a crude but effective smell-check.
    assert re.search(
        r"validator_fn.*?verdict",
        body,
        re.DOTALL,
    ), "validator_fn does not appear to reference `verdict` — Trục 2 says it must"


def test_no_private_key_in_frontend_bundle_sources():
    """R22: never bundle a private key via VITE_ env vars."""
    frontend_src = Path(__file__).parent.parent / "frontend" / "src"
    for py in frontend_src.rglob("*.js"):
        text = py.read_text(encoding="utf-8", errors="ignore")
        assert "VITE_PRIVATE_KEY" not in text, f"{py}: VITE_PRIVATE_KEY must not exist in bundle"
        assert "GENLAYER_PRIVATE_KEY" not in text, f"{py}: private key env var referenced in bundle"
