# V3 screenshot evidence

These screenshots record the completed V3 StudioNet recovery run for campaign `v3-recovery-250925-01`. They support the linked Explorer transactions and accepted-state reads documented in [`RUNTIME_EVIDENCE.md`](../../RUNTIME_EVIDENCE.md); screenshots are not a substitute for onchain evidence.

## Retained files

- [x] `v3-contract-deployment.png` — fresh V3 address with finalized deployment and successful consensus result.
- [x] `v3-create-campaign-tx.png` — finalized `create_campaign` transaction for the recovery campaign.
- [x] `v3-before-verification.png` — accepted UI state shows one `SUBMITTED` attempt before the unavailable judgment.
- [x] `v3-after-unavailable.png` — accepted UI state shows amber `UNAVAILABLE`, **Verify again**, **Attempt 1 of 3 preserved**, and retry `1 of 5`.
- [x] `v3-public-evidence.png` — the originally unavailable route after publication, including the required wallet marker.
- [x] `v3-final-judgment-tx.png` — finalized retry transaction with GenVM equivalence output `APPROVED`.
- [x] `v3-after-recovered.png` — accepted UI state shows `APPROVED`, `100%`, and attempt history still `1/3`.

## Scope boundary

The exact `submit_content` hash and first unavailable `judge_content` hash were not retained in the supplied captures, so they are not guessed here. The accepted UI states before and after those calls are preserved. The final retry hash is linked in `RUNTIME_EVIDENCE.md` and reaches `Accepted`, `SUCCESS`, and `Finalized`.

The originally planned V2 false-rejection comparison and a live canonical-URL view were not captured in this run. Deterministic canonicalization behavior is covered by `tests/test_contract_v3.py` and is not represented as live StudioNet proof.
