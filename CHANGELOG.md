# Changelog

## V3 contract generation — DEPLOYED AND RECOVERY-VERIFIED

- Added `contracts/ProofSponsorV3.py`. Retrieval exceptions, `None`, and empty rendered content now produce `UNAVAILABLE` instead of a false content rejection. The current attempt remains intact and can be verified again; five consecutive retrieval failures close it as `REJECTED`.
- Added canonical evidence URL identity across attempt reuse and campaign claims. V3 removes fragments and common tracking parameters, normalizes scheme/host/`www`, preserves case-sensitive paths, and retains meaningful query parameters.
- Added accepted-state views for retrieval retry counts, the retry ceiling, and canonical URL previews. The frontend displays an amber `UNAVAILABLE` state, **Verify again**, the preserved-attempt counter, and **Recorded as** URL previews.
- Added 12 focused V3 behavior tests, an `UNAVAILABLE` public-review regression test, `SECURITY.md`, and GitHub Actions CI.
- Package version is now `3.0.0`. Earlier V2 work did not bump the package version; from this release onward the package version follows the contract generation.
- V1 and V2 source files remain byte-for-byte unchanged.

### Deployment boundary

- Previous V2 address: `0xcD38Ed017A9cC3351C14c78c562bDB02194aE2bb`
- Previous V2 source SHA-256: `8cc60cc93b195679172b8a6240d24f54a87be6c40be70784ba061e8f4775df3f`
- New V3 address: `0x5f9950BCe63AcAb1b5DF02f0231A645fcbB74e0A`
- New V3 deployment transaction: `0xabe3c20f9275855183a535816e2ac26d79f9e807d7bf1f502b2c1430c0946ff3`
- New V3 source SHA-256: `932cd6f3bc6176c4d416d3870ef9123d313217bdfb1843bf427adc1021f59394`

### StudioNet recovery completion — 2026-09-25

- Campaign `v3-recovery-250925-01` submitted a public evidence URL while that exact route returned 404.
- The first accepted judgment stored `UNAVAILABLE`, preserved `Attempt 1 of 3`, and recorded retrieval retry `1 of 5`.
- After the same route was published with the required wallet marker, a second judgment finalized as `APPROVED` without consuming another attempt.
- Final recovery transaction: `0x00485f692240ae82f52ffbe067683669f6ceb281f8432c3f77a00631258623f7`.
- Screenshots and scope boundaries are recorded in [`docs/evidence`](./docs/evidence/README.md) and [RUNTIME_EVIDENCE.md](./RUNTIME_EVIDENCE.md).

The V3 deployment starts with empty storage. Campaign `ps-v2-live-1309-01.` and every other V2 record remain readable at the V2 address but are not migrated. The app must not be pointed at V3 until the new address has been entered in its environment configuration.

## V2 milestone - rejected-delivery revision lifecycle

- Added and deployed the standalone `contracts/ProofSponsorV2.py` contract at `0xcD38Ed017A9cC3351C14c78c562bDB02194aE2bb`. The V1 source and address remain unchanged.
- Creators can revise a `REJECTED` delivery with a new HTTPS URL and description, at most twice after the initial submission. `SUBMITTED` and `APPROVED` deliveries cannot be revised.
- Each of the three possible attempts stores its own description, evidence URL, status, and adjudication reason onchain. An attempted URL cannot be reused by the same creator, including variants with trailing slashes; approved evidence remains claimed per campaign.
- A closed campaign cannot accept revisions. The revision transaction is signed by the original creator wallet, and a fresh GenLayer judgment is required for every new attempt.
- The React desk and public case review display V2 attempt history, and the creator desk exposes the revision form only for an eligible wallet and delivery.
- Added five local contract state-transition tests, a GenVM metadata-layout regression test, and ten frontend reader tests. These are not StudioNet consensus evidence.
- The previous read-only case dossier remains available on V1 and V2; V2 is the substantive milestone feature. No V1 state is migrated automatically to a new deployment.

The V2 frontend defaults to the verified V2 address and includes matching production environment values.

### StudioNet runtime completion — 2026-09-13

- Completed the live rejected-delivery revision lifecycle on campaign `ps-v2-live-1309-01.`.
- Preserved two rejected attempts, including their evidence URLs and adjudication reasons, before storing a third revised attempt.
- The third attempt used a publicly accessible article with the exact creator marker and reached `APPROVED` through a finalized `judge_content` transaction.
- Accepted-state public review confirmed `3 of 3` attempts, `claimed: true`, `matchesCreator: true`, and `inconsistent: false`.
- Added [RUNTIME_EVIDENCE.md](./RUNTIME_EVIDENCE.md) and the exported accepted-state snapshot at `evidence/proofsponsor-v2-runtime.json`.
