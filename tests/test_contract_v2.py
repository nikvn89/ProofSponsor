"""Local state-transition tests against the actual V2 contract methods.

The GenLayer decorators, storage maps, sender, and nondeterministic calls are
stubbed here. These tests do not replace a StudioNet consensus deployment test.
"""

import importlib.util
from pathlib import Path
import sys
import types
import unittest


class TreeMap(dict):
    def __class_getitem__(cls, _args):
        return cls


class Contract:
    def __new__(cls):
        instance = super().__new__(cls)
        for name, annotation in cls.__annotations__.items():
            if annotation is TreeMap:
                setattr(instance, name, TreeMap())
        return instance


class UserError(Exception):
    pass


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class VM:
    UserError = UserError
    Return = Return
    Result = object

    @staticmethod
    def run_nondet_unsafe(leader, validator):
        value = leader()
        if not validator(Return(value)):
            raise RuntimeError("validator disagreed")
        return value


def load_contract():
    module = types.ModuleType("genlayer")
    module.TreeMap = TreeMap
    module.u8 = int
    module.gl = types.SimpleNamespace(
        Contract=Contract,
        message=types.SimpleNamespace(sender_address=""),
        public=types.SimpleNamespace(write=lambda method: method, view=lambda method: method),
        vm=VM,
        nondet=types.SimpleNamespace(
            web=types.SimpleNamespace(render=lambda url, mode: ""),
            exec_prompt=lambda prompt: "REJECTED",
        ),
    )
    sys.modules["genlayer"] = module
    source = Path(__file__).resolve().parents[1] / "contracts" / "ProofSponsorV2.py"
    spec = importlib.util.spec_from_file_location("proofsponsor_v2_test", source)
    contract_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(contract_module)
    return module.gl, contract_module.SponsorJudgeV2()


SPONSOR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
CREATOR = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
OTHER = "0xcccccccccccccccccccccccccccccccccccccccc"
BRIEF = "Publish a clear explanation of the sponsored project."
NOTE = "I published the requested content and attached my proof."


class SourceMetadataTests(unittest.TestCase):
    def test_genvm_metadata_header_is_contiguous(self):
        source = Path(__file__).resolve().parents[1] / "contracts" / "ProofSponsorV2.py"
        lines = source.read_text(encoding="utf-8").splitlines()
        self.assertEqual(lines[0], "# v0.2.16")
        self.assertRegex(lines[1], r'^# \{ "Depends": "py-genlayer:[^"]+" \}$')
        self.assertEqual(lines[2], "")
        self.assertEqual(lines[3], "from genlayer import *")


