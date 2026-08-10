import { createClient } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'
import { TransactionStatus } from 'genlayer-js/types'
import { getAddress } from 'viem'
import { CONTRACT_ADDRESS, STUDIO_RPC } from './config'

const chain = {
  ...studionet,
  rpcUrls: {
    default: {
      http: [STUDIO_RPC],
    },
  },
}

// Avoid aggressive RPC polling while waiting for normal transactions.
const RECEIPT_POLL_INTERVAL_MS = 15_000
const RECEIPT_MAX_RETRIES = 40

// AI adjudication can take longer, so poll with backoff.
const VERDICT_TIMEOUT_MS = 300_000
const VERDICT_INITIAL_INTERVAL_MS = 15_000
const VERDICT_MAX_INTERVAL_MS = 30_000

export const normalizeAddress = (address: string) => getAddress(address)

export const getClient = (account?: string) => {
  const provider =
    typeof window !== 'undefined' ? window.ethereum : undefined

  const checksummed = account
    ? normalizeAddress(account)
    : undefined

  return createClient({
    chain,
    account: checksummed as any,
    provider: provider as any,
  })
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error(
      'No browser wallet detected. Install MetaMask or a compatible wallet.',
    )
  }

  const accounts = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[]

  if (!accounts?.[0]) {
    throw new Error('Wallet connection was not approved.')
  }

  return normalizeAddress(accounts[0])
}

export function validateEvidenceUrl(url: string): string {
  const value = url.trim()

  if (!value.startsWith('https://')) {
    throw new Error('Evidence URL must begin with https://.')
  }

  const lower = value.toLowerCase()

  if (lower.includes('raw.githubusercontent.com')) {
    throw new Error(
      'GenLayer validators may not reliably render raw.githubusercontent.com. Use a public repository homepage or another renderable public webpage.',
    )
  }

  if (
    lower.includes('github.com/') &&
    lower.includes('/blob/')
  ) {
    throw new Error(
      'GenLayer validators may not reliably render GitHub /blob/ links. Use the repository homepage or another renderable public webpage.',
    )
  }

  return value
}

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Normal state-changing transaction.
 *
 * Used for:
 * - create_campaign
 * - set_campaign_active
 * - submit_content
 *
 * We wait until ACCEPTED before the UI reads state again.
 *
 * Important:
 * Explicitly use a slow receipt polling interval to avoid excessive
 * RPC requests while GenLayer is processing the transaction.
 */
async function write(
  account: string,
  functionName: string,
  args: Array<string | boolean>,
) {
  const client = getClient(account)

  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value: BigInt(0),
  })

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
    interval: RECEIPT_POLL_INTERVAL_MS,
    retries: RECEIPT_MAX_RETRIES,
  })

  return {
    hash,
    receipt,
  }
}

/**
 * AI adjudication transaction.
 *
 * judge_content is intentionally submitted without waiting for
 * the transaction receipt because GenLayer AI consensus may take
 * considerably longer.
 *
 * The frontend tracks the final result by reading submission status
 * separately with pollSubmissionStatus().
 */
async function writeAsync(
  account: string,
  functionName: string,
  args: Array<string | boolean>,
) {
  const client = getClient(account)

  const hash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value: BigInt(0),
  })

  return {
    hash,
  }
}

/**
 * Read accepted GenLayer state.
 */
async function read(
  functionName: string,
  args: Array<string | boolean>,
) {
  const client = getClient()

  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    stateStatus: 'accepted',
  } as any)
}

/**
 * Poll an AI-verification submission until GenLayer reaches
 * APPROVED or REJECTED.
 *
 * Poll schedule:
 *
 * ~15s
 * ~21s
 * ~29.4s
 * then max 30s
 *
 * Overall timeout:
 * 5 minutes
 *
 * Transient RPC errors are ignored because the transaction may
 * still be progressing normally onchain.
 */
