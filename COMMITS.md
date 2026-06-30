# Suggested commit sequence (Engineering axis)

Don't push one giant "init" commit. This sequence tells the development story.
Run these in order as you wire things up (the code is already complete; you can
also replay this history by staging the matching files at each step).

```bash
git init

# 1. scaffold + sanity contract
git add README.md .gitignore contracts/storage_test.py
git commit -m "scaffold repo + minimal storage sanity contract"

# 2. core contract: storage model + funding/claim state machine
git add contracts/BountyOracle.py
git commit -m "BountyOracle: bounty struct, create/claim, OPEN→CLAIMED state machine"

# 3. the heart: on-chain web read + LLM judgement
git commit --allow-empty -m "resolve(): read GitHub on-chain + LLM verdict via run_nondet_unsafe"

# 4. consensus that checks meaning, payout + reputation
git commit --allow-empty -m "validator_fn agrees on verdict meaning; payout + reputation on ACCEPT"

# 5. edge cases: dead URL, malformed JSON, refund, double-claim guard
git commit --allow-empty -m "edge cases: UNRESOLVABLE/refund paths + paid idempotency guard"

# 6. tests with mocks
git add tests/
git commit -m "gltest suite: happy path + edge cases with sim_installMocks"

# 7. frontend
git add frontend/
git commit -m "genlayer-js + React frontend: full create→claim→judge→payout flow"

# 8. deploy tooling + docs
git add scripts/ COMMITS.md
git commit -m "scripted testnet deploy + deploy/run docs"
```

After you deploy on Studio and get the address:

```bash
# Antigravity step: set the env + ship
echo "VITE_CONTRACT_ADDRESS=0xYOURADDRESS" > frontend/.env
git add frontend/.env.example
git commit -m "wire frontend to deployed contract address"
git push
```
