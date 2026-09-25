# Security notes

## Closed in V3

- Common URL variants now share a canonical identity, so tracking parameters, fragments, `www`, and hostname case cannot create extra attempts (`test_06_tracking_variant_of_attempted_url_is_blocked`, `test_07_fragment_variant_of_attempted_url_is_blocked`, and `test_08_hostname_case_and_www_variant_is_blocked`).
- An approved page cannot be claimed again in the same campaign through a canonical URL variant (`test_09_claimed_page_variant_is_blocked_for_second_creator`).
- Retrieval failures now produce `UNAVAILABLE`, preserve the current attempt, and allow verification to be retried instead of recording a false rejection (`test_01_render_exception_is_unavailable_without_new_attempt` and `test_02_recovered_page_can_be_approved_on_same_attempt`).

## Known limitations

- URL normalization is best-effort. A meaningless query parameter not in the tracking-parameter list can still create a distinct URL. The three-attempt cap remains the upper bound.
- Rendered-content identity is not implemented. Hashing rendered text could produce validator-dependent differences, so V3 does not use it as an onchain key.
- If a sponsor closes a campaign while a submission is `SUBMITTED`, that submission cannot be judged until the campaign is reopened.
- Browser writes call `client.connect('studionet')` and therefore require a wallet that supports the GenLayer Snap flow.

## Not in scope

ProofSponsor does not hold sponsor or creator funds. Sponsorship payment and settlement happen outside this contract; it is not an escrow.