export async function pollSubmissionStatus(
  campaignId: string,
  creator: string,
  options: {
    timeoutMs?: number
    intervalMs?: number
    maxIntervalMs?: number
  } = {},
): Promise<string> {
  const timeoutMs =
    options.timeoutMs ?? VERDICT_TIMEOUT_MS

  const maxIntervalMs =
    options.maxIntervalMs ?? VERDICT_MAX_INTERVAL_MS

  let interval =
    options.intervalMs ?? VERDICT_INITIAL_INTERVAL_MS

  const deadline = Date.now() + timeoutMs

  let lastStatus = ''
  let lastError: unknown

  for (;;) {
    try {
      const status = String(
        await sponsorJudge.getSubmissionStatus(
          campaignId,
          creator,
        ),
      ).replace(/^"|"$/g, '')

      lastStatus = status
      lastError = undefined

      if (
        status === 'APPROVED' ||
        status === 'REJECTED'
      ) {
        return status
      }
    } catch (error) {
      // A temporary RPC failure does not mean adjudication failed.
      // Keep polling until timeout.
      lastError = error
    }

    if (Date.now() >= deadline) {
      if (lastStatus) {
        return lastStatus
      }

      throw lastError instanceof Error
        ? lastError
        : new Error(
            'Verification is taking longer than expected. It may still finish onchain — reload the deliverable shortly.',
          )
    }

    await sleep(interval)

    interval = Math.min(
      Math.round(interval * 1.4),
      maxIntervalMs,
    )
  }
}

export const sponsorJudge = {
  createCampaign: (
    account: string,
    campaignId: string,
    name: string,
    requirements: string,
  ) =>
    write(account, 'create_campaign', [
      campaignId,
      name,
      requirements,
    ]),

  setCampaignActive: (
    account: string,
    campaignId: string,
    active: boolean,
  ) =>
    write(account, 'set_campaign_active', [
      campaignId,
      active,
    ]),

  submitContent: (
    account: string,
    campaignId: string,
    description: string,
    evidenceUrl: string,
  ) =>
    write(account, 'submit_content', [
      campaignId,
      description,
      validateEvidenceUrl(evidenceUrl),
    ]),

  judgeContent: (
    account: string,
    campaignId: string,
    creator: string,
  ) =>
    writeAsync(account, 'judge_content', [
      campaignId,
      normalizeAddress(creator),
    ]),

  getCampaignName: (
    campaignId: string,
  ) =>
    read(
      'get_campaign_name',
      [campaignId],
    ) as Promise<string>,

  getCampaignRequirements: (
    campaignId: string,
  ) =>
    read(
      'get_campaign_requirements',
      [campaignId],
    ) as Promise<string>,

  getCampaignCreator: (
    campaignId: string,
  ) =>
    read(
      'get_campaign_creator',
      [campaignId],
    ) as Promise<string>,

  isCampaignActive: (
    campaignId: string,
  ) =>
    read(
      'is_campaign_active',
      [campaignId],
    ) as Promise<boolean>,

  getRequiredProofMarker: (
    creator: string,
  ) =>
    read(
      'get_required_proof_marker',
      [normalizeAddress(creator)],
    ) as Promise<string>,

  getSubmissionStatus: (
    campaignId: string,
    creator: string,
  ) =>
    read(
      'get_submission_status',
      [
        campaignId,
        normalizeAddress(creator),
      ],
    ) as Promise<string>,

  getSubmissionDescription: (
    campaignId: string,
    creator: string,
  ) =>
    read(
      'get_submission_description',
      [
        campaignId,
        normalizeAddress(creator),
      ],
    ) as Promise<string>,

  getSubmissionEvidence: (
    campaignId: string,
    creator: string,
  ) =>
    read(
      'get_submission_evidence',
      [
        campaignId,
        normalizeAddress(creator),
      ],
    ) as Promise<string>,

  getSubmissionReason: (
    campaignId: string,
    creator: string,
  ) =>
    read(
      'get_submission_reason',
      [
        campaignId,
        normalizeAddress(creator),
      ],
    ) as Promise<string>,

  isEvidenceClaimed: (
    campaignId: string,
    evidenceUrl: string,
  ) =>
    read(
      'is_evidence_claimed',
      [
        campaignId,
        evidenceUrl.trim(),
      ],
    ) as Promise<boolean>,

  getEvidenceClaimedBy: (
    campaignId: string,
    evidenceUrl: string,
  ) =>
    read(
      'get_evidence_claimed_by',
      [
        campaignId,
        evidenceUrl.trim(),
      ],
    ) as Promise<string>,
}