import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clipboard,
  Clock3,
  Coins,
  HandCoins,
  Lock,
  LockOpen,
  PiggyBank,
  RotateCcw,
  ExternalLink,
  FileCheck2,
  Gauge,
  Globe2,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  XCircle,
} from 'lucide-react'
import WalletButton from './components/WalletButton'
import StatusPill from './components/StatusPill'
import ReviewDossier from './ReviewDossier'
import { CONFIG_ERROR, CONTRACT_ADDRESS, CONTRACT_VERSION, EXPLORER_BASE, REVISION_ENABLED, TREASURY_ENABLED } from './lib/config'
import { loadAttempts, parseReviewHash, reviewPath, safeEvidenceUrl } from './lib/review'
import type { AttemptReader } from './lib/review'
import {
  connectWallet,
  normalizeAddress,
  pollSubmissionStatus,
  sponsorJudge,
  validateEvidenceUrl,
  waitForReceipt,
} from './lib/genlayer'
import type { WriteResult } from './lib/genlayer'
import {
  formatGen,
  parseGen,
  parsePayout,
  parseTreasury,
  payoutView,
  reclaimBlocker,
} from './lib/treasury'
import type { Payout, Treasury } from './lib/treasury'
import { getRecentCampaigns, rememberCampaign } from './lib/storage'

type Campaign = {
  id: string
  name: string
  requirements: string
  creator: string
  active: boolean
}

type Submission = {
  creator: string
  description: string
  evidence: string
  status: string
  reason: string
  attempts: Awaited<ReturnType<typeof loadAttempts>>
  attemptCanonicalUrls: string[]
  unavailableRetries: number
  maxUnavailableRetries: number
}

type Notice = {
  kind: 'success' | 'error' | 'info'
  message: string
  tx?: string
} | null

const clean = (value: unknown) => String(value ?? '').replace(/^"|"$/g, '')