class RevisionTests(unittest.TestCase):
    def setUp(self):
        self.gl, self.contract = load_contract()
        self.pages = {}
        self.verdict = "REJECTED"
        self.gl.nondet.web.render = lambda url, mode: self.pages[url]
        self.gl.nondet.exec_prompt = lambda prompt: self.verdict
        self.gl.message.sender_address = SPONSOR
        self.contract.create_campaign("campaign-1", "Sponsor", BRIEF)

    def submit(self, creator=CREATOR, url="https://example.org/first"):
        self.gl.message.sender_address = creator
        self.pages[url] = "Article SPONSORJUDGE_PROOF:" + creator.lower()
        self.contract.submit_content("campaign-1", NOTE, url)

    def judge(self, creator=CREATOR):
        self.gl.message.sender_address = SPONSOR
        self.contract.judge_content("campaign-1", creator)

    def test_rejected_submission_can_be_revised_and_approved_with_history(self):
        self.submit()
        self.assertEqual(self.contract.get_attempt_count("campaign-1", CREATOR), 1)
        self.judge()
        first_reason = self.contract.get_attempt_reason("campaign-1", CREATOR, 1)
        self.assertEqual(self.contract.get_attempt_status("campaign-1", CREATOR, 1), "REJECTED")

        self.gl.message.sender_address = CREATOR
        second = "https://example.org/second"
        self.pages[second] = "A stronger article SPONSORJUDGE_PROOF:" + CREATOR
        self.contract.revise_rejected_content("campaign-1", NOTE, second)
        self.assertEqual(self.contract.get_submission_status("campaign-1", CREATOR), "SUBMITTED")
        self.assertEqual(self.contract.get_attempt_count("campaign-1", CREATOR), 2)
        self.assertEqual(self.contract.get_attempt_evidence("campaign-1", CREATOR, 1), "https://example.org/first")
        self.assertEqual(self.contract.get_attempt_reason("campaign-1", CREATOR, 1), first_reason)
        self.assertEqual(self.contract.get_attempt_status("campaign-1", CREATOR, 2), "SUBMITTED")

        self.verdict = "APPROVED"
        self.judge()
        self.assertEqual(self.contract.get_attempt_status("campaign-1", CREATOR, 2), "APPROVED")
        self.assertEqual(self.contract.get_submission_status("campaign-1", CREATOR), "APPROVED")
        self.assertTrue(self.contract.is_evidence_claimed("campaign-1", second))
        self.assertEqual(self.contract.get_evidence_claimed_by("campaign-1", second), CREATOR)
        self.assertFalse(self.contract.is_evidence_claimed("campaign-1", "https://example.org/first"))
        with self.assertRaisesRegex(UserError, "only a rejected"):
            self.gl.message.sender_address = CREATOR
            self.contract.revise_rejected_content("campaign-1", NOTE, "https://example.org/third")

    def test_only_rejected_creator_may_revise_with_new_valid_evidence(self):
        self.submit()
        self.gl.message.sender_address = CREATOR
        with self.assertRaisesRegex(UserError, "only a rejected"):
            self.contract.revise_rejected_content("campaign-1", NOTE, "https://example.org/new")
        self.judge()
        self.gl.message.sender_address = OTHER
        with self.assertRaisesRegex(UserError, "no submission"):
            self.contract.revise_rejected_content("campaign-1", NOTE, "https://example.org/new")
        self.gl.message.sender_address = CREATOR
        with self.assertRaisesRegex(UserError, "already used"):
            self.contract.revise_rejected_content("campaign-1", NOTE, "https://example.org/first/")
        with self.assertRaisesRegex(UserError, "must start with https"):
            self.contract.revise_rejected_content("campaign-1", NOTE, "http://example.org/new")
        with self.assertRaisesRegex(UserError, "too short"):
            self.contract.revise_rejected_content("campaign-1", "short", "https://example.org/new")
        self.assertEqual(self.contract.get_attempt_count("campaign-1", CREATOR), 1)

    def test_campaign_close_and_attempt_limit(self):
        self.submit()
        self.judge()
        self.gl.message.sender_address = SPONSOR
        self.contract.set_campaign_active("campaign-1", False)
        self.gl.message.sender_address = CREATOR
        with self.assertRaisesRegex(UserError, "closed"):
            self.contract.revise_rejected_content("campaign-1", NOTE, "https://example.org/second")
        self.gl.message.sender_address = SPONSOR
        self.contract.set_campaign_active("campaign-1", True)
        for number in (2, 3):
            self.gl.message.sender_address = CREATOR
            url = f"https://example.org/{number}"
            self.pages[url] = "Article SPONSORJUDGE_PROOF:" + CREATOR
            self.contract.revise_rejected_content("campaign-1", NOTE, url)
            self.judge()
        self.assertEqual(self.contract.get_attempt_count("campaign-1", CREATOR), 3)
        self.gl.message.sender_address = CREATOR
        with self.assertRaisesRegex(UserError, "maximum of three"):
            self.contract.revise_rejected_content("campaign-1", NOTE, "https://example.org/fourth")

    def test_claimed_by_other_rejects_and_records_attempt_reason(self):
        shared = "https://example.org/shared"
        self.submit(CREATOR, shared)
        self.submit(OTHER, shared)
        self.pages[shared] = (
            "Article SPONSORJUDGE_PROOF:" + CREATOR
            + " SPONSORJUDGE_PROOF:" + OTHER
        )
        self.verdict = "APPROVED"
        self.judge(CREATOR)
        self.judge(OTHER)
        self.assertEqual(self.contract.get_attempt_status("campaign-1", OTHER, 1), "REJECTED")
        self.assertIn("already approved", self.contract.get_attempt_reason("campaign-1", OTHER, 1))
        self.assertEqual(self.contract.get_evidence_claimed_by("campaign-1", shared), CREATOR)

    def test_revision_cannot_claim_another_creators_approved_evidence(self):
        self.submit(CREATOR, "https://example.org/creator-a")
        self.submit(OTHER, "https://example.org/creator-b")
        self.judge(OTHER)
        self.verdict = "APPROVED"
        self.judge(CREATOR)
        self.gl.message.sender_address = OTHER
        with self.assertRaisesRegex(UserError, "already claimed"):
            self.contract.revise_rejected_content(
                "campaign-1", NOTE, "https://example.org/creator-a/"
            )
        self.assertEqual(self.contract.get_attempt_count("campaign-1", OTHER), 1)


if __name__ == "__main__":
    unittest.main()
