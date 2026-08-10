import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clipboard,
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
import { CONTRACT_ADDRESS, EXPLORER_BASE } from './lib/config'
import {
  connectWallet,
  normalizeAddress,
  pollSubmissionStatus,
  sponsorJudge,
  validateEvidenceUrl,
} from './lib/genlayer'
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
}

type Notice = {
  kind: 'success' | 'error' | 'info'
  message: string
  tx?: string
} | null

const clean = (value: unknown) => String(value ?? '').replace(/^"|"$/g, '')

export default function App() {
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
  })

  const [proofWallet, setProofWallet] = useState('')
  const [proofMarker, setProofMarker] = useState('')

  const [submitForm, setSubmitForm] = useState({
    description: '',
    evidence: '',
  })

  const [lookupWallet, setLookupWallet] = useState('')
  const [submission, setSubmission] = useState<Submission | null>(null)

  useEffect(() => setRecent(getRecentCampaigns()), [])

  const explorer = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`

  const verificationProgress = useMemo(() => {
    if (!campaign) return 0
    if (!submission) return 25
    if (submission.status === 'SUBMITTED') return 70
    if (submission.status === 'APPROVED' || submission.status === 'REJECTED') return 100
    return 45
  }, [campaign, submission])

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

    setBusy('create')

    try {
      const result = await sponsorJudge.createCampaign(
        account,
        createForm.id.trim(),
        createForm.name.trim(),
        createForm.requirements.trim(),
      )

      setCampaignId(createForm.id.trim())
      setRecent(rememberCampaign(createForm.id.trim()))
      setNotice({
        kind: 'success',
        message: 'Sponsorship created and finalized.',
        tx: result.hash,
      })

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
    } catch (error) {
      setNotice({ kind: 'error', message: msg(error) })
    } finally {
      setBusy('')
    }
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
      setNotice({
        kind: 'success',
        message: 'Deliverable submitted. Status is SUBMITTED.',
        tx: result.hash,
      })

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

      setLookupWallet(address)
      setSubmission({
        creator: address,
        status: clean(status),
        description: clean(description),
        evidence: clean(evidence),
        reason: clean(reason),
      })
    } catch (error) {
      setNotice({ kind: 'error', message: msg(error) })
      setSubmission(null)
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

      await pollSubmissionStatus(campaign.id, submission.creator)
      await loadSubmission(submission.creator)

      setNotice({
        kind: 'success',
        message: 'Delivery verification finished.',
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
                            : 'rejected'
                        }`}
                      >
                        {submission.status === 'APPROVED' ? (
                          <BadgeCheck size={21} />
                        ) : (
                          <XCircle size={21} />
                        )}
                        <div>
                          <strong>
                            {submission.status === 'APPROVED'
                              ? 'Delivery verified'
                              : 'Delivery not verified'}
                          </strong>
                          <p>{submission.reason}</p>
                        </div>
                      </div>
                    )}

                    {submission.status === 'SUBMITTED' && (
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
                            Verify delivery with GenLayer
                          </>
                        )}
                      </button>
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
                title="Reusable onchain result"
                body="Verified outcomes can power rewards, escrow or reputation."
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
