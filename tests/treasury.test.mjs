import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dayToDate,
  formatGen,
  parseGen,
  parsePayout,
  parseTreasury,
  payoutView,
  reclaimBlocker,
} from '../src/lib/treasury.ts'

const GEN = 10n ** 18n

const treasuryJson = (over = {}) => JSON.stringify({
  reward_wei: '1000000000000000000', pool_wei: '3000000000000000000', reserved_wei: '1000000000000000000',
  available_wei: '2000000000000000000', open_submissions: 0, waiting_for_funds: 0, active: false, ...over,
})

const payoutJson = (over = {}) => JSON.stringify({
  payout_status: 'RESERVED', pending_wei: '1000000000000000000', reserved_day: 20732, expires_day: 20762,
  today: 20740, expired: false, reservable_now: false, ...over,
})

test('GEN amounts convert to wei exactly, with no floating point', () => {
  assert.equal(parseGen('10'), 10n * GEN)
  assert.equal(parseGen('0.5'), GEN / 2n)
  assert.equal(parseGen(' 1.000000000000000001 '), GEN + 1n)
  assert.equal(parseGen('123456789.123456789123456789'), 123456789123456789123456789n)
  for (const bad of ['', '-1', '1e3', '0.1234567890123456789', '1,5', 'abc', '.5']) {
    assert.throws(() => parseGen(bad), /GEN amount/, bad)
  }
})

test('wei amounts format exactly, including values past 2^53', () => {
  assert.equal(formatGen(0n), '0 GEN')
  assert.equal(formatGen(GEN / 2n), '0.5 GEN')
  assert.equal(formatGen(1234n * GEN + 1n), '1,234.000000000000000001 GEN')
  assert.equal(formatGen(5000n * GEN), '5,000 GEN')
})

test('contract day numbers map to calendar dates', () => {
  assert.equal(dayToDate(0), '1970-01-01')
  assert.equal(dayToDate(20732), '2026-10-06')
  assert.equal(dayToDate(20762), '2026-11-05')
})

test('treasury view parses string amounts and rejects numbers', () => {
  const t = parseTreasury(treasuryJson({ pool_wei: '5000000000000000000007' }))
  assert.equal(t.poolWei, 5000000000000000000007n)
  assert.equal(parseTreasury('{}'), null)
  assert.equal(parseTreasury(JSON.stringify(treasuryJson())).rewardWei, GEN) // double-encoded RPC string
  assert.throws(() => parseTreasury(treasuryJson({ pool_wei: 1e21 })), /invalid pool/)
})

test('payout view rejects unknown statuses', () => {
  assert.throws(() => parsePayout(payoutJson({ payout_status: 'MAYBE' })), /unknown payout status/)
  assert.equal(parsePayout('{}'), null)
})

test('a reserved reward shows the claim deadline and only the creator may withdraw', () => {
  const p = parsePayout(payoutJson())
  const t = parseTreasury(treasuryJson())
  const mine = payoutView(p, t, true)
  assert.equal(mine.label, '1 GEN reserved')
  assert.match(mine.detail, /Claim by 2026-11-05 · 22 days left/)
  assert.deepEqual([mine.canWithdraw, mine.canRelease, mine.canReserve], [true, false, false])
  assert.equal(payoutView(p, t, false).canWithdraw, false)
  assert.match(payoutView(parsePayout(payoutJson({ today: 20761 })), t, true).detail, /1 day left/)
})

test('an expired reservation can be released by anyone and still withdrawn by the creator', () => {
  const view = payoutView(parsePayout(payoutJson({ today: 20762, expired: true })), null, false)
  assert.equal(view.canRelease, true)
  assert.equal(view.tone, 'warn')
  assert.equal(payoutView(parsePayout(payoutJson({ today: 20762, expired: true })), null, true).canWithdraw, true)
})

test('an underfunded reward offers reservation only when the pool covers it', () => {
  const t = parseTreasury(treasuryJson())
  const waiting = payoutView(parsePayout(payoutJson({ payout_status: 'UNDERFUNDED', pending_wei: '0' })), t, true)
  assert.equal(waiting.canReserve, false)
  assert.match(waiting.detail, /cannot cover 1 GEN/)
  const ready = payoutView(parsePayout(payoutJson({ payout_status: 'UNDERFUNDED', pending_wei: '0', reservable_now: true })), t, false)
  assert.equal(ready.canReserve, true)
})

test('settled and empty payouts offer no action', () => {
  for (const status of ['PAID', 'EXPIRED', 'NO_REWARD']) {
    const view = payoutView(parsePayout(payoutJson({ payout_status: status, pending_wei: '0' })), null, true)
    assert.deepEqual([view.canWithdraw, view.canRelease, view.canReserve], [false, false, false], status)
  }
  assert.equal(payoutView(parsePayout(payoutJson({ payout_status: '' })), null, true), null)
  assert.equal(payoutView(null, null, true), null)
})

test('reclaim explains exactly why it is blocked, in contract order', () => {
  const t = (over) => parseTreasury(treasuryJson(over))
  assert.equal(reclaimBlocker(t(), false), 'Only the sponsor can reclaim.')
  assert.equal(reclaimBlocker(t({ active: true }), true), 'Close the campaign first.')
  assert.equal(reclaimBlocker(t({ open_submissions: 2 }), true), '2 deliveries are still awaiting a verdict.')
  assert.equal(reclaimBlocker(t({ waiting_for_funds: 1 }), true), '1 approved reward is still waiting for funds.')
  assert.equal(reclaimBlocker(t({ available_wei: '0' }), true), 'Nothing to reclaim.')
  assert.equal(reclaimBlocker(t(), true), null)
})
