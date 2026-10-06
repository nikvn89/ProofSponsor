import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { KNOWN_REVERTS, classifyTransaction, revertReasonFrom } from '../src/lib/receipt.ts'

const leader = (execution_result, extra = {}) => ({ consensus_data: { leader_receipt: [{ mode: 'leader', execution_result, ...extra }] } })

test('the app knows every revert sentence the V4 contract can raise, and no others', () => {
  const source = readFileSync(new URL('../contracts/ProofSponsorV4.py', import.meta.url), 'utf8')
  const raised = new Set()
  for (const m of source.matchAll(/UserError\(\s*(?:\(\s*)?"([^"]+)"/g)) raised.add(m[1])
  for (const m of source.matchAll(/_require_sponsor\(campaign_id, "([^"]+)"\)/g)) raised.add(m[1])
  assert.deepEqual([...raised].sort(), [...KNOWN_REVERTS].sort())
})

test('success needs a leader SUCCESS on an applied status', () => {
  assert.equal(classifyTransaction({ status_name: 'ACCEPTED', ...leader('SUCCESS') }).kind, 'success')
  assert.equal(classifyTransaction({ status: '7', ...leader('SUCCESS') }).kind, 'success')
  assert.equal(classifyTransaction({ status_name: 'COMMITTING', ...leader('SUCCESS') }).kind, 'pending')
  assert.equal(classifyTransaction({ status_name: 'ACCEPTED' }).kind, 'pending')
  assert.equal(classifyTransaction({ status_name: 'ACCEPTED', ...leader(null) }).kind, 'pending')
})

test('a leader error is a revert with the contract sentence', () => {
  const hex = Buffer.from('UserError: claim window is still open').toString('hex')
  const v = classifyTransaction({ status_name: 'ACCEPTED', ...leader('ERROR', { result: { payload: hex } }) })
  assert.deepEqual(v, { kind: 'error', status: 'ACCEPTED', reason: 'claim window is still open' })
  const b64 = Buffer.from('[rollback] nothing to reclaim').toString('base64')
  assert.equal(revertReasonFrom({ eq_outputs: [b64] }), 'nothing to reclaim')
  assert.equal(classifyTransaction({ status_name: 'ACCEPTED', ...leader('ERROR') }).reason, 'Contract execution rolled back.')
})

test('failed consensus is never success', () => {
  for (const status of ['CANCELED', 'UNDETERMINED', 'LEADER_TIMEOUT', 'VALIDATORS_TIMEOUT']) {
    assert.equal(classifyTransaction({ status_name: status, ...leader('SUCCESS') }).kind, 'error', status)
    assert.equal(classifyTransaction({ status_name: status }).kind, 'error', status)
  }
})

test('a validator receipt is not mistaken for the leader receipt', () => {
  const tx = { status_name: 'ACCEPTED', consensus_data: { leader_receipt: [{ mode: 'validator', execution_result: 'SUCCESS' }] } }
  assert.equal(classifyTransaction(tx).kind, 'pending')
})
