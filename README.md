# ProofSponsor

**Decentralized sponsorship proof-of-performance on GenLayer.**

ProofSponsor is a full GenLayer dApp for sponsors and creators.

Sponsors define qualitative campaign requirements in natural language. Creators publish their work publicly, prove wallet attribution using a contract-generated ownership marker, and submit the public evidence URL.

GenLayer AI validators then adjudicate whether the submitted deliverable meaningfully fulfilled the sponsorship requirements.

## Live Demo

https://proof-sponsor.vercel.app

> **Note:** MetaMask may display a phishing warning for new `vercel.app` subdomains. This is a known false positive for recently deployed dApps on shared hosting. Click **"Vẫn kết nối"** / **"Proceed anyway"** to continue. An appeal has been filed with MetaMask's [eth-phishing-detect](https://github.com/MetaMask/eth-phishing-detect/issues).

## Source Code

https://github.com/YOUR_USERNAME/ProofSponsor

## Live Contract

**GenLayer Studionet**

```text
0x3Aa42FdD6EC0299c4172aaB47C4f0586625736bC
```

> The contract class is named `SponsorJudge` internally. This reflects the original adjudication engine name. The project and dApp are branded **ProofSponsor**.

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
Decentralized adjudication (run_nondet_unsafe)
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

The adjudication uses `gl.vm.run_nondet_unsafe` with a leader-validator pattern:

- **Leader** fetches the public evidence, verifies the wallet attribution marker, and prompts the AI to evaluate semantic fulfillment against the campaign requirements.
- **Validators** independently repeat the same evaluation and confirm agreement with the leader verdict.

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

## Onchain Test Results

The deployed contract has been tested end-to-end on GenLayer Studionet.

### APPROVED case

- **Campaign ID:** `creator-campaign-01`
- **Creator wallet:** `0x146e44881d35814ba582d265af5b97ef2695ec8e`
- **Evidence URL:** *(public article containing the wallet attribution marker and meaningful educational content about GenLayer)*

A creator submitted a public article that:

- explained GenLayer Intelligent Contracts
- discussed decentralized AI-validator consensus
- contained meaningful educational information
- included the required wallet ownership marker (`SPONSORJUDGE_PROOF:0x146e...`)

GenLayer adjudication returned:

```text
APPROVED
```

The frontend subsequently loaded the accepted onchain result and displayed:

```text
Delivery verified
```

### REJECTED case

- **Campaign ID:** same campaign
- **Evidence URL:** *(separate submission with evidence that did not satisfy the campaign requirements)*

A separate submission was intentionally tested with evidence that did not satisfy the campaign requirements.

GenLayer adjudication returned:

```text
REJECTED
```

The frontend correctly displayed the failed verification result.

### What the tests demonstrate

These tests confirm that ProofSponsor does not simply approve submitted URLs or rely on deterministic keyword matching. The AI validators independently evaluated semantic fulfillment and wallet attribution, producing different outcomes for different evidence quality.

## Example Sponsorship Requirement

```text
Creator must publish a meaningful public article explaining how
GenLayer Intelligent Contracts use decentralized AI validator consensus.

The article must contain the required SponsorJudge ownership proof
marker and provide meaningful educational information about GenLayer.
```

The validators compare the public deliverable against this requirement and determine semantic fulfillment.

## Security Design

- **Wallet-specific creator attribution marker:** `SPONSORJUDGE_PROOF:<wallet>`
- **Public evidence must be associated with the submitting creator**
- **Anti-replay:** approved evidence is claimed per campaign — the same URL cannot be approved twice in the same campaign
- **Fail-closed:** inaccessible, empty, or marker-missing evidence returns `REJECTED` without reaching the AI prompt
- **Prompt injection fencing:** evidence content is wrapped in `<UNTRUSTED_EVIDENCE>` tags with explicit instructions to ignore any commands found inside
- **Marker check before truncation:** the attribution marker is verified on the full evidence text before truncating to 14,000 characters, preventing false rejections for markers placed later in the content
- **Semantic evaluation:** validators evaluate semantic fulfillment rather than keyword presence alone
- **Campaign lifecycle:** closed campaigns cannot accept or adjudicate new submissions
- **Onchain persistence:** adjudication results are stored onchain

## Frontend Reliability

ProofSponsor reads GenLayer `accepted` state when loading contract data.

Normal state-changing transactions wait for `TransactionStatus.ACCEPTED` before the frontend re-reads state.

AI adjudication is handled asynchronously. After `judge_content` returns a transaction hash, the frontend polls the submission status with backoff until the contract reports `APPROVED` or `REJECTED`.

Transient RPC or rate-limit errors during polling do not automatically mark an adjudication as failed.

The frontend also rejects evidence URL forms known to be unreliable for validator rendering:

- `raw.githubusercontent.com`
- GitHub `/blob/` URLs

Creators are instead instructed to provide a publicly accessible HTTPS webpage that validators can render.

## Tech Stack

- GenLayer Intelligent Contracts (GenVM v0.2.16)
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
