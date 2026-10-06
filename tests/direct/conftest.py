"""Shared helpers for the GenVM Direct Mode suite (contracts/ProofSponsorV4.py)."""

import datetime as dt
import os
import re
from pathlib import Path

import pytest
from gltest.direct.loader import create_address

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = os.environ.get("PROOFSPONSOR_CONTRACT") or str(ROOT / "contracts" / "ProofSponsorV4.py")
GENVM_VERSION = os.environ.get("GENVM_VERSION", "v0.2.16")

WEI = 10**18
DAY0 = dt.date(2026, 10, 6)
REQUIREMENTS = "Publish a public post that reviews the product and links the campaign page."
DESCRIPTION = "A public review post that covers the product and links the campaign."


def hx(addr):
    return addr.as_hex if hasattr(addr, "as_hex") else str(addr)


def day_iso(offset_days=0, hour="09:00:00"):
    return f"{(DAY0 + dt.timedelta(days=offset_days)).isoformat()}T{hour}Z"


def day_number(offset_days=0):
    return (DAY0 + dt.timedelta(days=offset_days) - dt.date(1970, 1, 1)).days


def warp(vm, iso):
    vm.warp(iso)
    import genlayer.gl as gl
    gl.message_raw["datetime"] = iso


class World:
    def __init__(self, vm, contract):
        self.vm = vm
        self.c = contract
        self.sponsor = create_address("sponsor")
        self.alice = create_address("alice")
        self.bob = create_address("bob")
        self.carol = create_address("carol")

    def as_(self, who, value=0):
        self.vm.sender = who
        self.vm.value = value
        return self.c

    def create(self, cid="c1", reward=WEI, who=None):
        self.as_(who or self.sponsor).create_campaign(cid, "Launch review", REQUIREMENTS, reward)
        return cid

    def fund(self, cid, amount, who=None):
        self.as_(who or self.sponsor, amount).fund_campaign(cid)
        self.vm.value = 0
        # Direct Mode does not move native value on its own; credit the contract
        # so the transfers made by withdraw_reward / reclaim_unused are covered.
        self.vm.deal(self.vm._contract_address, int(self.c.campaign_pool_wei[cid]))

    def submit(self, who, cid="c1", url=None, description=DESCRIPTION):
        url = url or f"https://posts.example/{hx(who).lower()[-6:]}"
        self.as_(who).submit_content(cid, description, url)
        return url

    def judge(self, who, cid="c1", verdict="APPROVED", page=None, caller=None, available=True):
        url = self.c.get_submission_evidence(cid, hx(who))
        marker = self.c.get_required_proof_marker(hx(who))
        self.vm.clear_mocks()
        if available:
            body = page if page is not None else f"Review of the product. {marker} Campaign link inside."
            self.vm.mock_web(re.escape(url), {"status": 200, "body": body})
        else:
            self.vm.mock_web(re.escape(url), {"status": 200, "body": "   "})
        self.vm.mock_llm(r"adjudicating whether a sponsored-content creator", verdict)
        self.as_(caller or self.sponsor).judge_content(cid, hx(who))
        self.vm.clear_mocks()
        return self.c.get_submission_status(cid, hx(who))

    def approve(self, who, cid="c1", url=None):
        self.submit(who, cid, url)
        return self.judge(who, cid)


@pytest.fixture
def w(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT, sdk_version=GENVM_VERSION)
    warp(direct_vm, day_iso(0))
    return World(direct_vm, contract)


def contract_module(contract):
    import sys
    instance = object.__getattribute__(contract, "_instance")
    return sys.modules[type(instance).__module__]


class TransferLog:
    """Stands in for the native-transfer interface and records every payout."""

    def __init__(self):
        self.sent = []

    def recipient(self, log):
        class _Recipient:
            def __init__(self, address):
                self.address = address

            def emit_transfer(self, value):
                log.sent.append((hx(self.address).lower(), int(value)))

        return _Recipient


@pytest.fixture
def transfers(w):
    module = contract_module(w.c)
    log = TransferLog()
    original = module._NativeRecipient
    module._NativeRecipient = log.recipient(log)
    yield log
    module._NativeRecipient = original


@pytest.fixture
def prompts(w):
    """Captures every prompt the contract sends to the model."""
    module = contract_module(w.c)
    seen = []
    original = module.gl.nondet.exec_prompt

    def capture(prompt, *args, **kwargs):
        seen.append(prompt)
        return original(prompt, *args, **kwargs)

    module.gl.nondet.exec_prompt = capture
    yield seen
    module.gl.nondet.exec_prompt = original
