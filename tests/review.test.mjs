import assert from 'node:assert/strict'
import test from 'node:test'
import {
  loadReview,
  normalizeCreator,
  parseReviewHash,
  reviewPath,
  safeEvidenceUrl,
} from '../src/lib/review.ts'

const creator = '0x1234567890abcdef1234567890abcdef12345678'
const sponsor = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const contract = '0x3Aa42FdD6EC0299c4172aaB47C4f0586625736bC'

function mockReader(overrides = {}) {
  const calls = []
  const result = (method, value) => async (...args) => {
    calls.push([method, ...args])
    return value
  }
  return {
    calls,
    getCampaignName: result('name', 'Sponsored article'),
    getCampaignRequirements: result('requirements', 'Publish a meaningful article.'),
    getCampaignCreator: result('sponsor', sponsor),
    isCampaignActive: result('active', true),
    getRequiredProofMarker: result('marker', `SPONSORJUDGE_PROOF:${creator}`),
    getSubmissionStatus: result('status', 'APPROVED'),
    getSubmissionDescription: result('description', 'Published the work.'),
    getSubmissionEvidence: result('evidence', 'https://example.org/article'),
    getSubmissionReason: result('reason', 'Validators approved the article.'),
    isEvidenceClaimed: result('claimed', true),
    getEvidenceClaimedBy: result('claimedBy', creator.toUpperCase()),
    ...overrides,
  }
}

test('creates a shareable route even when the campaign ID needs URL encoding', () => {
  const path = reviewPath(' campaign?=1 & two ', creator)
  assert.deepEqual(parseReviewHash(path), { campaignId: 'campaign?=1 & two', creator })
  assert.equal(parseReviewHash('#/reviews?campaign=a'), null)
  assert.deepEqual(parseReviewHash('#/review'), { campaignId: '', creator: '' })
  assert.throws(() => normalizeCreator('not an address'), /valid 0x creator/)
})

test('loads a case from accepted-state views without wallet access or writes', async () => {
  const reader = mockReader()
  const record = await loadReview(reader, 'case-1', creator, contract, new Date('2026-09-12T12:00:00Z'))
  assert.equal(record.source.state, 'accepted')
  assert.equal(record.source.retrievedAtUtc, '2026-09-12T12:00:00.000Z')
  assert.equal(record.submission.status, 'APPROVED')
  assert.equal(record.claim.matchesCreator, true)
  assert.equal(record.inconsistent, false)
  assert.equal(reader.calls.length, 11)
  assert.deepEqual(reader.calls.find(([method]) => method === 'claimed'), ['claimed', 'case-1', 'https://example.org/article'])
  assert.deepEqual(reader.calls.find(([method]) => method === 'marker'), ['marker', creator])
})

test('fails closed on missing campaigns and deliveries', async () => {
  const missingCampaign = mockReader({ getCampaignName: async () => '' })
  await assert.rejects(loadReview(missingCampaign, 'bad', creator, contract), /Sponsorship not found/)
  assert.equal(missingCampaign.calls.some(([method]) => method === 'status'), false)

  const missingDelivery = mockReader({ getSubmissionStatus: async () => '' })
  await assert.rejects(loadReview(missingDelivery, 'case-1', creator, contract), /No delivery found/)
  assert.equal(missingDelivery.calls.some(([method]) => method === 'claimed'), false)
})

test('validates inputs and unexpected verdicts before rendering a case', async () => {
  const reader = mockReader()
  await assert.rejects(loadReview(reader, '', creator, contract), /sponsorship ID/)
  await assert.rejects(loadReview(reader, 'case-1', '0xBAD', contract), /valid 0x creator/)
  assert.equal(reader.calls.length, 0)
  await assert.rejects(
    loadReview(mockReader({ getSubmissionStatus: async () => 'INVENTED' }), 'case-1', creator, contract),
    /unrecognized delivery status/,
  )
})

test('displays inconsistent claims instead of silently presenting an approved case as verified', async () => {
  const reader = mockReader({ isEvidenceClaimed: async () => 'false', getEvidenceClaimedBy: async () => '' })
  const record = await loadReview(reader, 'case-1', creator, contract)
  assert.equal(record.claim.claimed, false)
  assert.equal(record.claim.matchesCreator, false)
  assert.equal(record.inconsistent, true)
})

test('preserves a rejected verdict when evidence is claimed by a different creator', async () => {
  const reader = mockReader({
    getSubmissionStatus: async () => '"REJECTED"',
    getEvidenceClaimedBy: async () => sponsor,
    isCampaignActive: async () => 'false',
  })
  const record = await loadReview(reader, 'case-1', creator, contract)
  assert.equal(record.submission.status, 'REJECTED')
  assert.equal(record.campaign.active, false)
  assert.equal(record.claim.claimed, true)
  assert.equal(record.claim.matchesCreator, false)
  assert.equal(record.inconsistent, false)
})

test('rejects unrecognized boolean and incomplete delivery responses', async () => {
  await assert.rejects(
    loadReview(mockReader({ isEvidenceClaimed: async () => 'maybe' }), 'case-1', creator, contract),
    /unrecognized boolean/,
  )
  await assert.rejects(
    loadReview(mockReader({ getSubmissionEvidence: async () => '' }), 'case-1', creator, contract),
    /incomplete/,
  )
})

test('does not turn an untrusted onchain URL into a script or non-HTTPS link', () => {
  assert.equal(safeEvidenceUrl('javascript:alert(1)'), null)
  assert.equal(safeEvidenceUrl('http://example.org'), null)
  assert.equal(safeEvidenceUrl('https://user:pass@example.org/path'), null)
  assert.equal(safeEvidenceUrl('https://example.org/article'), 'https://example.org/article')
})
