"""Local state-transition tests against the actual V3 contract methods.

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
    source = Path(__file__).resolve().parents[1] / "contracts" / "ProofSponsorV3.py"
    spec = importlib.util.spec_from_file_location("proofsponsor_v3_test", source)
    contract_module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(contract_module)
    return module.gl, contract_module.SponsorJudgeV3()


SPONSOR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
CREATOR = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
OTHER = "0xcccccccccccccccccccccccccccccccccccccccc"
BRIEF = "Publish a clear explanation of the sponsored project."
NOTE = "I published the requested content and attached my proof."


class SourceMetadataTests(unittest.TestCase):
    def test_genvm_metadata_header_is_contiguous(self):
        source = Path(__file__).resolve().parents[1] / "contracts" / "ProofSponsorV3.py"
        lines = source.read_text(encoding="utf-8").splitlines()
        self.assertEqual(lines[0], "# v0.2.16")
        self.assertRegex(lines[1], r'^# \{ "Depends": "py-genlayer:[^"]+" \}$')
        self.assertEqual(lines[2], "")
        self.assertEqual(lines[3], "from genlayer import *")


class V3BehaviorTests(unittest.TestCase):
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

    def make_render_unavailable(self):
        def boom(_url, _mode):
            raise RuntimeError("upstream 503 / timeout")

        self.gl.nondet.web.render = boom

    def test_01_render_exception_is_unavailable_without_new_attempt(self):
        self.submit()
        self.make_render_unavailable()
        self.judge()

        self.assertEqual(
            self.contract.get_submission_status("campaign-1", CREATOR),
            "UNAVAILABLE",
        )
        self.assertEqual(self.contract.get_attempt_count("campaign-1", CREATOR), 1)
        self.assertEqual(
            self.contract.get_unavailable_retries("campaign-1", CREATOR), 1
        )
        self.assertEqual(self.contract.get_max_unavailable_retries(), 5)

    def test_02_recovered_page_can_be_approved_on_same_attempt(self):
        url = "https://example.org/recovery"
        self.submit(url=url)
        self.make_render_unavailable()
        self.judge()

        self.gl.nondet.web.render = lambda page, mode: self.pages[page]
        self.verdict = "APPROVED"
        self.judge()

        self.assertEqual(
            self.contract.get_submission_status("campaign-1", CREATOR),
            "APPROVED",
        )
        self.assertEqual(self.contract.get_attempt_count("campaign-1", CREATOR), 1)
        self.assertEqual(
            self.contract.get_attempt_status("campaign-1", CREATOR, 1),
            "APPROVED",
        )

    def test_03_fifth_unavailable_verification_becomes_rejected(self):
        self.submit()
        self.make_render_unavailable()

        for _ in range(5):
            self.judge()

        self.assertEqual(
            self.contract.get_submission_status("campaign-1", CREATOR),
            "REJECTED",
        )
        self.assertEqual(self.contract.get_attempt_count("campaign-1", CREATOR), 1)
        self.assertEqual(
            self.contract.get_unavailable_retries("campaign-1", CREATOR), 5
        )
        self.assertIn(
            "could not be retrieved after 5",
            self.contract.get_submission_reason("campaign-1", CREATOR),
        )

    def test_04_missing_marker_is_rejected_not_unavailable(self):
        url = "https://example.org/no-marker"
        self.submit(url=url)
        self.pages[url] = "A valid public page without the required marker."
        self.verdict = "APPROVED"
        self.judge()

        self.assertEqual(
            self.contract.get_submission_status("campaign-1", CREATOR),
            "REJECTED",
        )
        self.assertEqual(
            self.contract.get_unavailable_retries("campaign-1", CREATOR), 0
        )

    def test_05_empty_render_is_unavailable(self):
        url = "https://example.org/empty"
        self.submit(url=url)
        self.pages[url] = "   "
        self.judge()

        self.assertEqual(
            self.contract.get_submission_status("campaign-1", CREATOR),
            "UNAVAILABLE",
        )
        self.assertEqual(self.contract.get_attempt_count("campaign-1", CREATOR), 1)

    def reject_original_url(self, url="https://example.org/article"):
        self.submit(url=url)
        self.judge()
        self.assertEqual(
            self.contract.get_submission_status("campaign-1", CREATOR),
            "REJECTED",
        )

    def assert_revision_url_already_used(self, variant):
        self.gl.message.sender_address = CREATOR
        with self.assertRaisesRegex(UserError, "already used"):
            self.contract.revise_rejected_content(
                "campaign-1", NOTE, variant
            )

    def test_06_tracking_variant_of_attempted_url_is_blocked(self):
        self.reject_original_url()
        self.assert_revision_url_already_used(
            "https://example.org/article?utm_source=x"
        )

    def test_07_fragment_variant_of_attempted_url_is_blocked(self):
        self.reject_original_url()
        self.assert_revision_url_already_used(
            "https://example.org/article#section-2"
        )

    def test_08_hostname_case_and_www_variant_is_blocked(self):
        self.reject_original_url()
        self.assert_revision_url_already_used(
            "https://WWW.EXAMPLE.org/article"
        )

    def test_09_claimed_page_variant_is_blocked_for_second_creator(self):
        first = "https://example.org/shared"
        self.submit(CREATOR, first)
        self.verdict = "APPROVED"
        self.judge(CREATOR)

        self.gl.message.sender_address = OTHER
        variant = "https://EXAMPLE.org/shared?ref=2"
        self.pages[variant] = (
            "Article SPONSORJUDGE_PROOF:" + OTHER.lower()
        )
        with self.assertRaisesRegex(UserError, "already claimed"):
            self.contract.submit_content("campaign-1", NOTE, variant)

    def test_10_resource_query_values_remain_distinct(self):
        first = "https://video.example/watch?v=A"
        second = "https://video.example/watch?v=B"
        self.reject_original_url(first)

        self.gl.message.sender_address = CREATOR
        self.pages[second] = "A stronger article SPONSORJUDGE_PROOF:" + CREATOR
        self.contract.revise_rejected_content("campaign-1", NOTE, second)
        self.assertEqual(self.contract.get_attempt_count("campaign-1", CREATOR), 2)
        self.assertNotEqual(
            self.contract.normalize_evidence_url(first),
            self.contract.normalize_evidence_url(second),
        )

    def test_11_normalize_view_exposes_canonical_url(self):
        self.assertEqual(
            self.contract.normalize_evidence_url(
                "https://WWW.Example.org/Post/?utm_source=x#top"
            ),
            "https://example.org/Post",
        )

    def test_12_unavailable_submission_can_be_revised_to_new_url(self):
        self.submit(url="https://example.org/offline")
        self.make_render_unavailable()
        self.judge()

        self.gl.message.sender_address = CREATOR
        replacement = "https://example.org/replacement"
        self.pages[replacement] = (
            "Article SPONSORJUDGE_PROOF:" + CREATOR.lower()
        )
        self.contract.revise_rejected_content(
            "campaign-1", NOTE, replacement
        )

        self.assertEqual(
            self.contract.get_submission_status("campaign-1", CREATOR),
            "SUBMITTED",
        )
        self.assertEqual(self.contract.get_attempt_count("campaign-1", CREATOR), 2)
        self.assertEqual(
            self.contract.get_unavailable_retries("campaign-1", CREATOR), 0
        )


if __name__ == "__main__":
    unittest.main()