function useCanonicalEvidenceUrl(value: string) {
  const [canonical, setCanonical] = useState('')

  useEffect(() => {
    const url = value.trim()
    if (!url.startsWith('https://') || CONFIG_ERROR) {
      setCanonical('')
      return
    }

    let active = true
    const timer = window.setTimeout(() => {
      sponsorJudge.normalizeEvidenceUrl(url)
        .then((result) => {
          if (active) setCanonical(clean(result))
        })
        .catch(() => {
          if (active) setCanonical('')
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [value])

  return canonical
}

export default function App() {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [])

  return parseReviewHash(hash) ? <ReviewDossier key={hash} /> : <Dashboard />
}

function Dashboard() {
  const [account, setAccount] = useState('')
  const [walletBusy, setWalletBusy] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState<Notice>(null)

  const [recent, setRecent] = useState<string[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [campaign, setCampaign] = useState<Campaign | null>(null)

  const [createForm, setCreateForm] = useState({
    id: '',
    name: '',
    requirements: '',
    reward: '',
  })

  const [treasury, setTreasury] = useState<Treasury | null>(null)
  const [payout, setPayout] = useState<Payout | null>(null)
  const [fundAmount, setFundAmount] = useState('')

  const [proofWallet, setProofWallet] = useState('')
  const [proofMarker, setProofMarker] = useState('')

  const [submitForm, setSubmitForm] = useState({
    description: '',
    evidence: '',
  })

  const [revisionForm, setRevisionForm] = useState({ description: '', evidence: '' })

  const submitCanonical = useCanonicalEvidenceUrl(submitForm.evidence)
  const revisionCanonical = useCanonicalEvidenceUrl(revisionForm.evidence)

  const [lookupWallet, setLookupWallet] = useState('')
  const [submission, setSubmission] = useState<Submission | null>(null)

  useEffect(() => setRecent(getRecentCampaigns()), [])

  const explorer = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`

  const verificationProgress = useMemo(() => {
    if (!campaign) return 0
    if (!submission) return 25
    if (submission.status === 'SUBMITTED' || submission.status === 'UNAVAILABLE') return 70
    if (submission.status === 'APPROVED' || submission.status === 'REJECTED') return 100
    return 45
  }, [campaign, submission])

  const submitDuplicate = Boolean(
    submitCanonical &&
    submission &&
    account.toLowerCase() === submission.creator.toLowerCase() &&
    submission.attemptCanonicalUrls.includes(submitCanonical),
  )
  const revisionDuplicate = Boolean(
    revisionCanonical && submission?.attemptCanonicalUrls.includes(revisionCanonical),
  )

  async function connect() {
    setWalletBusy(true)
    setNotice(null)

    try {
      const address = await connectWallet()
      setAccount(address)
      setProofWallet(address)
      setLookupWallet(address)
      setNotice({
        kind: 'success',
        message: 'Wallet connected to GenLayer Studionet.',
      })
    } catch (error) {
      setNotice({ kind: 'error', message: msg(error) })
    } finally {
      setWalletBusy(false)
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault()

    if (!account) {
      return setNotice({ kind: 'error', message: 'Connect wallet first.' })
    }

    if (
      !createForm.id.trim() ||
      !createForm.name.trim() ||
      createForm.requirements.trim().length < 30
    ) {
      return setNotice({
        kind: 'error',
        message:
          'Sponsorship ID, title, and requirements of at least 30 characters are required.',
      })
    }

    let rewardWei = 0n
    if (TREASURY_ENABLED) {
      try {
        rewardWei = parseGen(createForm.reward || '0')
      } catch (error) {
        return setNotice({ kind: 'error', message: msg(error) })
      }
    }

    setBusy('create')

    try {
      const result = await sponsorJudge.createCampaign(
        account,
        createForm.id.trim(),
        createForm.name.trim(),
        createForm.requirements.trim(),
        rewardWei,
      )

      setCampaignId(createForm.id.trim())
      setRecent(rememberCampaign(createForm.id.trim()))
      setNotice(writeNotice(
        result,
        TREASURY_ENABLED && rewardWei > 0n
          ? 'Sponsorship created. Fund the reward pool so approved deliveries can be paid.'
          : 'Sponsorship created.',
      ))

      await loadCampaign(createForm.id.trim())
    } catch (error) {
      setNotice({ kind: 'error', message: msg(error) })
    } finally {
      setBusy('')
    }
  }

  async function loadCampaign(idOverride?: string) {
    const id = (idOverride ?? campaignId).trim()
    if (!id) return

    setBusy('campaign')

    try {
      const [name, requirements, creator, active] = await Promise.all([
        sponsorJudge.getCampaignName(id),
        sponsorJudge.getCampaignRequirements(id),
        sponsorJudge.getCampaignCreator(id),
        sponsorJudge.isCampaignActive(id),
      ])

      if (!clean(name)) throw new Error('Sponsorship not found.')

      setCampaign({
        id,
        name: clean(name),
        requirements: clean(requirements),
        creator: clean(creator),
        active: Boolean(active),
      })

      setCampaignId(id)
      setRecent(rememberCampaign(id))
      setSubmission(null)
      setPayout(null)
      await refreshTreasury(id)
    } catch (error) {
      setNotice({ kind: 'error', message: msg(error) })
    } finally {
      setBusy('')
    }
  }

  async function refreshTreasury(id: string) {
    if (!TREASURY_ENABLED) return setTreasury(null)
    setTreasury(parseTreasury(await sponsorJudge.getCampaignTreasury(id)))
  }

  async function refreshPayout(id: string, creator: string) {
    if (!TREASURY_ENABLED) return setPayout(null)
    setPayout(parsePayout(await sponsorJudge.getPayout(id, creator)))
  }

  async function runWrite(
    label: string,
    action: () => Promise<WriteResult>,
    success: string,
    after: () => Promise<void>,
  ) {
    if (!account) return setNotice({ kind: 'error', message: 'Connect wallet first.' })
    setBusy(label)
    setNotice({ kind: 'info', message: 'Confirm in your wallet, then wait for consensus…' })
    try {
      const result = await action()
      setNotice(writeNotice(result, success))
      await after()
    } catch (error) {
      setNotice({ kind: 'error', message: msg(error), tx: (error as { hash?: string })?.hash })
    } finally {
      setBusy('')
    }
  }

  async function reloadCampaignMoney() {
    if (!campaign) return
    await refreshTreasury(campaign.id)
    if (submission) await refreshPayout(campaign.id, submission.creator)
  }

  function fund(event: React.FormEvent) {
    event.preventDefault()
    if (!campaign) return
    let amount: bigint
    try {
      amount = parseGen(fundAmount)
      if (amount === 0n) throw new Error('Enter an amount greater than zero.')
    } catch (error) {
      return setNotice({ kind: 'error', message: msg(error) })
    }
    void runWrite('fund', () => sponsorJudge.fundCampaign(account, campaign.id, amount),
      `Added ${formatGen(amount)} to the reward pool.`, async () => {
        setFundAmount('')
        await reloadCampaignMoney()
      })
  }

  function toggleActive() {
    if (!campaign) return
    const next = !campaign.active
    void runWrite('active', () => sponsorJudge.setCampaignActive(account, campaign.id, next),
      next ? 'Campaign reopened for submissions.' : 'Campaign closed. Deliveries already submitted can still be verified and paid.',
      () => loadCampaign(campaign.id))
  }

  function reclaim() {
    if (!campaign || !treasury) return
    const amount = treasury.availableWei
    void runWrite('reclaim', () => sponsorJudge.reclaimUnused(account, campaign.id),
      `Reclaimed ${formatGen(amount)}. Reserved rewards stay in the pool for their creators.`, reloadCampaignMoney)
  }

  function withdraw() {
    if (!campaign) return
    void runWrite('withdraw', () => sponsorJudge.withdrawReward(account, campaign.id),
      'Reward sent to your wallet.', reloadCampaignMoney)
  }

  function reserveNow() {
    if (!campaign || !submission) return
    void runWrite('reserve', () => sponsorJudge.reserveUnderfunded(account, campaign.id, submission.creator),
      'Reward reserved for the creator. The 30-day claim window starts today.', reloadCampaignMoney)
  }

  function releaseExpired() {
    if (!campaign || !submission) return
    void runWrite('release', () => sponsorJudge.releaseExpiredReward(account, campaign.id, submission.creator),
      'Expired reward released back to the campaign pool.', reloadCampaignMoney)
  }

  async function getProof() {
    const wallet = (proofWallet || account).trim()

    if (!wallet) {
      return setNotice({
        kind: 'error',
        message: 'Connect or enter a creator wallet.',
      })
    }

    setBusy('proof')

    try {
      const address = normalizeAddress(wallet)
      setProofWallet(address)
      setProofMarker(
        clean(await sponsorJudge.getRequiredProofMarker(address)),
      )
    } catch (error) {
      setNotice({ kind: 'error', message: msg(error) })
    } finally {
      setBusy('')
    }
  }

  async function copyProof() {
    if (!proofMarker) return
    await navigator.clipboard.writeText(proofMarker)
    setNotice({ kind: 'success', message: 'Proof marker copied.' })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()

    if (!account) {
      return setNotice({ kind: 'error', message: 'Connect wallet first.' })
    }

    if (!campaign) return

    if (submitForm.description.trim().length < 20) {
      return setNotice({
        kind: 'error',
        message: 'Description must be at least 20 characters.',
      })
    }

    let evidence = ''

    try {
      evidence = validateEvidenceUrl(submitForm.evidence)
    } catch (error) {
      return setNotice({ kind: 'error', message: msg(error) })
    }

    setBusy('submit')

    try {
      const result = await sponsorJudge.submitContent(
        account,
        campaign.id,
        submitForm.description.trim(),
        evidence,
      )

      setLookupWallet(account)
      setNotice(writeNotice(result, 'Deliverable submitted. Status is SUBMITTED.'))

      await loadSubmission(account)
    } catch (error) {
      setNotice({ kind: 'error', message: msg(error) })
    } finally {
      setBusy('')
    }
  }

  async function loadSubmission(walletOverride?: string) {
    if (!campaign) return

    const wallet = (walletOverride ?? lookupWallet).trim()
    if (!wallet) return

    setBusy('lookup')

    try {
      const address = normalizeAddress(wallet)

      const [status, description, evidence, reason] = await Promise.all([
        sponsorJudge.getSubmissionStatus(campaign.id, address),
        sponsorJudge.getSubmissionDescription(campaign.id, address),
        sponsorJudge.getSubmissionEvidence(campaign.id, address),
        sponsorJudge.getSubmissionReason(campaign.id, address),
      ])

      if (!clean(status)) throw new Error('No deliverable found.')

      const attempts = REVISION_ENABLED
        ? await loadAttempts(sponsorJudge as AttemptReader, campaign.id, address)
        : []
      if (attempts.length && attempts[attempts.length - 1].status !== clean(status)) {
        throw new Error('The accepted reads changed during loading. Refresh this delivery.')
      }

      let attemptCanonicalUrls: string[] = []
      let unavailableRetries = 0
      let maxUnavailableRetries = 0
      if (REVISION_ENABLED) {
        const retryState = await Promise.all([
          Promise.all(
            attempts.map(async (attempt) =>
              clean(await sponsorJudge.normalizeEvidenceUrl(attempt.evidence)),
            ),
          ),
          sponsorJudge.getUnavailableRetries(campaign.id, address),
          sponsorJudge.getMaxUnavailableRetries(),
        ])
        attemptCanonicalUrls = retryState[0]
        unavailableRetries = Number(retryState[1])
        maxUnavailableRetries = Number(retryState[2])
      }

      if (TREASURY_ENABLED) {
        await Promise.all([refreshPayout(campaign.id, address), refreshTreasury(campaign.id)])
      }

      setLookupWallet(address)
      setSubmission({
        creator: address,
        status: clean(status),
        description: clean(description),
        evidence: clean(evidence),
        reason: clean(reason),
        attempts,
        attemptCanonicalUrls,
        unavailableRetries,
        maxUnavailableRetries,
      })
    } catch (error) {
      setNotice({ kind: 'error', message: msg(error) })
      setSubmission(null)
      setPayout(null)
    } finally {
      setBusy('')
    }
  }

  async function reviseRejected(event: React.FormEvent) {
    event.preventDefault()
    if (!REVISION_ENABLED || !campaign || !submission ||
      !['REJECTED', 'UNAVAILABLE'].includes(submission.status)) return
    if (!account || account.toLowerCase() !== submission.creator.toLowerCase()) {
      return setNotice({ kind: 'error', message: 'Connect the submitting creator wallet to revise.' })
    }
    if (revisionForm.description.trim().length < 20) {
      return setNotice({ kind: 'error', message: 'Revised description must be at least 20 characters.' })
    }

    setBusy('revise')
    try {
      const result = await sponsorJudge.reviseRejectedContent(
        account, campaign.id, revisionForm.description.trim(),
        validateEvidenceUrl(revisionForm.evidence),
      )
      await loadSubmission(account)
      setRevisionForm({ description: '', evidence: '' })
      setNotice(writeNotice(result, 'Revised attempt stored. Request a new verification.'))
    } catch (error) {
      setNotice({ kind: 'error', message: msg(error) })
    } finally {
      setBusy('')
    }
  }

  async function verifyDeliverable() {
    if (!account || !campaign || !submission) return

    setBusy('judge')
    setNotice({
      kind: 'info',
      message: 'Submitting delivery verification to GenLayer…',
    })

    try {
      const result = await sponsorJudge.judgeContent(
        account,
        campaign.id,
        submission.creator,
      )

      setNotice({
        kind: 'info',
        message:
          'AI validators are checking the deliverable against sponsor requirements…',
        tx: result.hash,
      })

      const verdict = await waitForReceipt(result.hash, 300_000, 6_000)
      if (verdict.kind === 'error') {
        setNotice({ kind: 'error', message: verdict.reason, tx: result.hash })
        return
      }
      if (verdict.kind === 'pending') {
        await pollSubmissionStatus(campaign.id, submission.creator, { timeoutMs: 60_000 })
      }
      await loadSubmission(submission.creator)

      setNotice({
        kind: verdict.kind === 'success' ? 'success' : 'info',
        message: verdict.kind === 'success'
          ? 'Delivery verification finished.'
          : 'Verification was submitted; consensus is still finalizing. Reload the delivery shortly.',
        tx: result.hash,
      })
    } catch (error) {
      setNotice({ kind: 'error', message: msg(error) })
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="identity" href="#">
          <span className="identity-mark">
            <BriefcaseBusiness size={20} />
          </span>
          <span>
            <strong>ProofSponsor</strong>
            <small>Creator sponsorship infrastructure</small>
          </span>
        </a>

        <div className="topbar-actions">
          <a className="contract-link review-nav-link" href="#/review">Public review <ArrowRight size={13} /></a>
          <a className="contract-link" href={explorer} target="_blank" rel="noreferrer">
            Contract <ExternalLink size={13} />
          </a>
          <WalletButton account={account} onConnect={connect} busy={walletBusy} />
        </div>
      </header>

      <main className="workspace-shell">
        <aside className="sidebar">
          <div className="sidebar-label">Workspace</div>

          <div className="side-item active">
            <LayoutDashboard size={17} />
            Sponsorship desk
          </div>

          <div className="side-item">
            <Megaphone size={17} />
            Sponsor campaigns
          </div>

          <div className="side-item">
            <UserRoundCheck size={17} />
            Creator deliveries
          </div>

          <div className="side-item">
            <FileCheck2 size={17} />
            Verification center
          </div>

          <div className="side-summary">
            <span>Current progress</span>
            <strong>{verificationProgress}%</strong>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${verificationProgress}%` }}
              />
            </div>
            <small>
              {submission?.status === 'APPROVED'
                ? 'Delivery verified'
                : submission?.status === 'REJECTED'
                  ? 'Delivery rejected'
                  : submission?.status === 'UNAVAILABLE'
                    ? 'Evidence temporarily unavailable'
                  : submission?.status === 'SUBMITTED'
                    ? 'Awaiting verification'
                    : campaign
                      ? 'Campaign loaded'
                      : 'No campaign selected'}
            </small>
          </div>
        </aside>

        <div className="content">
          <section className="dashboard-hero">
            <div>
              <span className="overline">
                <Sparkles size={14} /> GenLayer-powered sponsorship operations
              </span>
              <h1>
                From sponsor brief
                <br />
                to <em>verified delivery.</em>
              </h1>
              <p>
                Run sponsorships as verifiable workflows. Sponsors define the
                brief, creators prove ownership of their work, and GenLayer
                validators confirm whether delivery matches the deal.
              </p>
            </div>

            <div className="hero-metrics">
              <Metric
                icon={<Megaphone size={17} />}
                label="Campaign"
                value={campaign ? 'Loaded' : 'Not selected'}
              />
              <Metric
                icon={<UserRoundCheck size={17} />}
                label="Creator proof"
                value={proofMarker ? 'Ready' : 'Not generated'}
              />
              <Metric
                icon={<Gauge size={17} />}
                label="Delivery"
                value={submission?.status || 'Not submitted'}
              />
              {TREASURY_ENABLED && (
                <Metric
                  icon={<Coins size={17} />}
                  label="Reward pool"
                  value={treasury ? formatGen(treasury.poolWei) : '—'}
                />
              )}
            </div>
          </section>

          {notice && (
            <div className={`notice ${notice.kind}`}>
              {notice.kind === 'error' ? (
                <XCircle size={18} />
              ) : notice.kind === 'success' ? (
                <BadgeCheck size={18} />
              ) : (
                <LoaderCircle className="spin" size={18} />
              )}
              <span>{notice.message}</span>
              {notice.tx && (
                <a
                  href={`${EXPLORER_BASE}/tx/${notice.tx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}

          {CONFIG_ERROR && (
            <div className="notice error" role="alert">
              Contract version {CONTRACT_VERSION} needs its own deployed address. Deploy contracts/ProofSponsorV{CONTRACT_VERSION}.py, then set VITE_CONTRACT_ADDRESS.
            </div>
          )}

          <section className="dashboard-grid">
            <article className="surface sponsor-card">
              <div className="card-kicker">
                <Megaphone size={16} /> Sponsor console
              </div>
              <h2>Create a sponsorship brief</h2>
              <p className="card-copy">
                Define the exact public deliverable a creator must complete.
              </p>

              <form className="form-stack" onSubmit={create}>
                <Field label="Sponsorship ID">
                  <input
                    value={createForm.id}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, id: e.target.value })
                    }
                    placeholder="creator-campaign-01"
                  />
                </Field>

                <Field label="Title">
                  <input
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    placeholder="GenLayer sponsored article"
                  />
                </Field>

                <Field label="Sponsor brief">
                  <textarea
                    rows={6}
                    value={createForm.requirements}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        requirements: e.target.value,
                      })
                    }
                    placeholder="Creator must publish an original public article that..."
                  />
                </Field>

                {TREASURY_ENABLED && (
                  <Field label="Reward per approved delivery (GEN)">
                    <input
                      inputMode="decimal"
                      value={createForm.reward}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, reward: e.target.value })
                      }
                      placeholder="10"
                    />
                    <small>
                      Paid from the campaign pool when validators approve a delivery. Fund the pool after publishing; 0 means no reward.
                    </small>
                  </Field>
                )}

                <button className="action primary-action" disabled={busy === 'create'}>
                  {busy === 'create' ? (
                    <>
                      <LoaderCircle className="spin" size={17} /> Creating…
                    </>
                  ) : (
                    <>
                      Publish sponsorship <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            </article>

            <article className="surface campaign-browser">
              <div className="card-kicker">
                <Search size={16} /> Campaign browser
              </div>
              <h2>Open an existing sponsorship</h2>
              <p className="card-copy">
                Load the sponsor brief directly from onchain state.
              </p>

              <div className="search-line">
                <input
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  placeholder="Sponsorship ID"
                />
                <button
                  className="action secondary-action"
                  onClick={() => loadCampaign()}
                >
                  <Search size={16} /> Open
                </button>
              </div>

              {recent.length > 0 && (
                <div className="recent-list">
                  <span>Recent</span>
                  {recent.map((id) => (
                    <button key={id} onClick={() => loadCampaign(id)}>
                      {id}
                    </button>
                  ))}
                </div>
              )}

              {campaign ? (
                <div className="campaign-snapshot">
                  <div className="snapshot-head">
                    <div>
                      <span className="eyebrow">{campaign.id}</span>
                      <h3>{campaign.name}</h3>
                    </div>
                    <StatusPill status={campaign.active ? 'ACTIVE' : 'CLOSED'} />
                  </div>

                  <div className="brief-box">
                    <span>Sponsor brief</span>
                    <p>{campaign.requirements}</p>
                  </div>

                  <div className="sponsor-address">
                    Sponsor
                    <code>{campaign.creator}</code>
                  </div>

                  {TREASURY_ENABLED && treasury && (
                    <TreasuryPanel
                      treasury={treasury}
                      isSponsor={!!account && account.toLowerCase() === campaign.creator.toLowerCase()}
                      active={campaign.active}
                      busy={busy}
                      fundAmount={fundAmount}
                      setFundAmount={setFundAmount}
                      onFund={fund}
                      onToggle={toggleActive}
                      onReclaim={reclaim}
                    />
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <Globe2 size={24} />
                  <p>Open a sponsorship to activate the creator workspace.</p>
                </div>
              )}
            </article>
          </section>

          {campaign && (
            <section className="creator-zone">
              <div className="zone-heading">
                <div>
                  <span className="overline">
                    <UserRoundCheck size={14} /> Creator workspace
                  </span>
                  <h2>Prepare and submit the sponsored deliverable</h2>
                </div>
                <div className="deal-chip">
                  <span>{campaign.id}</span>
                  <StatusPill status={campaign.active ? 'ACTIVE' : 'CLOSED'} />
                </div>
              </div>

              <div className="creator-grid">
                <article className="surface proof-card">
                  <div className="step-chip">A</div>
                  <h3>Bind the deliverable to a wallet</h3>
                  <p>
                    Generate the exact ownership marker that must appear inside
                    the public sponsored content.
                  </p>

                  <Field label="Creator wallet">
                    <input
                      value={proofWallet}
                      onChange={(e) => setProofWallet(e.target.value)}
                      placeholder="0x creator wallet"
                    />
                  </Field>

                  <button
                    className="action secondary-action full-width"
                    onClick={getProof}
                  >
                    <ShieldCheck size={16} />
                    Generate ownership proof
                  </button>

                  {proofMarker && (
                    <div className="proof-output">
                      <span>Public marker</span>
                      <code>{proofMarker}</code>
                      <button onClick={copyProof}>
                        <Clipboard size={15} /> Copy marker
                      </button>
                    </div>
                  )}
                </article>

                <article className="surface delivery-card">
                  <div className="step-chip">B</div>
                  <h3>Submit completed work</h3>
                  <p>
                    Attach the public deliverable once the ownership marker is
                    visible in the content.
                  </p>

                  <form className="form-stack" onSubmit={submit}>
                    <Field label="Delivery note">
                      <textarea
                        rows={4}
                        value={submitForm.description}
                        onChange={(e) =>
                          setSubmitForm({
                            ...submitForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="I completed the sponsored article and published it publicly..."
                      />
                    </Field>

                    <Field label="Public deliverable URL">
                      <input
                        value={submitForm.evidence}
                        onChange={(e) =>
                          setSubmitForm({
                            ...submitForm,
                            evidence: e.target.value,
                          })
                        }
                        placeholder="https://..."
                      />
                      <small>
                        Use a public HTTPS page that GenLayer validators can render.
                      </small>
                      {submitCanonical && (
                        <div className={`canonical-preview ${submitDuplicate ? 'duplicate' : ''}`}>
                          Recorded as: <strong>{submitCanonical}</strong>
                          {submitDuplicate && ' · This canonical URL already exists in the attempt history.'}
                        </div>
                      )}
                    </Field>

                    <button
                      className="action primary-action"
                      disabled={busy === 'submit'}
                    >
                      {busy === 'submit' ? (
                        <>
                          <LoaderCircle className="spin" size={17} />
                          Submitting…
                        </>
                      ) : (
                        <>
                          Submit deliverable <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  </form>
                </article>
              </div>
            </section>
          )}

          {campaign && (
            <section className="verification-zone">
              <div className="zone-heading">
                <div>
                  <span className="overline">
                    <FileCheck2 size={14} /> Verification center
                  </span>
                  <h2>Check whether the sponsorship was fulfilled</h2>
                </div>
              </div>

              <article className="verification-board surface">
                <div className="verification-search">
                  <div>
                    <span>Creator wallet</span>
                    <p>Load the creator's submitted work for this sponsorship.</p>
                  </div>
                  <div className="search-line">
                    <input
                      value={lookupWallet}
                      onChange={(e) => setLookupWallet(e.target.value)}
                      placeholder="0x creator wallet"
                    />
                    <button
                      className="action secondary-action"
                      onClick={() => loadSubmission()}
                    >
                      <Search size={16} /> Load delivery
                    </button>
                  </div>
                </div>

                {!submission ? (
                  <div className="delivery-empty">
                    <Link2 size={26} />
                    <h3>No delivery loaded</h3>
                    <p>
                      Enter a creator wallet above to inspect the submitted work.
                    </p>
                  </div>
                ) : (
                  <div className="delivery-review">
                    <div className="review-header">
                      <div>
                        <span className="eyebrow">Current delivery</span>
                        <h3>{submission.creator}</h3>
                      </div>
                      <StatusPill status={submission.status} />
                    </div>

                    <a className="review-entry" href={reviewPath(campaign.id, submission.creator)}>
                      Open public case review <ArrowRight size={15} />
                    </a>

                    <div className="review-columns">
                      <ReviewBlock
                        title="Creator delivery note"
                        body={submission.description}
                      />

                      <div className="review-block">
                        <span>Public deliverable</span>
                        <a
                          href={submission.evidence}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {submission.evidence} <ExternalLink size={13} />
                        </a>
                      </div>
                    </div>

                    <div className="requirements-check">
                      <div className="check-icon">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <span>What validators compare against</span>
                        <p>{campaign.requirements}</p>
                      </div>
                    </div>

                    {submission.reason && (
                      <div
                        className={`result-banner ${
                          submission.status === 'APPROVED'
                            ? 'approved'
                            : submission.status === 'UNAVAILABLE'
                              ? 'unavailable'
                              : 'rejected'
                        }`}
                      >
                        {submission.status === 'APPROVED' ? (
                          <BadgeCheck size={21} />
                        ) : submission.status === 'UNAVAILABLE' ? (
                          <Globe2 size={21} />
                        ) : (
                          <XCircle size={21} />
                        )}
                        <div>
                          <strong>
                            {submission.status === 'APPROVED'
                              ? 'Delivery verified'
                              : submission.status === 'UNAVAILABLE'
                                ? 'Evidence temporarily unavailable'
                                : 'Delivery not verified'}
                          </strong>
                          <p>{submission.reason}</p>
                        </div>
                      </div>
                    )}

                    {TREASURY_ENABLED && (
                      <PayoutBox
                        payout={payout}
                        treasury={treasury}
                        isCreator={!!account && account.toLowerCase() === submission.creator.toLowerCase()}
                        busy={busy}
                        onWithdraw={withdraw}
                        onRelease={releaseExpired}
                        onReserve={reserveNow}
                      />
                    )}

                    {['SUBMITTED', 'UNAVAILABLE'].includes(submission.status) && (
                      <>
                        <button
                          className="verify-button"
                          onClick={verifyDeliverable}
                          disabled={busy === 'judge'}
                        >
                          {busy === 'judge' ? (
                            <>
                              <LoaderCircle className="spin" size={18} />
                              GenLayer is verifying…
                            </>
                          ) : (
                            <>
                              <FileCheck2 size={18} />
                              {submission.status === 'UNAVAILABLE'
                                ? 'Verify again'
                                : 'Verify delivery with GenLayer'}
                            </>
                          )}
                        </button>
                        {submission.status === 'UNAVAILABLE' && (
                          <p className="retry-copy">
                            Attempt {submission.attempts.length} of 3 preserved · retrieval retries{' '}
                            {submission.unavailableRetries} of {submission.maxUnavailableRetries}
                          </p>
                        )}
                      </>
                    )}

                    {REVISION_ENABLED && (
                      <div className="attempt-history">
                        <h4>Onchain attempt history ({submission.attempts.length}/3)</h4>
                        <ol className="attempt-list">
                          {submission.attempts.map((attempt) => (
                            <li key={attempt.number}>
                              <div className="attempt-head"><strong>Attempt {attempt.number}</strong><StatusPill status={attempt.status} /></div>
                              <p>{attempt.description}</p>
                              {safeEvidenceUrl(attempt.evidence) ? (
                                <a href={safeEvidenceUrl(attempt.evidence)!} target="_blank" rel="noopener noreferrer">
                                  {attempt.evidence} <ExternalLink size={12} />
                                </a>
                              ) : <code>{attempt.evidence}</code>}
                              {attempt.reason && (
                                <p>
                                  {attempt.status === 'UNAVAILABLE' ? 'Retrieval: ' : 'Reason: '}
                                  {attempt.reason}
                                </p>
                              )}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {REVISION_ENABLED && ['REJECTED', 'UNAVAILABLE'].includes(submission.status) && (
                      <div className="revision-panel">
                        <h4>
                          {submission.status === 'UNAVAILABLE'
                            ? 'Use different evidence'
                            : 'Revise rejected delivery'}
                        </h4>
                        <p>Only the original creator may submit a new public URL. Previous attempts stay onchain.</p>
                        {submission.attempts.length >= 3 ? (
                          <p>The three-attempt limit has been reached.</p>
                        ) : !campaign.active ? (
                          <p>This campaign is closed. Its sponsor must reopen it before a revision.</p>
                        ) : account.toLowerCase() !== submission.creator.toLowerCase() ? (
                          <p>Connect the original creator wallet to revise this delivery.</p>
                        ) : (
                          <form className="form-stack" onSubmit={reviseRejected}>
                            <Field label="Revised delivery note">
                              <textarea rows={3} value={revisionForm.description} onChange={(event) => setRevisionForm({ ...revisionForm, description: event.target.value })} required />
                            </Field>
                            <Field label="New public evidence URL">
                              <input value={revisionForm.evidence} onChange={(event) => setRevisionForm({ ...revisionForm, evidence: event.target.value })} placeholder="https://..." required />
                              {revisionCanonical && (
                                <div className={`canonical-preview ${revisionDuplicate ? 'duplicate' : ''}`}>
                                  Recorded as: <strong>{revisionCanonical}</strong>
                                  {revisionDuplicate && ' · This canonical URL already exists in the attempt history.'}
                                </div>
                              )}
                            </Field>
                            <button className="action primary-action" disabled={busy === 'revise'}>
                              {busy === 'revise' ? 'Storing revision…' : 'Submit revised attempt'}
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </article>
            </section>
          )}

          <section className="principles">
            <div>
              <span className="overline">
                <ShieldCheck size={14} /> Why ProofSponsor
              </span>
              <h2>Built for sponsorship operations, not generic judging.</h2>
              <p>
                ProofSponsor turns a sponsor brief into a verifiable delivery
                workflow: creator attribution, public evidence, semantic
                requirement checking, and an onchain result.
              </p>
            </div>

            <div className="principle-grid">
              <Principle
                title="Sponsor brief"
                body="Human-readable obligations define what must actually be delivered."
              />
              <Principle
                title="Wallet-bound proof"
                body="Public creator work is tied to the submitting wallet."
              />
              <Principle
                title="Delivery verification"
                body="Validators compare meaning and substance, not only keywords."
              />
              <Principle
                title="Paid on the verdict"
                body="An approved delivery reserves its reward from the sponsor's pool; the creator withdraws it within 30 days."
              />
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">
        <div>
          <strong>ProofSponsor</strong>
          <span>AI-verified sponsorship fulfillment on GenLayer.</span>
        </div>
        <a href={explorer} target="_blank" rel="noreferrer">
          {CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-6)}
          <ExternalLink size={12} />
        </a>
      </footer>
    </div>
  )
}

function writeNotice(result: WriteResult, success: string): Notice {
  return result.verdict.kind === 'success'
    ? { kind: 'success', message: success, tx: result.hash }
    : {
        kind: 'info',
        message: 'Submitted — confirmation is delayed. Check the transaction, then reload before trying again.',
        tx: result.hash,
      }
}

function TreasuryPanel({
  treasury,
  isSponsor,
  active,
  busy,
  fundAmount,
  setFundAmount,
  onFund,
  onToggle,
  onReclaim,
}: {
  treasury: Treasury
  isSponsor: boolean
  active: boolean
  busy: string
  fundAmount: string
  setFundAmount: (value: string) => void
  onFund: (event: React.FormEvent) => void
  onToggle: () => void
  onReclaim: () => void
}) {
  const blocker = reclaimBlocker(treasury, isSponsor)
  return (
    <div className="treasury">
      <div className="treasury-head">
        <span><PiggyBank size={15} /> Reward treasury</span>
        <strong>{formatGen(treasury.rewardWei)} per approved delivery</strong>
      </div>
      <dl className="treasury-grid">
        <div><dt>Pool</dt><dd>{formatGen(treasury.poolWei)}</dd></div>
        <div><dt>Reserved for creators</dt><dd>{formatGen(treasury.reservedWei)}</dd></div>
        <div><dt>Available</dt><dd>{formatGen(treasury.availableWei)}</dd></div>
      </dl>
      <p className="treasury-note">
        {treasury.openSubmissions} awaiting a verdict · {treasury.waitingForFunds} approved and waiting for funds
      </p>

      {isSponsor && (
        <div className="sponsor-actions">
          <form className="search-line" onSubmit={onFund}>
            <input
              inputMode="decimal"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              placeholder="Amount in GEN"
            />
            <button className="action secondary-action" disabled={busy === 'fund'}>
              {busy === 'fund' ? <LoaderCircle className="spin" size={16} /> : <Coins size={16} />} Fund pool
            </button>
          </form>
          <div className="sponsor-buttons">
            <button className="action secondary-action" onClick={onToggle} disabled={busy === 'active'}>
              {active ? <Lock size={16} /> : <LockOpen size={16} />}
              {active ? 'Close campaign' : 'Reopen campaign'}
            </button>
            <button
              className="action secondary-action"
              onClick={onReclaim}
              disabled={!!blocker || busy === 'reclaim'}
              title={blocker ?? undefined}
            >
              <RotateCcw size={16} /> Reclaim {blocker ? '' : formatGen(treasury.availableWei)}
            </button>
          </div>
          {blocker && <small className="treasury-note">Reclaim: {blocker}</small>}
        </div>
      )}
    </div>
  )
}

function PayoutBox({
  payout,
  treasury,
  isCreator,
  busy,
  onWithdraw,
  onRelease,
  onReserve,
}: {
  payout: Payout | null
  treasury: Treasury | null
  isCreator: boolean
  busy: string
  onWithdraw: () => void
  onRelease: () => void
  onReserve: () => void
}) {
  const view = payoutView(payout, treasury, isCreator)
  if (!view) return null
  return (
    <div className={`payout-box ${view.tone}`}>
      <div className="payout-head">
        {view.tone === 'warn' ? <Clock3 size={20} /> : <HandCoins size={20} />}
        <div>
          <strong>{view.label}</strong>
          <p>{view.detail}</p>
        </div>
      </div>
      {(view.canWithdraw || view.canRelease || view.canReserve) && (
        <div className="payout-actions">
          {view.canWithdraw && (
            <button className="action primary-action" onClick={onWithdraw} disabled={busy === 'withdraw'}>
              {busy === 'withdraw' ? <LoaderCircle className="spin" size={16} /> : <HandCoins size={16} />} Withdraw reward
            </button>
          )}
          {view.canReserve && (
            <button className="action secondary-action" onClick={onReserve} disabled={busy === 'reserve'}>
              <Coins size={16} /> Reserve reward now
            </button>
          )}
          {view.canRelease && (
            <button className="action secondary-action" onClick={onRelease} disabled={busy === 'release'}>
              <RotateCcw size={16} /> Release expired reward
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function ReviewBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="review-block">
      <span>{title}</span>
      <p>{body}</p>
    </div>
  )
}

function Principle({ title, body }: { title: string; body: string }) {
  return (
    <div className="principle-card">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  )
}

function msg(error: unknown) {
  return error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'Something went wrong while interacting with GenLayer.'
}
