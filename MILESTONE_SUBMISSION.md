# Milestone v2 submission draft

## Title

ProofSponsor — Unreachable Evidence Is No Longer a Rejection

## Changes & Improvements

Character count: **861** (including spaces and punctuation; paragraph only).

Previously, a transient 404, timeout, or host outage was permanently recorded onchain as a content rejection, consumed one of a creator’s three attempts, and blocked that URL from recovery. V3 adds an UNAVAILABLE state: retrieval failures preserve the same attempt, expose a bounded retry counter, and can be verified again after the page recovers. Five consecutive retrieval failures close the attempt explicitly. V3 also canonicalizes common URL variants across attempt reuse and campaign claims while preserving meaningful query parameters. The React app now shows an amber recovery state, Verify again, retry/attempt counts, and the canonical Recorded as URL. New contract and public-review tests cover recovery, marker failure, canonical claims, and over-normalization. V1/V2 source is unchanged; V3 requires a fresh StudioNet deployment and runtime proof.

## Evidence links to complete after deployment

Use immutable/deep links. Do not submit placeholders.

1. `https://github.com/nikvn89/ProofSponsor/compare/<PROJECT_APPROVED_BASE_SHA>...<V3_HEAD_SHA>`
2. `https://explorer-studio.genlayer.com/address/<V3_CONTRACT_ADDRESS>`
3. `https://github.com/nikvn89/ProofSponsor/blob/<V3_HEAD_SHA>/SECURITY.md`
4. `https://github.com/nikvn89/ProofSponsor/blob/<V3_HEAD_SHA>/RUNTIME_EVIDENCE.md`
5. `https://github.com/nikvn89/ProofSponsor/actions/runs/<CI_RUN_ID>`
6. `https://github.com/nikvn89/ProofSponsor/tree/<V3_HEAD_SHA>/docs/evidence`

The base SHA must be the commit approved for the original Project submission. The pre-change repository HEAD supplied with this package is `ab7adfc72b885348b36cf867e6549da12e64b34b`; use it only if it is also the approved Project commit shown in the Portal.
