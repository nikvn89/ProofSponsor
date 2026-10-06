import { createClient } from 'genlayer-js'
import { studionet } from 'genlayer-js/chains'
import { getAddress } from 'viem'
import { CONTRACT_ADDRESS, STUDIO_RPC, STUDIONET_CHAIN_ID, TREASURY_ENABLED, WALLET_ADD_RPC } from './config'
import { classifyTransaction } from './receipt'
import type { ReceiptVerdict } from './receipt'

const chain = {
  ...studionet,
  rpcUrls: {
    default: {
      http: [STUDIO_RPC],
    },
  },
}

// Normal writes: give consensus up to ten minutes before reporting a delay.
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
  const accounts = (await ethereum().request({
    method: 'eth_requestAccounts',
  })) as string[]

  if (!accounts?.[0]) {
    throw new Error('Wallet connection was not approved.')
  }

  await ensureStudioNet()
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

const STUDIONET_CHAIN_HEX = `0x${STUDIONET_CHAIN_ID.toString(16)}`

function ethereum() {
  if (!window.ethereum) {
    throw new Error(
      'No browser wallet detected. Install MetaMask or a compatible wallet.',
    )
  }
  return window.ethereum
}

/**
 * Put the wallet on StudioNet with wallet_switchEthereumChain, adding the
 * network first when the wallet does not know it (error 4902). No Snap is
 * requested, so plain MetaMask works.
 */
export async function ensureStudioNet(): Promise<void> {
  const eth = ethereum()
  const current = (await eth.request({ method: 'eth_chainId' })) as string
  if (Number.parseInt(current, 16) === STUDIONET_CHAIN_ID) return
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: STUDIONET_CHAIN_HEX }] })
    return
  } catch (error: any) {
    if (Number(error?.code) === 4001) throw new Error('Network switch was rejected in the wallet.')
    if (Number(error?.code) !== 4902) throw error
  }
  await eth.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: STUDIONET_CHAIN_HEX,
      chainName: 'GenLayer Studio Network',
      rpcUrls: [WALLET_ADD_RPC],
      nativeCurrency: { name: 'GEN Token', symbol: 'GEN', decimals: 18 },
    }],
  })
  await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: STUDIONET_CHAIN_HEX }] })
}

async function rawTransaction(hash: string): Promise<any> {
  const response = await fetch(STUDIO_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'eth_getTransactionByHash', params: [hash] }),
  })
  const body = await response.json()
  return body?.result ?? null
}

/**
 * Poll the raw transaction until the leader receipt and consensus status say
 * whether the write was applied. "pending" at the deadline means: submitted,
 * confirmation delayed — never reported as success.
 */
export async function waitForReceipt(
  hash: string,
  timeoutMs = RECEIPT_POLL_INTERVAL_MS * RECEIPT_MAX_RETRIES,
  intervalMs = 4_000,
): Promise<ReceiptVerdict> {
  const deadline = Date.now() + timeoutMs
  let last: ReceiptVerdict = { kind: 'pending', status: '' }
  while (Date.now() < deadline) {
    try {
      const tx = await rawTransaction(hash)
      if (tx) {
        last = classifyTransaction(tx)
        if (last.kind !== 'pending') return last
      }
    } catch {
      // Temporary RPC failures are not a verdict; keep polling.
    }
    await sleep(intervalMs)
  }
  return last
}

export type WriteResult = { hash: string; verdict: ReceiptVerdict }

async function send(
  account: string,
  functionName: string,
  args: Array<string | boolean | bigint>,
  value: bigint,
): Promise<string> {
  await ensureStudioNet()
  const client = getClient(account)
  return (await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as any,
    value,
  })) as string
}

/**
 * Normal state-changing transaction. Resolves only when the leader receipt
 * reports SUCCESS on an applied status; a revert throws with the contract's
 * own sentence. A delayed confirmation resolves with verdict "pending".
 */
async function write(
  account: string,
  functionName: string,
  args: Array<string | boolean | bigint>,
  value: bigint = 0n,
): Promise<WriteResult> {
  const hash = await send(account, functionName, args, value)
  const verdict = await waitForReceipt(hash)
  if (verdict.kind === 'error') {
    throw Object.assign(new Error(verdict.reason), { hash })
  }
  return { hash, verdict }
}

