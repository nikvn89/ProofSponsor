# Tests

| Suite | What it runs | Command |
| --- | --- | --- |
| `direct/test_v4_direct.py` | `contracts/ProofSponsorV4.py` inside the real py-genlayer v0.2.16 SDK (genlayer-test Direct Mode). Web pages and model answers are mocked; the native-transfer interface is replaced by a recorder so each payout is checked by recipient and amount. | `python -m pytest tests/direct -q -p no:cacheprovider` |
| `direct/test_v3_contrast.py` | The same harness on `ProofSponsorV3.py`, reproducing the weaknesses V4 closes. | (same command) |
| `mutation_check.py` | 45 one-change faults in the V4 contract; the Direct Mode suite must fail on every one. | `python tests/mutation_check.py` |
| `test_contract_v2.py`, `test_contract_v3.py` | Earlier generations on a deterministic runtime stub. | `python -m unittest discover -s tests -v` |
| `*.test.mjs` | Frontend logic: GEN/wei conversion, treasury and payout states, reclaim reasons, receipt classification, public review. | `npm test` |

Install the Python tools with `pip install -r requirements-test.txt`. The first Direct Mode run downloads the GenVM v0.2.16 runner into `~/.cache/gltest-direct`.

Mocks prove what the contract does with given inputs, not what a real model would answer. On-chain runs are recorded in `../TESTING.md`.
