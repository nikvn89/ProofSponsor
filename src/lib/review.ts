export type ReviewReader = {
  getCampaignName(id: string): Promise<string>
  getCampaignRequirements(id: string): Promise<string>
  getCampaignCreator(id: string): Promise<string>
  isCampaignActive(id: string): Promise<boolean>
  getRequiredProofMarker(creator: string): Promise<string>
  getSubmissionStatus(id: string, creator: string): Promise<string>
  getSubmissionDescription(id: string, creator: string): Promise<string>
  getSubmissionEvidence(id: string, creator: string): Promise<string>
  getSubmissionReason(id: string, creator: string): Promise<string>
  isEvidenceClaimed(id: string, evidence: string): Promise<boolean>
  getEvidenceClaimedBy(id: string, evidence: string): Promise<string>
}

const limitations = [
  'This snapshot contains separate accepted-state reads, not an atomic block snapshot or a signed attestation.',
  'The evidence URL points to a live external page. Its contents and availability may change after the onchain verdict.',
  'The wallet marker ties the reported page to a wallet string; it does not establish legal identity, authorship, or truth of offchain claims.',
  'The verdict is the contract result, not an independent re-evaluation by this page.',
]

export function normalizeCreator(value: string): string {
  const creator = value.trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(creator)) {
    throw new Error('Enter a valid 0x creator wallet (40 hex characters).')
  }
  return creator
}

export function reviewPath(campaignId: string, creator: string): string {
  const query = new URLSearchParams({ campaign: campaignId.trim(), creator: normalizeCreator(creator) })
  return `#/review?${query.toString()}`
}

export function parseReviewHash(hash: string): { campaignId: string; creator: string } | null {
  if (hash !== '#/review' && !hash.startsWith('#/review?')) return null
  const query = new URLSearchParams(hash.split('?')[1] ?? '')
  return { campaignId: query.get('campaign') ?? '', creator: query.get('creator') ?? '' }
}

function text(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? '')
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value)
      if (typeof parsed === 'string') return parsed
    } catch {
      // Some RPC implementations return raw text, not JSON-encoded text.
    }
  }
  return value
}

function boolean(value: unknown): boolean {
  if (value === true || value === 'true' || value === 1) return true
  if (value === false || value === 'false' || value === 0) return false
  throw new Error('The contract returned an unrecognized boolean value.')
}

export function safeEvidenceUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

export async function loadReview(
  reader: ReviewReader,
  campaignIdInput: string,
  creatorInput: string,
  contractAddress: string,
  retrievedAt = new Date(),
) {
  const id = campaignIdInput.trim()
  if (!id) throw new Error('Enter a sponsorship ID.')
  const creator = normalizeCreator(creatorInput)

  const [name, requirements, sponsor, active] = await Promise.all([
    reader.getCampaignName(id),
    reader.getCampaignRequirements(id),
    reader.getCampaignCreator(id),
    reader.isCampaignActive(id),
  ])
  if (!text(name)) throw new Error('Sponsorship not found in accepted state.')

  const [statusValue, description, evidenceValue, reason, marker] = await Promise.all([
    reader.getSubmissionStatus(id, creator),
    reader.getSubmissionDescription(id, creator),
    reader.getSubmissionEvidence(id, creator),
    reader.getSubmissionReason(id, creator),
    reader.getRequiredProofMarker(creator),
  ])
  const status = text(statusValue)
  if (!status) throw new Error('No delivery found for this sponsorship and wallet.')
  if (!['SUBMITTED', 'APPROVED', 'REJECTED'].includes(status)) {
    throw new Error('The contract returned an unrecognized delivery status.')
  }
  const evidence = text(evidenceValue)
  if (!evidence || !text(marker)) throw new Error('The delivery record is incomplete.')

  const [claimed, claimedBy] = await Promise.all([
    reader.isEvidenceClaimed(id, evidence),
    reader.getEvidenceClaimedBy(id, evidence),
  ])
  const isClaimed = boolean(claimed)
  const claimOwner = text(claimedBy)
  const claimMatchesCreator = isClaimed && claimOwner.toLowerCase() === creator.toLowerCase()

  return {
    schema: 'proofsponsor.delivery-review.v1',
    source: {
      chain: 'GenLayer StudioNet',
      contract: contractAddress,
      state: 'accepted',
      retrievedAtUtc: retrievedAt.toISOString(),
    },
    campaign: {
      id,
      name: text(name),
      requirements: text(requirements),
      sponsor: text(sponsor),
      active: boolean(active),
    },
    creator,
    proofMarker: text(marker),
    submission: {
      status,
      description: text(description),
      evidence,
      reason: text(reason),
    },
    claim: { claimed: isClaimed, claimedBy: claimOwner, matchesCreator: claimMatchesCreator },
    inconsistent: (status === 'APPROVED' && !claimMatchesCreator) || (!isClaimed && !!claimOwner),
    limitations,
  }
}

export type DeliveryReview = Awaited<ReturnType<typeof loadReview>>