/**
 * AI adjudication transaction. Returns the hash at once; the caller waits
 * with waitForReceipt and a longer timeout because consensus takes longer.
 */
async function writeAsync(
  account: string,
  functionName: string,
  args: Array<string | boolean>,
) {
  return { hash: await send(account, functionName, args, 0n) }
}

/**
 * Read accepted GenLayer state.
 */
async function read(
  functionName: string,
  args: Array<string | boolean | number>,
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
 * Poll AI-verification result until APPROVED / REJECTED / UNAVAILABLE.
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
        status === 'REJECTED' ||
        status === 'UNAVAILABLE'
      ) {
        return status
      }
    } catch (error) {
      // Temporary RPC failures should not be treated as
      // adjudication failures.
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
    rewardWei: bigint,
  ) =>
    write(account, 'create_campaign', TREASURY_ENABLED
      ? [campaignId, name, requirements, rewardWei]
      : [campaignId, name, requirements]),

  fundCampaign: (account: string, campaignId: string, amountWei: bigint) =>
    write(account, 'fund_campaign', [campaignId], amountWei),

  withdrawReward: (account: string, campaignId: string) =>
    write(account, 'withdraw_reward', [campaignId]),

  reserveUnderfunded: (account: string, campaignId: string, creator: string) =>
    write(account, 'reserve_underfunded', [campaignId, normalizeAddress(creator)]),

  releaseExpiredReward: (account: string, campaignId: string, creator: string) =>
    write(account, 'release_expired_reward', [campaignId, normalizeAddress(creator)]),

  reclaimUnused: (account: string, campaignId: string) =>
    write(account, 'reclaim_unused', [campaignId]),

  getCampaignTreasury: (campaignId: string) =>
    read('get_campaign_treasury', [campaignId]) as Promise<string>,

  getPayout: (campaignId: string, creator: string) =>
    read('get_payout', [campaignId, normalizeAddress(creator)]) as Promise<string>,

  getContractInfo: () =>
    read('get_contract_info', []) as Promise<string>,

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

  reviseRejectedContent: (
    account: string,
    campaignId: string,
    description: string,
    evidenceUrl: string,
  ) =>
    write(account, 'revise_rejected_content', [
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

  getCampaignName: (campaignId: string) =>
    read(
      'get_campaign_name',
      [campaignId],
    ) as Promise<string>,

  getCampaignRequirements: (campaignId: string) =>
    read(
      'get_campaign_requirements',
      [campaignId],
    ) as Promise<string>,

  getCampaignCreator: (campaignId: string) =>
    read(
      'get_campaign_creator',
      [campaignId],
    ) as Promise<string>,

  isCampaignActive: (campaignId: string) =>
    read(
      'is_campaign_active',
      [campaignId],
    ) as Promise<boolean>,

  getRequiredProofMarker: (creator: string) =>
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

  getAttemptCount: (campaignId: string, creator: string) =>
    read('get_attempt_count', [campaignId, normalizeAddress(creator)]) as Promise<number>,

  getAttemptDescription: (campaignId: string, creator: string, attempt: number) =>
    read('get_attempt_description', [campaignId, normalizeAddress(creator), attempt]) as Promise<string>,

  getAttemptEvidence: (campaignId: string, creator: string, attempt: number) =>
    read('get_attempt_evidence', [campaignId, normalizeAddress(creator), attempt]) as Promise<string>,

  getAttemptStatus: (campaignId: string, creator: string, attempt: number) =>
    read('get_attempt_status', [campaignId, normalizeAddress(creator), attempt]) as Promise<string>,

  getAttemptReason: (campaignId: string, creator: string, attempt: number) =>
    read('get_attempt_reason', [campaignId, normalizeAddress(creator), attempt]) as Promise<string>,

  getUnavailableRetries: (campaignId: string, creator: string) =>
    read('get_unavailable_retries', [campaignId, normalizeAddress(creator)]) as Promise<number>,

  getMaxUnavailableRetries: () =>
    read('get_max_unavailable_retries', []) as Promise<number>,

  normalizeEvidenceUrl: (evidenceUrl: string) =>
    read('normalize_evidence_url', [evidenceUrl.trim()]) as Promise<string>,

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
