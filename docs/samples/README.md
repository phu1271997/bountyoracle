# Sample bounty payloads

Three paste-ready seeds used during demos and reviewer walkthroughs.
Each file shows the arguments to `create_bounty` and `claim_bounty`,
plus the verdict we expect once `resolve()` runs.

| File | Aim | Terminal state |
|---|---|---|
| [`sample-license-bounty.json`](sample-license-bounty.json) | ACCEPT | `ACCEPTED` (contributor paid) |
| [`sample-off-topic-bounty.json`](sample-off-topic-bounty.json) | REJECT | back to `OPEN` |
| [`sample-dead-url-bounty.json`](sample-dead-url-bounty.json) | UNRESOLVABLE | `REFUNDED` after maintainer refund |

These three cover every terminal state in the state machine (see
[ARCHITECTURE.md](../../ARCHITECTURE.md#state-machine)).

Feed them through the UI in `LiveVerdicts` or through a Node script
against the deployed contract. The `value_gen` field is a decimal in
GEN — convert to base units (× 10¹⁸) when calling the contract
directly.
