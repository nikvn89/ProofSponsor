import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Clipboard, Download, ExternalLink, LoaderCircle, Search } from 'lucide-react'
import StatusPill from './components/StatusPill'
import { CONTRACT_ADDRESS, EXPLORER_BASE, REVISION_ENABLED, V2_CONFIG_ERROR } from './lib/config'
import { sponsorJudge } from './lib/genlayer'
import {
  loadReview,
  normalizeCreator,
  parseReviewHash,
  reviewPath,
  safeEvidenceUrl,
} from './lib/review'
import type { DeliveryReview } from './lib/review'

export default function ReviewDossier() {
  const route = parseReviewHash(window.location.hash)
  const [campaignId, setCampaignId] = useState(route?.campaignId ?? '')
  const [creator, setCreator] = useState(route?.creator ?? '')
  const [review, setReview] = useState<DeliveryReview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  async function openReview(id: string, wallet: string) {
    setLoading(true)
    setReview(null)
    setError('')
    setFeedback('')
    try {
      setReview(await loadReview(sponsorJudge, id, wallet, CONTRACT_ADDRESS, new Date(), REVISION_ENABLED))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read accepted contract state.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (route?.campaignId && route.creator) {
      void openReview(route.campaignId, route.creator)
    }
  }, [])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const path = reviewPath(campaignId, normalizeCreator(creator))
      if (window.location.hash === path) void openReview(campaignId, creator)
      else window.location.hash = path
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid case.')
    }
  }

  async function copyLink() {
    if (!review) return
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${window.location.pathname}${reviewPath(review.campaign.id, review.creator)}`,
      )
      setFeedback('Review link copied.')
    } catch {
      setFeedback('Could not copy automatically; use the page URL in your address bar.')
    }
  }

  function downloadSnapshot() {
    if (!review) return
    const blob = new Blob([`${JSON.stringify(review, null, 2)}\n`], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const name = review.campaign.id.replace(/[^a-z0-9_-]/gi, '-').slice(0, 48)
    link.href = url
    link.download = `proofsponsor-${name}-${review.creator.slice(0, 10)}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setFeedback('JSON snapshot downloaded. Reopen the link to refresh accepted state.')
  }

  const evidenceLink = review && safeEvidenceUrl(review.submission.evidence)

  return (
    <div className="app">
      <header className="topbar review-topbar">
        <a className="identity" href="#">
          <span className="identity-mark"><Search size={20} /></span>
          <span><strong>ProofSponsor</strong><small>Public delivery review</small></span>
        </a>
        <div className="topbar-actions">
          <a className="contract-link" href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer">
            Contract <ExternalLink size={13} />
          </a>
          <a className="action secondary-action" href="#"><ArrowLeft size={16} /> Sponsorship desk</a>
        </div>
      </header>

      <main className="review-shell">
        <div className="review-intro">
          <span className="overline">Accepted onchain state / read-only</span>
          <h1>Delivery dossier</h1>
          <p>Inspect one campaign and creator without connecting a wallet. Each visit reads the current accepted contract state.</p>
        </div>

        <form className="surface review-lookup" onSubmit={submit}>
          <label className="field"><span>Sponsorship ID</span>
            <input value={campaignId} onChange={(event) => setCampaignId(event.target.value)} placeholder="creator-campaign-01" required />
          </label>
          <label className="field"><span>Creator wallet</span>
            <input value={creator} onChange={(event) => setCreator(event.target.value)} placeholder="0x..." required spellCheck={false} />
          </label>
          <button className="action primary-action" disabled={loading}>
            {loading ? <><LoaderCircle className="spin" size={16} /> Reading…</> : <><Search size={16} /> Open case</>}
          </button>
        </form>

        {V2_CONFIG_ERROR && <p className="review-error" role="alert">V2 requires its newly deployed contract address. This page is reading the original V1 contract.</p>}

        {error && <p className="review-error" role="alert">{error}</p>}
        {feedback && <p className="review-feedback" role="status">{feedback}</p>}
        {!review && !loading && !error && <p className="review-empty">Enter a sponsorship ID and creator wallet to load a case.</p>}

        {review && <>
          <div className="review-actions">
            <div className="review-case-title">
              <span className="eyebrow">{review.campaign.id} / {review.creator}</span>
              <h2>{review.campaign.name}</h2>
            </div>
            <StatusPill status={review.submission.status} />
            <button className="action secondary-action" onClick={copyLink} title="Copy shareable review link"><Clipboard size={16} /> Copy link</button>
            <button className="action secondary-action" onClick={downloadSnapshot} title="Download current read-only JSON snapshot"><Download size={16} /> Export JSON</button>
          </div>

          <p className="review-readtime">Accepted-state reads retrieved at {review.source.retrievedAtUtc}. Reads are separate, not an atomic block snapshot.</p>
          {review.inconsistent && <p className="review-error" role="alert">The verdict and evidence claim do not agree in these reads. Refresh and inspect the contract before relying on this case.</p>}

          <div className="review-details">
            <section className="review-section">
              <span className="overline">01 / Sponsor brief</span>
              <h3>{review.campaign.name}</h3>
              <p className="review-body">{review.campaign.requirements}</p>
              <dl className="review-facts">
                <div><dt>Sponsor wallet</dt><dd><code>{review.campaign.sponsor}</code></dd></div>
                <div><dt>Campaign</dt><dd>{review.campaign.active ? 'ACTIVE' : 'CLOSED'}</dd></div>
              </dl>
            </section>

            <section className="review-section">
              <span className="overline">02 / Creator submission</span>
              <h3><StatusPill status={review.submission.status} /> Contract verdict</h3>
              <p className="review-body">{review.submission.description}</p>
              <dl className="review-facts">
                <div><dt>Evidence URL</dt><dd>{evidenceLink ? <a href={evidenceLink} target="_blank" rel="noopener noreferrer">{review.submission.evidence} <ExternalLink size={13} /></a> : <code>{review.submission.evidence} (not a safe HTTPS link)</code>}</dd></div>
                <div><dt>Reason</dt><dd>{review.submission.reason || 'No reason stored yet.'}</dd></div>
              </dl>
            </section>

            <section className="review-section">
              <span className="overline">03 / Evidence claim</span>
              <h3>{review.claim.claimed ? 'Claimed in this campaign' : 'Not claimed in this campaign'}</h3>
              <dl className="review-facts">
                <div><dt>Claimed by</dt><dd><code>{review.claim.claimedBy || 'No wallet recorded'}</code></dd></div>
                <div><dt>Matches creator</dt><dd>{review.claim.matchesCreator ? 'YES' : 'NO'}</dd></div>
                <div><dt>Required marker</dt><dd><code>{review.proofMarker}</code></dd></div>
              </dl>
            </section>

            {REVISION_ENABLED && <section className="review-section">
              <span className="overline">04 / Revision history</span>
              <h3>{review.attempts.length} of 3 attempts</h3>
              <ol className="attempt-list">
                {review.attempts.map((attempt) => <li key={attempt.number}>
                  <div className="attempt-head"><strong>Attempt {attempt.number}</strong><StatusPill status={attempt.status} /></div>
                  <p>{attempt.description}</p>
                  {safeEvidenceUrl(attempt.evidence) ?
                    <a href={safeEvidenceUrl(attempt.evidence)!} target="_blank" rel="noopener noreferrer">{attempt.evidence} <ExternalLink size={12} /></a> :
                    <code>{attempt.evidence}</code>}
                  {attempt.reason && <p>Reason: {attempt.reason}</p>}
                </li>)}
              </ol>
            </section>}

            <section className="review-section review-boundary">
              <span className="overline">{REVISION_ENABLED ? '05' : '04'} / Review boundary</span>
              <h3>What this record does not prove</h3>
              <ul>{review.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>
              <a href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer">Inspect deployed contract <ExternalLink size={13} /></a>
            </section>
          </div>
        </>}
      </main>
    </div>
  )
}
