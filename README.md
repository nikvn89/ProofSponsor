# ProofSponsor

**Decentralized sponsorship proof-of-performance on GenLayer.**

ProofSponsor is a full GenLayer dApp for sponsors and creators.

Sponsors define qualitative campaign requirements in natural language. Creators publish their work publicly, prove wallet attribution using a contract-generated ownership marker, and submit the public evidence URL.

GenLayer AI validators then adjudicate whether the submitted deliverable meaningfully fulfilled the sponsorship requirements.

## Live Demo

https://proof-sponsor.vercel.app

## Live Contract

**GenLayer Studionet**

```text
0x3Aa42FdD6EC0299c4172aaB47C4f0586625736bC
```

## The Problem

Sponsorship agreements often contain qualitative requirements that deterministic smart contracts cannot evaluate.

For example:

> "Publish a meaningful educational article explaining how GenLayer Intelligent Contracts use decentralized AI-validator consensus."

A traditional smart contract can verify an address, payment, timestamp, or exact string, but it cannot reliably determine whether an article actually explains the requested topic or meaningfully satisfies the sponsor's brief.

ProofSponsor turns this subjective fulfillment decision into an onchain adjudication workflow.

## How It Works

```text
Sponsor creates campaign
        ↓
Campaign requirements stored onchain
        ↓
Creator requests wallet-specific proof marker
        ↓
Creator publishes content + ownership marker
        ↓
Creator submits public evidence URL
        ↓
GenLayer AI validators inspect the evidence
        ↓
Decentralized adjudication
        ↓
APPROVED / REJECTED
        ↓
Result stored onchain
```

## Why GenLayer

ProofSponsor uses GenLayer to resolve the core subjective question:

**Did this creator meaningfully fulfill the sponsorship requirements?**

Deterministic contracts cannot reliably answer this from unstructured public content.

GenLayer Intelligent Contracts allow validators to inspect public evidence and use decentralized AI consensus to determine whether the deliverable semantically satisfies the sponsor's requirements.

This makes the adjudication result usable by other onchain systems such as:

- sponsorship payouts
- escrow release
- creator reputation
- campaign completion records
- automated reward systems

## Creator Ownership Proof

ProofSponsor generates a wallet-specific marker:

```text
SPONSORJUDGE_PROOF:<creator-wallet>
```

Example from the public test:

```text
SPONSORJUDGE_PROOF:0x146e44881d35814ba582d265af5b97ef2695ec8e
```

The creator places this marker inside the public deliverable.

Validators can therefore verify both:

1. whether the content satisfies the sponsorship brief
2. whether the public evidence is associated with the wallet submitting it

## Public Adjudication Test

The deployed contract has been tested end-to-end on GenLayer Studionet.

### APPROVED case

A creator submitted a public article that:

- explained GenLayer Intelligent Contracts
- discussed decentralized AI-validator consensus
- contained meaningful educational information
- included the required wallet ownership marker

GenLayer adjudication returned:

```text
APPROVED
```

The frontend subsequently loaded the accepted onchain result and displayed:

```text
Delivery verified
```

### REJECTED case

A separate submission was intentionally tested with evidence that did not satisfy the campaign requirements.

GenLayer adjudication returned:

```text
REJECTED
```

The frontend correctly displayed the failed verification result.

These tests demonstrate that ProofSponsor does not simply approve submitted URLs or rely on deterministic keyword matching.

## Example Sponsorship Requirement

```text
Creator must publish a meaningful public article explaining how
GenLayer Intelligent Contracts use decentralized AI validator consensus.

The article must contain the required SponsorJudge ownership proof
marker and provide meaningful educational information about GenLayer.
```

The validators compare the public deliverable against this requirement and determine semantic fulfillment.

## Security Design

- Wallet-specific creator attribution marker: `SPONSORJUDGE_PROOF:<wallet>`
- Public evidence must be associated with the submitting creator
- Approved evidence is claimed per campaign to reduce replay
- Inaccessible or empty evidence fails closed to `REJECTED`
- Validators evaluate semantic fulfillment rather than keyword presence alone
- Closed campaigns cannot accept or adjudicate new submissions
- Adjudication results are persisted onchain

## Frontend Reliability

ProofSponsor reads GenLayer `accepted` state when loading contract data.

Normal state-changing transactions wait for `TransactionStatus.ACCEPTED` before the frontend re-reads state.

AI adjudication is handled asynchronously.

After `judge_content` returns a transaction hash, the frontend polls the submission status with backoff until the contract reports:

```text
APPROVED
```

or:

```text
REJECTED
```

Transient RPC or rate-limit errors during polling do not automatically mark an adjudication as failed.

The frontend also rejects evidence URL forms known to be unreliable for validator rendering, including:

```text
raw.githubusercontent.com
GitHub /blob/ URLs
```

Creators are instead instructed to provide a publicly accessible HTTPS webpage that validators can render.

## Tech Stack

- GenLayer Intelligent Contracts
- GenLayer Studionet
- genlayer-js
- viem
- React
- TypeScript
- Vite
- Vercel

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

## Production Build

```bash
npm run build
```

## Environment

Create a local `.env` file based on `.env.example`.

```text
VITE_CONTRACT_ADDRESS=0x3Aa42FdD6EC0299c4172aaB47C4f0586625736bC
```

Do not commit `.env` or `.env.local`.

## Vercel Deployment

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
```

Set the following Vercel environment variable:

```text
VITE_CONTRACT_ADDRESS=0x3Aa42FdD6EC0299c4172aaB47C4f0586625736bC
```

## Repository Structure

```text
ProofSponsor/
├── contracts/
│   └── ProofSponsor.py
├── src/
│   ├── components/
│   ├── lib/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── .env.example
├── .gitignore
├── LICENSE
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json
├── vite.config.ts
└── README.md
```

## Project Scope

This repository contains the complete **ProofSponsor Project/dApp**, including:

- GenLayer Intelligent Contract
- sponsor campaign creation
- creator ownership proof
- public evidence submission
- decentralized AI adjudication
- onchain verification state
- React frontend
- GenLayer wallet integration

The underlying sponsorship fulfillment logic can also serve as a reusable primitive for applications that need decentralized verification of qualitative real-world deliverables.

## License

MIT
