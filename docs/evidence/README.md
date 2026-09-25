# V3 screenshot evidence

These screenshots require a deployed V3 contract and real StudioNet transactions. They are intentionally not fabricated in the pre-deployment package.

Capture and replace this checklist after the runtime flow is complete:

- [ ] `v3-before-false-rejection.png` — V2 records a retrieval failure as `REJECTED` and consumes the attempt.
- [ ] `v3-after-unavailable.png` — V3 shows the amber `UNAVAILABLE` state, **Verify again**, and **Attempt 1 of 3 preserved**.
- [ ] `v3-after-recovered.png` — the recovered page is `APPROVED` and the attempt count remains 1.
- [ ] `v3-after-normalized-url.png` — the evidence field displays the canonical **Recorded as** URL.
