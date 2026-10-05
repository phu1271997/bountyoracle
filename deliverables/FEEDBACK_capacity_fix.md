# Reviewer feedback — accepted-entry vs judging-capacity

**Feedback (on the v0.4 Competitive milestone, contract
`0x19552b11A53eca997152E35E56Ac04DaaaC2DcD4`):**

> Please either reject entries beyond the supported capacity before accepting
> them or judge every admitted entry. Add boundary tests with five and six
> entrants proving that every accepted entrant is considered and that winner and
> payout selection use that complete set.

## Resolution — chose "reject beyond capacity" (v0.6)

Fixed in `contracts/BountyOracle.py` and redeployed to studionet.

| | |
|---|---|
| Fixed contract (studionet, v0.6) | `0x3F380B72e3F98b863EEf9de03Df6f75DA445f59b` |
| Deploy tx | `0x76def54f4e5ea4c5d0878d43be0d778bd6dd65f201bf419eabeb1c755449c002` |
| Live app | https://bountyoracle-phi.vercel.app |
| Fix commit | `c2624c7` |
| Tests commit | `03a5dd7` |

### What changed
`resolve()` ranks at most `MAX_JUDGED` (5) entries. Previously `claim_bounty`
accepted an unbounded number, so a 6th admitted entrant was never judged, could
never win, and was never settled against. `claim_bounty` now **rejects an entry
once `MAX_JUDGED` entries are already admitted** — admission capacity now equals
judging capacity, so **every admitted entrant is judged** and winner + payout
selection run over the complete admitted set. A `get_max_entries` view exposes
the capacity; the frontend disables the submit control at "Full (5/5)".

```python
# claim_bounty — admission capped at the judging capacity
if count >= MAX_JUDGED:
    raise Exception(
        "BountyOracle: competition is full — the maximum of "
        + str(MAX_JUDGED) + " entries (the judging capacity) has been reached"
    )
```

### Boundary tests (`tests/test_entry_capacity.py`)
- **Five entrants (== capacity):** all five admitted → all five judged. The
  winner is the **last** admitted entry (index 4) — impossible under the old
  truncation — proving winner + payout selection use the complete set. Asserts
  winner payout (net 2.5% fee), treasury, and **zero** withdrawable for every
  other admitted entrant; the winner's pull empties the ledger.
- **Six entrants:** the sixth admission **reverts**; exactly five are admitted
  and all five are judged, with the same winner/fee/withdrawal checks across
  every admitted entrant.
- Fast source-level invariants assert the cap and the `get_max_entries` view.
