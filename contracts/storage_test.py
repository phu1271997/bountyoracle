# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *


# ─────────────────────────────────────────────────────────────────────────────
# storage_test.py
# A minimal "does the environment work?" contract. Deploy this FIRST on Studio
# (after Reset Storage + Hard refresh). If this succeeds, the runtime/version is
# wired correctly and you can deploy BountyOracle.py.
#
# It exercises every storage primitive BountyOracle relies on:
#   - a sized-int scalar field
#   - a str scalar field
#   - a DynArray[str]
#   - a TreeMap[str, bigint]
# without ever reassigning TreeMap()/DynArray() in __init__ (Rule 2).
# ─────────────────────────────────────────────────────────────────────────────
class Contract(gl.Contract):
    counter: u256
    label: str
    notes: DynArray[str]
    scores: TreeMap[str, bigint]

    def __init__(self):
        # Scalars may be set. TreeMap/DynArray must NOT be touched here (Rule 2);
        # GenVM auto-initializes them to empty.
        self.counter = u256(0)
        self.label = "bounty-oracle-storage-test"

    @gl.public.write
    def bump(self) -> None:
        self.counter = u256(int(self.counter) + 1)

    @gl.public.write
    def add_note(self, note: str) -> None:
        self.notes.append(note)

    @gl.public.write
    def set_score(self, key: str, value: int) -> None:
        # Stored value is bigint (R14). Cast the incoming int to bigint.
        self.scores[key] = bigint(value)

    @gl.public.view
    def get_counter(self) -> int:
        return int(self.counter)

    @gl.public.view
    def get_label(self) -> str:
        return self.label

    @gl.public.view
    def get_notes(self) -> DynArray[str]:
        return self.notes

    @gl.public.view
    def get_score(self, key: str) -> int:
        if key not in self.scores:
            return 0
        return int(self.scores[key])
