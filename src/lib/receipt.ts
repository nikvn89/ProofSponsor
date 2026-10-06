// StudioNet receipt rule. A write counts as executed only when the leader
// receipt says execution_result = SUCCESS and consensus has reached an applied
// status (ACCEPTED, READY_TO_FINALIZE or FINALIZED). A missing result is not
// success: it stays "pending" ("submitted — confirmation delayed"). A leader
// ERROR is a revert; the contract's own sentence is surfaced when it can be
// found in the receipt (plain text, hex or base64).

export type ReceiptVerdict =
  | { kind: 'pending'; status: string }
  | { kind: 'success'; status: string }
  | { kind: 'error'; status: string; reason: string }

// Every UserError sentence ProofSponsorV4 can raise.
export const KNOWN_REVERTS = [
  'campaign_id is required',
  'campaign already exists',
  'campaign name is required',
  'campaign requirements are too short',
  'reward is out of range',
  'campaign does not exist',
  'only campaign creator can update campaign',
  'campaign is closed',
  'description is too short',
  'evidence_url must start with https://',
  'creator already submitted to this campaign',
  'evidence already claimed in this campaign',
  'creator has no submission',
  'only a rejected or unavailable submission can be revised',
  'maximum of three attempts reached',
  'creator already used this evidence URL',
  'submission does not exist',
  'submission already judged',
  'only the campaign sponsor can fund it',
  'fund amount must be greater than zero',
  'no reserved reward to withdraw',
  'treasury invariant violated',
  'reward is not waiting for funds',
  'campaign pool still cannot cover the reward',
  'no reserved reward to release',
  'claim window is still open',
  'only the campaign sponsor can reclaim',
  'close the campaign before reclaiming',
  'submissions are still awaiting a verdict',
  'approved rewards are still waiting for funds',
  'nothing to reclaim',
  'invalid transaction datetime',
]

const FAILED_STATUSES = new Set(['CANCELED', 'UNDETERMINED', 'LEADER_TIMEOUT', 'VALIDATORS_TIMEOUT'])
const APPLIED_STATUSES = new Set(['ACCEPTED', 'READY_TO_FINALIZE', 'FINALIZED'])
const STATUS_BY_NUMBER: Record<string, string> = {
  '0': 'UNINITIALIZED', '1': 'PENDING', '2': 'PROPOSING', '3': 'COMMITTING', '4': 'REVEALING',
  '5': 'ACCEPTED', '6': 'UNDETERMINED', '7': 'FINALIZED', '8': 'CANCELED', '9': 'APPEAL_REVEALING',
  '10': 'APPEAL_COMMITTING', '11': 'READY_TO_FINALIZE', '12': 'VALIDATORS_TIMEOUT', '13': 'LEADER_TIMEOUT',
}

function pick(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  return undefined
}

export function leaderReceipt(tx: any): any {
  const consensus = pick(tx, 'consensus_data', 'consensusData')
  let leader = pick(consensus, 'leader_receipt', 'leaderReceipt')
  if (Array.isArray(leader)) {
    leader = leader.find((r: any) => String(pick(r, 'mode') ?? '').toLowerCase() === 'leader') ?? null
  } else if (leader && pick(leader, 'mode') !== undefined && String(pick(leader, 'mode')).toLowerCase() !== 'leader') {
    leader = null
  }
  return leader ?? null
}

function statusName(tx: any): string {
  const raw = pick(tx, 'status_name', 'statusName', 'status')
  if (raw === undefined) return ''
  const name = String(raw).toUpperCase()
  return STATUS_BY_NUMBER[name] ?? name
}

function decodeCandidates(value: string): string[] {
  const out = [value]
  try {
    const hex = value.replace(/^0x/, '')
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
      out.push(new TextDecoder().decode(bytes))
    }
  } catch { /* not hex */ }
  try {
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0 && value.length >= 8) {
      const bin = atob(value)
      out.push(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
    }
  } catch { /* not base64 */ }
  return out
}

function collectStrings(value: any, out: string[], depth = 0): void {
  if (depth > 8 || value === null || value === undefined) return
  if (typeof value === 'string') out.push(...decodeCandidates(value))
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out, depth + 1))
  else if (typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out, depth + 1))
}

export function revertReasonFrom(value: any): string | null {
  const strings: string[] = []
  collectStrings(value, strings)
  for (const s of strings) for (const known of KNOWN_REVERTS) if (s.includes(known)) return known
  for (const s of strings) {
    const m = s.match(/(?:UserError|\[rollback\])[:\s]*([^\n"]{3,200})/i)
    if (m) return m[1].trim()
  }
  return null
}

export function classifyTransaction(tx: any): ReceiptVerdict {
  const status = statusName(tx)
  const leader = leaderReceipt(tx)
  const result = String(pick(leader, 'execution_result', 'executionResult') ?? '').toUpperCase()
  if (result === 'SUCCESS' || result === 'FINISHED_WITH_RETURN') {
    if (FAILED_STATUSES.has(status)) {
      return { kind: 'error', status, reason: `Consensus ended as ${status}; the change was not applied.` }
    }
    if (status !== '' && !APPLIED_STATUSES.has(status)) return { kind: 'pending', status }
    return { kind: 'success', status }
  }
  if (result === 'ERROR' || result === 'FINISHED_WITH_ERROR') {
    return { kind: 'error', status, reason: revertReasonFrom(leader) ?? 'Contract execution rolled back.' }
  }
  if (FAILED_STATUSES.has(status)) {
    return { kind: 'error', status, reason: `Consensus ended as ${status}; the change was not applied.` }
  }
  return { kind: 'pending', status }
}
