# Changelog

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
