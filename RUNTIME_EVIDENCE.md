# ProofSponsor — StudioNet Runtime Evidence

## V3 — retrieval-safe adjudication

V3 changes the contract and must be deployed separately. The rows below are deliberately marked `NOT RUN` in this pre-deployment package. Replace each marker only after the corresponding StudioNet transaction is accepted, and link the exact transaction.

### Deployment and source

- Network: GenLayer StudioNet (`61999`)
- Contract: `TO BE RECORDED AFTER DEPLOYMENT`
- Deployment transaction: `NOT RUN`
- Contract source: `contracts/ProofSponsorV3.py`
- Source SHA-256: `TO BE RECORDED AFTER DEPLOYMENT`
- Runtime campaign: `TO BE RECORDED AFTER DEPLOYMENT`

### Required V3 runtime matrix

| # | Action | Required accepted result | Transaction evidence |
| --- | --- | --- | --- |
| 1 | Deploy `ProofSponsorV3.py` | Fresh V3 address | `NOT RUN` |
| 2 | `create_campaign` | Campaign is active | `NOT RUN` |
| 3 | `submit_content` while the evidence route is still unpublished/404 | `SUBMITTED`; `attempt_count = 1` | `NOT RUN` |
| 4 | `judge_content` while retrieval fails | `UNAVAILABLE`; `attempt_count = 1`; retries = 1 | `NOT RUN` |
| 5 | Publish the page, then call `judge_content` again | `APPROVED`; `attempt_count = 1` | `NOT RUN` |
| 6 | Creator B submits a tracking variant of Creator A's claimed page | Revert: `evidence already claimed` | `NOT RUN` |
| 7 | Creator A revises with a fragment variant of its attempted URL | Revert: `creator already used this evidence URL` | `NOT RUN` |
| 8 | Complete `REJECTED -> revise -> APPROVED` on V3 | Immutable multi-attempt history | `NOT RUN` |
| 9 | Read `normalize_evidence_url` with a dirty URL | Canonical URL returned | `NOT RUN` |

Rows 4 and 5 are the load-bearing proof: they must show the same attempt count before and after recovery. Local tests cannot replace these transactions.

### Required screenshots

The exact filenames and capture criteria are listed in [`docs/evidence/README.md`](./docs/evidence/README.md). Status: `NOT RUN`.

---

## V2 — rejected-delivery revision lifecycle

This record documents the completed rejected-delivery revision lifecycle for the deployed ProofSponsor V2 contract. Local tests are listed separately and are not presented as GenLayer consensus evidence.

## Deployment and source

- Network: GenLayer StudioNet
- Contract: `0xcD38Ed017A9cC3351C14c78c562bDB02194aE2bb`
- Deployment transaction: `0x72ef78a2cf8bca501ae804efd5f6aa5e41228749e16a90cb302bbe11ce0d746a`
- Contract source: `contracts/ProofSponsorV2.py`
- Source SHA256: `8cc60cc93b195679172b8a6240d24f54a87be6c40be70784ba061e8f4775df3f`
- Live dApp: https://proofsponsor-gl.vercel.app/

## Reference case

- Campaign ID: `ps-v2-live-1309-01.` (the final period is part of the onchain ID)
- Sponsor: `0x6276095FAEA15108740445ff277fdA8c304657F4`
- Creator: `0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE`
- Required marker: `SPONSORJUDGE_PROOF:0x037f58e33c1ec8fda272361e0aac1e31054a1cde`
- Main campaign creation: https://explorer-studio.genlayer.com/tx/0xee685ce9dee94596694316205ac21580fbd61aaa7a5b3715b07b6d57b137631c

## Load-bearing lifecycle

| Stage | Accepted result | Evidence |
| --- | --- | --- |
| Attempt 1 judgment | `REJECTED` | https://explorer-studio.genlayer.com/tx/0x5b8258e52c31a44b3b101f81f180c1c711aa04ca5bf8a4c217f73f6f6a910c6e |
| Attempt 2 revision | `SUBMITTED`; attempt 1 preserved | https://explorer-studio.genlayer.com/tx/0x2d19a77c5fd2295778b568df749666a93893c1d3bfdb3955bef8c3f9a09cba6 |
| Attempt 2 judgment | `REJECTED` | https://explorer-studio.genlayer.com/tx/0x8e6f93cc71f4187197d35dbb0523588dcd74d67579b78141503eb86c38935b31 |
| Attempt 3 revision | `SUBMITTED`; attempts 1 and 2 preserved | https://explorer-studio.genlayer.com/tx/0x92c42440909dfca2d02135090c6277eaee759668dafc170306f2c5917a2c2ee7 |
| Attempt 3 judgment | `APPROVED`; evidence claimed | https://explorer-studio.genlayer.com/tx/0xce7c4ed63bb1409705f2d5f03714887adfee5e173fdb58000a3a5e67c9472e6b |

The final judgment reached `Accepted`, `SUCCESS`, and `Finalized`. Its GenVM equivalence output was `APPROVED`. The accepted contract state then reported the third attempt as `APPROVED` and retained the rejected status, evidence URL, and reason for attempts 1 and 2.

## Accepted-state public review

- Review: https://proofsponsor-gl.vercel.app/#/review?campaign=ps-v2-live-1309-01.&creator=0x037f58E33c1Ec8fdA272361E0aAC1e31054a1CDE
- Exported snapshot: [`evidence/proofsponsor-v2-runtime.json`](./evidence/proofsponsor-v2-runtime.json)
- Retrieved at: `2026-09-13T01:32:47.423Z`
- Submission: `APPROVED`
- Attempt history: `REJECTED -> REJECTED -> APPROVED`
- Evidence claimed: `true`
- Claimed by creator: `true`
- Cross-read consistency flag: `inconsistent: false`

The review is a set of separate accepted-state reads, not an atomic block snapshot or signed attestation. The external evidence page can change after adjudication. The wallet marker binds the submitted page to a wallet string; it does not establish legal identity, authorship, or the truth of offchain claims.

## Authorization and boundary checks

The Vercel interface was checked with outsider wallet `0x146e44881d35814bA582D265AF5b97ef2695ec8e`. It displayed the existing rejected history but withheld the revision form and instructed the user to connect the original creator. This is frontend authorization evidence, not a claimed live contract revert.

Executable contract tests exercise the onchain rejection for an outsider with no submission, the three-attempt cap, closed-campaign rejection, reused-URL rejection, revision-after-approval rejection, and cross-creator evidence claiming. Run them with:

```bash
python3 -m unittest discover -s tests -p 'test_contract_v2.py' -v
npm test
npm run build
```

The first two Explorer-hosted evidence pages were rejected with the contract's fail-closed combined reason for semantic, attribution, or accessibility failure. The final Pastebin page was independently accessible without authentication and was approved. No claim is made that the Explorer-hosted pages failed for only one specific cause.
