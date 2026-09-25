# Milestone v2 submission draft

## Title

ProofSponsor — Unreachable Evidence Is No Longer a Rejection

## Changes & Improvements

Character count: **907** (including spaces and punctuation; paragraph only).

Previously, a transient 404, timeout, or host outage was permanently recorded onchain as a content rejection, consumed one of a creator’s three attempts, and blocked that URL from recovery. V3 adds an UNAVAILABLE state: retrieval failures preserve the same attempt, expose a bounded retry counter, and can be verified again after the page recovers. Five consecutive retrieval failures close the attempt explicitly. V3 also canonicalizes common URL variants across attempt reuse and campaign claims while preserving meaningful query parameters. The React app now shows an amber recovery state, Verify again, retry/attempt counts, and the canonical Recorded as URL. New contract and public-review tests cover recovery, marker failure, canonical claims, and over-normalization. V1/V2 source is unchanged. A fresh V3 deployment and StudioNet run proved `UNAVAILABLE -> APPROVED` while preserving Attempt 1 of 3.

## Portal Evidence links

The final Git commit does not exist until the upload is committed. After that final commit, copy its full 40-character SHA as `V3_FINAL_HEAD_SHA`; do not paste the literal token below into the Portal and do not use `main`.

1. Required Project baseline comparison: `https://github.com/nikvn89/ProofSponsor/compare/7075d937010e1aa264d6cb9f9852fc841060f5e2...<V3_FINAL_HEAD_SHA>`
2. Incremental comparison from Milestone v1: `https://github.com/nikvn89/ProofSponsor/compare/ab7adfc72b885348b36cf867e6549da12e64b34b...<V3_FINAL_HEAD_SHA>`
3. V3 contract: https://explorer-studio.genlayer.com/address/0x5f9950BCe63AcAb1b5DF02f0231A645fcbB74e0A
4. Final recovery judgment: https://explorer-studio.genlayer.com/tx/0x00485f692240ae82f52ffbe067683669f6ceb281f8432c3f77a00631258623f7
5. Public recovery evidence: https://nikvn89.github.io/ProofSponsor/evidence/v3-recovery-250925-01.html
6. Pinned security boundary: `https://github.com/nikvn89/ProofSponsor/blob/<V3_FINAL_HEAD_SHA>/SECURITY.md`
7. Pinned runtime record: `https://github.com/nikvn89/ProofSponsor/blob/<V3_FINAL_HEAD_SHA>/RUNTIME_EVIDENCE.md`
8. Pinned screenshots: `https://github.com/nikvn89/ProofSponsor/tree/<V3_FINAL_HEAD_SHA>/docs/evidence`

The original Project commit confirmed by the prior steward request is `7075d937010e1aa264d6cb9f9852fc841060f5e2`. The previous Milestone v1 submitted commit is `ab7adfc72b885348b36cf867e6549da12e64b34b`. The first comparison satisfies the steward's Project-to-Milestone request; the second isolates only the work added after Milestone v1.
