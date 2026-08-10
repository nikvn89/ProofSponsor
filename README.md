# ProofSponsor

**Decentralized sponsorship proof-of-performance on GenLayer.**

ProofSponsor is a full GenLayer dApp for sponsors and creators.

Sponsors define qualitative campaign requirements in natural language. Creators publish their work publicly, prove wallet attribution using a contract-generated ownership marker, and submit the public evidence URL.

GenLayer AI validators then adjudicate whether the submitted deliverable meaningfully fulfilled the sponsorship requirements.

## Live Demo

https://proofsponsor-gl.vercel.app/

> **Note:** MetaMask may currently display a security warning for the Vercel deployment. A false-positive review has been submitted. Reviewers may run the frontend locally if preferred.

## Source Code

https://github.com/nikvn89/ProofSponsor

## Live Contract

**Network:** GenLayer Studionet

```text
0x3Aa42FdD6EC0299c4172aaB47C4f0586625736bC
```

> The contract class is named `SponsorJudge` internally. This reflects the original adjudication engine name. The project and dApp are branded **ProofSponsor**.

## Reviewer Testing

A complete copy-and-paste testing guide is available here:

**[TESTING.md](./TESTING.md)**

It includes both:

- `APPROVED` test
- `REJECTED` test

and provides the exact campaign requirements, evidence content, delivery note, and expected results.

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
Creator publishes content + marker
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

Example:

```text
SPONSORJUDGE_PROOF:0x146e44881d35814ba582d265af5b97ef2695ec8e
```

The creator places this marker inside the public deliverable.

Validators therefore verify both:

1. whether the content satisfies the sponsorship brief
2. whether the public evidence is associated with the wallet submitting it

## Onchain Test Results

The deployed contract has been tested end-to-end on GenLayer Studionet.

### APPROVED

A public deliverable containing meaningful GenLayer educational content and the correct wallet ownership marker was submitted.

GenLayer adjudication returned:

```text
APPROVED
```

The frontend displayed:

```text
100%
Delivery verified
APPROVED
```

### REJECTED

A separate submission was intentionally tested with evidence that did not satisfy the campaign requirements.

GenLayer adjudication returned:

```text
REJECTED
```

These tests demonstrate that ProofSponsor does not simply approve submitted URLs or rely on deterministic keyword matching.

The validators evaluate semantic fulfillment and wallet attribution before producing the onchain verdict.

## Security Design

- **Wallet-specific attribution:** `SPONSORJUDGE_PROOF:<wallet>`
- **Public evidence ownership:** evidence must be associated with the submitting creator
- **Anti-replay:** approved evidence is claimed per campaign
- **Fail-closed:** inaccessible, empty, or marker-missing evidence returns `REJECTED`
- **Prompt-injection fencing:** external evidence is treated as untrusted content
- **Marker check before truncation:** attribution is checked against the full evidence before prompt-size truncation
- **Semantic evaluation:** validators evaluate fulfillment rather than keyword presence alone
- **Campaign lifecycle:** closed campaigns cannot accept or adjudicate new submissions
- **Onchain persistence:** adjudication results are stored onchain

## Frontend Reliability

ProofSponsor reads GenLayer `accepted` state when loading contract data.

Normal state-changing transactions wait for `TransactionStatus.ACCEPTED` before the frontend re-reads state.

AI adjudication is asynchronous. After `judge_content` returns a transaction hash, the frontend polls submission status with backoff until the contract reports:

```text
APPROVED
```

or:

```text
REJECTED
```

Transient RPC or rate-limit errors during polling do not automatically mark the adjudication as failed.

The frontend also rejects evidence URL forms known to be unreliable for validator rendering:

- `raw.githubusercontent.com`
- GitHub `/blob/` URLs

Creators should provide a publicly accessible HTTPS webpage that GenLayer validators can render.

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

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Environment

Create `.env` from `.env.example`.

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

Environment variable:

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
├── TESTING.md
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
