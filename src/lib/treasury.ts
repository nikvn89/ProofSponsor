// Campaign treasury and payout views of ProofSponsor V4.
// The contract returns every wei amount as a decimal string, so nothing here
// passes a token amount through a JavaScript number.

export const WEI_PER_GEN = 10n ** 18n
export const MAX_REWARD_WEI = 10n ** 27n

export type Treasury = {
  rewardWei: bigint
  poolWei: bigint
  reservedWei: bigint
  availableWei: bigint
  openSubmissions: number
  waitingForFunds: number
  active: boolean
}

export type PayoutStatus = '' | 'RESERVED' | 'UNDERFUNDED' | 'PAID' | 'EXPIRED' | 'NO_REWARD'

export type Payout = {
  status: PayoutStatus
  pendingWei: bigint
  reservedDay: number
  expiresDay: number
  today: number
  expired: boolean
  reservableNow: boolean
}

const PAYOUT_STATUSES: PayoutStatus[] = ['', 'RESERVED', 'UNDERFUNDED', 'PAID', 'EXPIRED', 'NO_REWARD']

function unwrap(raw: unknown): string {
  let value = String(raw ?? '')
  // Some RPC paths JSON-encode the returned string a second time.
  if (value.startsWith('"')) {
    try {
      const inner = JSON.parse(value)
      if (typeof inner === 'string') value = inner
    } catch { /* raw text */ }
  }
  return value
}

function weiField(value: unknown, name: string): bigint {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new Error(`The contract returned an invalid ${name}.`)
  }
  return BigInt(value)
}

function intField(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`The contract returned an invalid ${name}.`)
  }
  return value
}

export function parseTreasury(raw: unknown): Treasury | null {
  const data = JSON.parse(unwrap(raw) || '{}')
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null
  const treasury = {
    rewardWei: weiField(data.reward_wei, 'reward'),
    poolWei: weiField(data.pool_wei, 'pool'),
    reservedWei: weiField(data.reserved_wei, 'reserved amount'),
    availableWei: weiField(data.available_wei, 'available amount'),
    openSubmissions: intField(data.open_submissions, 'open submission count'),
    waitingForFunds: intField(data.waiting_for_funds, 'waiting count'),
    active: data.active === true,
  }
  return treasury
}

export function parsePayout(raw: unknown): Payout | null {
  const data = JSON.parse(unwrap(raw) || '{}')
  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) return null
  if (!PAYOUT_STATUSES.includes(data.payout_status)) {
    throw new Error('The contract returned an unknown payout status.')
  }
  return {
    status: data.payout_status,
    pendingWei: weiField(data.pending_wei, 'pending reward'),
    reservedDay: intField(data.reserved_day, 'reservation day'),
    expiresDay: intField(data.expires_day, 'expiry day'),
    today: intField(data.today, 'contract day'),
    expired: data.expired === true,
    reservableNow: data.reservable_now === true,
  }
}

/** "1.5" -> 1500000000000000000n. Exact: at most 18 decimals, no floats. */
export function parseGen(input: string): bigint {
  const value = input.trim()
  const match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(value)
  if (!match) throw new Error('Enter a GEN amount such as 10 or 0.5 (up to 18 decimals).')
  const whole = BigInt(match[1]) * WEI_PER_GEN
  const fraction = match[2] ? BigInt(match[2].padEnd(18, '0')) : 0n
  return whole + fraction
}

/** 1500000000000000000n -> "1.5 GEN". Exact, trailing zeros trimmed. */
export function formatGen(wei: bigint): string {
  const whole = wei / WEI_PER_GEN
  const fraction = (wei % WEI_PER_GEN).toString().padStart(18, '0').replace(/0+$/, '')
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${grouped}${fraction ? `.${fraction}` : ''} GEN`
}

/** Contract day number (days since 1970-01-01 UTC) -> "2026-11-05". */
export function dayToDate(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10)
}

export type PayoutView = {
  label: string
  detail: string
  tone: 'good' | 'warn' | 'bad' | 'neutral'
  canWithdraw: boolean
  canRelease: boolean
  canReserve: boolean
}

/** What the payout box shows, and which actions are open, for one delivery. */
export function payoutView(payout: Payout | null, treasury: Treasury | null, isCreator: boolean): PayoutView | null {
  if (!payout || !payout.status) return null
  const reward = treasury ? formatGen(treasury.rewardWei) : 'the reward'
  switch (payout.status) {
    case 'RESERVED': {
      const daysLeft = payout.expiresDay - payout.today
      return {
        label: `${formatGen(payout.pendingWei)} reserved`,
        detail: payout.expired
          ? `The claim window closed on ${dayToDate(payout.expiresDay)}. The creator can still withdraw until someone releases it back to the pool.`
          : `Claim by ${dayToDate(payout.expiresDay)} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
        tone: payout.expired ? 'warn' : 'good',
        canWithdraw: isCreator,
        canRelease: payout.expired,
        canReserve: false,
      }
    }
    case 'UNDERFUNDED':
      return {
        label: 'Approved · waiting for funds',
        detail: payout.reservableNow
          ? `The pool now covers ${reward}. Anyone can reserve it for the creator.`
          : `The pool cannot cover ${reward} yet. The sponsor must top it up; the leftover cannot be reclaimed meanwhile.`,
        tone: 'warn',
        canWithdraw: false,
        canRelease: false,
        canReserve: payout.reservableNow,
      }
    case 'PAID':
      return { label: 'Reward paid', detail: 'The creator withdrew the reward.', tone: 'good', canWithdraw: false, canRelease: false, canReserve: false }
    case 'EXPIRED':
      return { label: 'Claim window expired', detail: 'The unclaimed reward went back to the campaign pool.', tone: 'neutral', canWithdraw: false, canRelease: false, canReserve: false }
    case 'NO_REWARD':
      return { label: 'No reward attached', detail: 'This campaign pays nothing per approved delivery.', tone: 'neutral', canWithdraw: false, canRelease: false, canReserve: false }
    default:
      return null
  }
}

/** Why the sponsor's reclaim button is disabled, or null when it is open. */
export function reclaimBlocker(treasury: Treasury | null, isSponsor: boolean): string | null {
  if (!treasury) return 'Treasury not loaded.'
  if (!isSponsor) return 'Only the sponsor can reclaim.'
  if (treasury.active) return 'Close the campaign first.'
  if (treasury.openSubmissions > 0) return `${treasury.openSubmissions} deliver${treasury.openSubmissions === 1 ? 'y is' : 'ies are'} still awaiting a verdict.`
  if (treasury.waitingForFunds > 0) return `${treasury.waitingForFunds} approved reward${treasury.waitingForFunds === 1 ? ' is' : 's are'} still waiting for funds.`
  if (treasury.availableWei === 0n) return 'Nothing to reclaim.'
  return null
}
