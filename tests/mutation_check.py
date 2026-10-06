"""
Mutation matrix for contracts/ProofSponsorV4.py.

Each mutant is one deliberate fault. The GenVM Direct Mode suite
(tests/direct/test_v4_direct.py) runs against every mutant and must fail on
each one; a surviving mutant means a behaviour the suite does not pin down.

Run:  python tests/mutation_check.py
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "ProofSponsorV4.py"
SUITE = ROOT / "tests" / "direct" / "test_v4_direct.py"

# (name, old, new, replace_all)
MUTANTS = [
    # --- clock
    ("clock_ignores_january_february_shift",
     "y -= 1 if m <= 2 else 0", "y -= 0", False),
    # --- campaign / funding
    ("reward_upper_bound_dropped",
     "if reward_wei < 0 or reward_wei > MAX_REWARD_WEI:", "if reward_wei < 0:", False),
    ("fund_without_sponsor_gate",
     'self._require_sponsor(campaign_id, "only the campaign sponsor can fund it")', "pass", False),
    ("fund_accepts_zero_value",
     "if amount == u256(0):", "if False:", False),
    ("fund_does_not_credit_pool",
     "self.campaign_pool_wei[campaign_id] = current + amount", "self.campaign_pool_wei[campaign_id] = current", False),
    # --- reservation
    ("zero_reward_not_marked",
     'if reward_wei == u256(0):\n            self.payout_status[submission_key] = "NO_REWARD"',
     'if False:\n            self.payout_status[submission_key] = "NO_REWARD"', False),
    ("exact_cover_counts_as_underfunded",
     "if self._available_wei(campaign_id) < reward_wei:\n            if self.payout_status",
     "if self._available_wei(campaign_id) <= reward_wei:\n            if self.payout_status", False),
    ("reserve_does_not_lock_funds",
     "self.campaign_reserved_wei[campaign_id] = reserved_wei + reward_wei",
     "self.campaign_reserved_wei[campaign_id] = reserved_wei", False),
    ("reserve_day_not_recorded",
     "self.payout_reserved_day[submission_key] = u256(self._today())",
     "self.payout_reserved_day[submission_key] = u256(0)", False),
    ("waiting_counter_not_incremented",
     "self.campaign_underfunded[campaign_id] = waiting + u256(1)", "pass", False),
    ("waiting_counter_not_decremented",
     "self.campaign_underfunded[campaign_id] = waiting - u256(1)", "pass", False),
    ("approval_does_not_reserve",
     "            self._open_delta(campaign_id, -1)\n            # V4: the verdict moves money — reserve the reward if the pool covers it.\n            self._reserve(campaign_id, submission_key)",
     "            self._open_delta(campaign_id, -1)", False),
    # --- withdraw
    ("withdraw_status_gate_dropped",
     'if self.payout_status.get(submission_key, "") != "RESERVED" or amount_wei == u256(0):',
     'if self.payout_status.get(submission_key, "") == "":', False),
    ("withdraw_invariant_dropped",
     "if pool_wei < amount_wei or reserved_wei < amount_wei:", "if False:", False),
    ("withdraw_keeps_pending",
     "# Effects before the transfer.\n        self.pending_payout[submission_key] = u256(0)",
     "# Effects before the transfer.\n        pass", False),
    ("withdraw_keeps_reservation",
     "self.campaign_reserved_wei[campaign_id] = reserved_wei - amount_wei\n        self.campaign_pool_wei[campaign_id] = pool_wei - amount_wei",
     "self.campaign_pool_wei[campaign_id] = pool_wei - amount_wei", False),
    ("withdraw_keeps_pool",
     "        self.campaign_pool_wei[campaign_id] = pool_wei - amount_wei\n", "", False),
    ("withdraw_pays_the_sponsor",
     "_NativeRecipient(Address(creator)).emit_transfer(value=amount_wei)",
     "_NativeRecipient(Address(self.campaign_creator[campaign_id])).emit_transfer(value=amount_wei)", False),
    # --- late reservation
    ("reserve_underfunded_any_status",
     'if self.payout_status.get(submission_key, "") != "UNDERFUNDED":\n            raise gl.vm.UserError("reward is not waiting for funds")',
     'if False:\n            raise gl.vm.UserError("reward is not waiting for funds")', False),
    ("reserve_underfunded_without_cover_check",
     "if self._available_wei(campaign_id) < reward_wei:\n            raise gl.vm.UserError(\"campaign pool still cannot cover the reward\")",
     "if False:\n            raise gl.vm.UserError(\"campaign pool still cannot cover the reward\")", False),
    # --- claim window
    ("release_window_one_day_late",
     "if self._today() < reserved_day + CLAIM_WINDOW_DAYS:", "if self._today() <= reserved_day + CLAIM_WINDOW_DAYS:", False),
    ("release_window_one_day_early",
     "if self._today() < reserved_day + CLAIM_WINDOW_DAYS:", "if self._today() < reserved_day + CLAIM_WINDOW_DAYS - 1:", False),
    ("release_any_status",
     'if self.payout_status.get(submission_key, "") != "RESERVED":\n            raise gl.vm.UserError("no reserved reward to release")',
     'if False:\n            raise gl.vm.UserError("no reserved reward to release")', False),
    ("release_keeps_reservation",
     "self.campaign_reserved_wei[campaign_id] = reserved_wei - amount_wei\n        self.payout_status[submission_key] = \"EXPIRED\"",
     "self.payout_status[submission_key] = \"EXPIRED\"", False),
    ("release_keeps_pending",
     "        self.pending_payout[submission_key] = u256(0)\n        self.campaign_reserved_wei[campaign_id] = reserved_wei - amount_wei\n        self.payout_status[submission_key] = \"EXPIRED\"",
     "        self.campaign_reserved_wei[campaign_id] = reserved_wei - amount_wei\n        self.payout_status[submission_key] = \"EXPIRED\"", False),
    ("payout_view_expiry_one_day_late",
     "today >= reserved_day + CLAIM_WINDOW_DAYS", "today > reserved_day + CLAIM_WINDOW_DAYS", False),
    # --- reclaim
    ("reclaim_without_sponsor_gate",
     'sponsor = self._require_sponsor(campaign_id, "only the campaign sponsor can reclaim")',
     "sponsor = str(gl.message.sender_address)", False),
    ("reclaim_while_active",
     "if self.campaign_active[campaign_id]:\n            raise gl.vm.UserError(\"close the campaign before reclaiming\")",
     "if False:\n            raise gl.vm.UserError(\"close the campaign before reclaiming\")", False),
    ("reclaim_with_open_submissions",
     "if int(self.campaign_open_submissions.get(campaign_id, u256(0))) > 0:", "if False:", False),
    ("reclaim_while_rewards_wait",
     "if int(self.campaign_underfunded.get(campaign_id, u256(0))) > 0:", "if False:", False),
    ("reclaim_without_empty_gate",
     "if available_wei == u256(0):\n            raise gl.vm.UserError(\"nothing to reclaim\")",
     "if False:\n            raise gl.vm.UserError(\"nothing to reclaim\")", False),
    ("reclaim_empties_reserved_funds",
     "self.campaign_pool_wei[campaign_id] = self.campaign_reserved_wei.get(campaign_id, u256(0))",
     "self.campaign_pool_wei[campaign_id] = u256(0)", False),
    # --- verdict lifecycle
    ("closing_blocks_the_verdict_again",
     "        creator = creator.strip()\n\n        submission_key = self._submission_key(campaign_id, creator)\n\n        if not self.submission_exists.get(submission_key, False):\n            raise gl.vm.UserError(\"submission does not exist\")",
     "        if not self.campaign_active[campaign_id]:\n            raise gl.vm.UserError(\"campaign is closed\")\n        creator = creator.strip()\n\n        submission_key = self._submission_key(campaign_id, creator)\n\n        if not self.submission_exists.get(submission_key, False):\n            raise gl.vm.UserError(\"submission does not exist\")", False),
    ("submit_not_counted_open",
     "        self._record_new_attempt(campaign_id, creator, description, evidence_url, 1)\n        self._open_delta(campaign_id, 1)",
     "        self._record_new_attempt(campaign_id, creator, description, evidence_url, 1)", False),
    ("revision_not_reopened",
     "        if reopened:\n            self._open_delta(campaign_id, 1)", "", False),
    ("rejection_not_closed",
     "                \"requirements\"\n            ))\n            self._open_delta(campaign_id, -1)",
     "                \"requirements\"\n            ))", False),
    ("marker_check_dropped",
     "        if (\n            proof_marker.lower()\n            not in evidence_text.lower()\n        ):\n            return \"REJECTED\"",
     "", False),
    ("validator_always_agrees",
     "return leader_verdict == validator_verdict", "return True", False),
    # --- fence
    ("fence_case_sensitive",
     "cleaned.upper().find(token)", "cleaned.find(token)", True),
    ("fence_without_gap",
     'cleaned = cleaned[:index] + " " + cleaned[index + len(token):]',
     'cleaned = cleaned[:index] + cleaned[index + len(token):]', False),
    ("description_unfenced",
     "safe_description = self._fence_strip(description)", "safe_description = description", False),
    # --- evidence identity
    ("identity_keeps_www",
     'if host.startswith("www."):\n            host = host[4:]', "pass", False),
    ("identity_keeps_tracking_params",
     'if key.startswith("utm_"):\n                continue', "pass", False),
    ("identity_keeps_fragment",
     'normalized = normalized.split("#")[0]', "pass", False),
    ("identity_keeps_trailing_slash",
     'while path.endswith("/"):\n            path = path[:-1]', "pass", False),
]


def run_suite(contract_path: Path) -> bool:
    env = dict(os.environ, PROOFSPONSOR_CONTRACT=str(contract_path))
    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(SUITE), "-q", "-x", "-p", "no:cacheprovider"],
        cwd=ROOT, env=env, capture_output=True, text=True,
    )
    return result.returncode == 0


def main() -> int:
    source = CONTRACT.read_text()
    if not run_suite(CONTRACT):
        print("baseline suite fails; fix it before running mutants")
        return 1
    survivors = []
    with tempfile.TemporaryDirectory() as tmp:
        for name, old, new, replace_all in MUTANTS:
            count = source.count(old)
            if count == 0 or (count > 1 and not replace_all):
                print(f"anchor problem in {name}: found {count} times")
                return 1
            mutated = source.replace(old, new) if replace_all else source.replace(old, new, 1)
            path = Path(tmp) / "ProofSponsorV4.py"
            path.write_text(mutated)
            passed = run_suite(path)
            print(f"{'SURVIVED' if passed else 'killed  '}  {name}")
            if passed:
                survivors.append(name)
    killed = len(MUTANTS) - len(survivors)
    print(f"\n{killed}/{len(MUTANTS)} mutants killed")
    return 1 if survivors else 0


if __name__ == "__main__":
    sys.exit(main())
