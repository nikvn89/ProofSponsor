# Security notes

## Closed in V4

- **Closing a campaign could dodge a verdict.** In V3 `judge_content` reverted with `campaign is closed`, so a sponsor could close the campaign while a delivery was `SUBMITTED` and leave it unjudged indefinitely. V4 judges deliveries that were submitted while the campaign was open; closing only stops new submissions and revisions (`test_submission_made_while_open_is_judged_after_close`; the V3 behaviour is reproduced in `test_v3_closing_the_campaign_blocks_the_verdict`).
- **The prompt fence could be broken from both inputs.** V3 removed `<UNTRUSTED_EVIDENCE>` and `</UNTRUSTED_EVIDENCE>` once, in exact case, from the page, and inserted the creator description into the prompt unfenced. A lower-case `</untrusted_evidence>` on the page, or any marker in the description, reached the model as a closing tag. V4 fences both inputs and strips every marker in any letter case until none remains, replacing each with a space so split tokens cannot rejoin (`test_fence_strip_reaches_a_fixed_point`, `test_tokens_split_by_a_marker_do_not_rejoin`, `test_description_and_page_are_both_fenced_in_the_prompt`; V3 behaviour in `test_v3_fence_lets_markers_through`).
- **Wallet writes required the GenLayer Snap.** The app no longer calls `client.connect('studionet')`; it switches or adds the network with standard wallet RPC.
- **A write could be reported as done when it reverted.** The app waited only for an `ACCEPTED` status. It now requires the leader receipt's `execution_result = SUCCESS` on an applied status and shows the contract's revert sentence otherwise (`tests/receipt.test.mjs`, which also checks that the app knows exactly the contract's revert sentences).

## Money handling in V4

- Native GEN moves out of the contract in two places only: `withdraw_reward` (to the creator who owns the reserved reward) and `reclaim_unused` (to the sponsor). State is updated before each transfer.
- Invariant: `pool = reserved + available`; reserved GEN covers exactly the `RESERVED` rewards. `withdraw_reward` and `release_expired_reward` refuse to run if storage would break it (`treasury invariant violated`). `test_every_wei_is_accounted_for` checks that paid-out plus remaining pool equals everything funded.
- The sponsor cannot reclaim GEN that is reserved for a creator, cannot reclaim while any delivery awaits a verdict, and cannot reclaim while an approved reward waits for funds.
- A reservation lasts 30 days from the transaction date that made it (the clock is the transaction `datetime`, parsed arithmetically). After that anyone can release it to the pool; until someone does, the creator can still withdraw.
- Rewards are capped at 10^27 wei per delivery.

## Known limitations

- URL normalization is best-effort. A meaningless query parameter not in the tracking-parameter list can still create a distinct URL. The three-attempt cap remains the upper bound.
- Rendered-content identity is not implemented. Hashing rendered text could produce validator-dependent differences, so the contract does not use it as an onchain key.
- An approved reward that waits for funds blocks the sponsor's reclaim until the sponsor tops up the pool. This is deliberate (creators are owed first), but it means a sponsor who never tops up leaves the leftover in the contract.
- The model's verdict is only as good as the brief and the page; the fence reduces prompt injection, it does not make it impossible.
- Direct Mode tests mock web pages and model answers. They prove what the contract does with those inputs, not what a real model would say; StudioNet runs are recorded in `TESTING.md`.

## Not in scope

ProofSponsor does not judge legal identity, authorship, or the off-chain value of the work. A reward is paid on the contract's verdict alone.
