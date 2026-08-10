# ProofSponsor

**Decentralized sponsorship proof-of-performance on GenLayer.**

ProofSponsor is a full dApp for sponsors and creators. Sponsors define qualitative campaign requirements in natural language. Creators publish public content, prove wallet attribution with a contract-generated marker, and submit the evidence URL. GenLayer AI validators then adjudicate whether the deliverable truly fulfilled the campaign.

## Public sponsorship deliverable — Test 02

### GenLayer Intelligent Contracts and Decentralized AI Validation

GenLayer Intelligent Contracts allow applications to evaluate qualitative and non-deterministic information that traditional deterministic smart contracts cannot reliably resolve.

Instead of relying on a single AI model, GenLayer uses decentralized AI-validator consensus. Validators can evaluate public evidence and determine whether predefined qualitative requirements have actually been satisfied.

For sponsorship verification, a sponsor defines the required deliverable, the creator publishes the work publicly, and GenLayer validators inspect the evidence to determine whether the creator meaningfully fulfilled the sponsorship brief.

This enables ProofSponsor to verify real-world qualitative requirements rather than relying only on deterministic checks or trusting a creator's claim.

### Creator ownership proof

SPONSORJUDGE_PROOF:0x146e44881d35814ba582d265af5b97ef2695ec8e

This wallet-specific marker associates this public deliverable with the creator submitting the evidence.
## Product flow

```text
Sponsor creates campaign
        ↓
Creator gets proof marker
        ↓
Creator publishes content + marker
        ↓
Creator submits public evidence
        ↓
GenLayer AI validators
        ↓
APPROVED / REJECTED
```

## Live contract

`0x3Aa42FdD6EC0299c4172aaB47C4f0586625736bC`

Network: GenLayer Studionet

A positive onchain test has already produced `APPROVED`.

## Why GenLayer

ProofSponsor uses SponsorJudge to resolve a subjective question: **did this creator meaningfully fulfill the sponsorship requirements?** Deterministic contracts can check balances, timestamps, or exact strings, but cannot reliably judge the semantic quality and fulfillment of an unstructured public deliverable. GenLayer provides decentralized AI-validator consensus for that judgment.

## Security design

- Wallet-specific creator attribution marker: `SPONSORJUDGE_PROOF:<wallet>`
- Approved evidence is claimed per campaign to prevent replay
- Inaccessible/empty evidence fails closed to `REJECTED`
- Validators evaluate semantic fulfillment, not keyword presence alone
- Closed campaigns cannot accept or adjudicate new submissions

## Tech stack

- Vite
- React
- TypeScript
- genlayer-js
- viem
- GenLayer Studionet
- Vercel

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Vercel

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

The frontend uses separate read/write GenLayer clients and waits for `FINALIZED` before automatically re-reading state. If RPC receipt monitoring drops after a transaction hash is already returned, the UI treats that as a monitoring issue rather than assuming the contract transaction failed.

## Repository structure

```text
ProofSponsor/
├── contracts/
│   └── sponsor_judge.py
├── src/
│   ├── components/
│   ├── lib/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── .env.example
├── package.json
├── vercel.json
└── README.md
```

This repository is the **full Project/dApp**. The reusable Sponsored Content Fulfillment Verifier contract can be submitted separately under the Intelligent Contract category.


## Frontend Reliability

ProofSponsor reads GenLayer `accepted` state to avoid stale UI after accepted writes. AI adjudication is submitted asynchronously: after a transaction hash is returned, the UI polls the submission status with backoff until it becomes `APPROVED` or `REJECTED`. Transient RPC/rate-limit errors during polling do not immediately abort the adjudication flow.

The UI also rejects evidence URL forms known to be unreliable for GenLayer rendering, including GitHub `/blob/` links and `raw.githubusercontent.com`, and recommends a public repository homepage or another renderable public webpage.


## Frontend reliability

Reads use accepted state. AI adjudication is asynchronous and polled with backoff so transient RPC/rate-limit errors do not automatically mark a submitted adjudication as failed.
