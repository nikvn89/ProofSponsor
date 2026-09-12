# Changelog

## Unreleased - Milestone 1: public delivery dossier

- Added a wallet-free, shareable `#/review?campaign=...&creator=...` case review for any existing campaign/delivery pair.
- Combined eleven existing accepted-state contract views into a campaign brief, creator submission, verdict, required marker, and evidence-claim dossier.
- Added a portable JSON export with retrieval time, contract address, source state, and explicit offchain/atomicity limitations.
- Flagged contradictory accepted reads (for example `APPROVED` without a matching evidence claim) instead of silently showing a clean result.
- Added eight automated tests for the new reader, shareable routes, missing data, inconsistent claims, and unsafe external links.
- Kept the deployed Python contract and its address unchanged; this milestone is a frontend/reviewer workflow feature, not a new onchain deployment.

The URL itself carries only a campaign ID and creator wallet; neither is a secret. The exported JSON is a locally retrieved snapshot, not a signed proof or a historical block receipt.
