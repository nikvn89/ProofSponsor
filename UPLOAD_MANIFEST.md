# GitHub web upload manifest

Extract the delivery ZIP, then upload the files and folders at its root to the existing `ProofSponsor` repository. The archive does not contain `.git`, `node_modules`, `dist`, Python caches, or TypeScript build artifacts.

## Add

- `contracts/ProofSponsorV3.py`
- `tests/test_contract_v3.py`
- `SECURITY.md`
- `MILESTONE_SUBMISSION.md`
- `.github/workflows/ci.yml`
- `docs/evidence/README.md`
- `docs/evidence/v3-recovery-250925-01.html`
- `docs/evidence/v3-contract-deployment.png`
- `docs/evidence/v3-create-campaign-tx.png`
- `docs/evidence/v3-before-verification.png`
- `docs/evidence/v3-after-unavailable.png`
- `docs/evidence/v3-public-evidence.png`
- `docs/evidence/v3-final-judgment-tx.png`
- `docs/evidence/v3-after-recovered.png`

## Replace

- `.env.example`
- `CHANGELOG.md`
- `README.md`
- `RUNTIME_EVIDENCE.md`
- `TESTING.md`
- `package.json`
- `package-lock.json`
- `src/App.tsx`
- `src/ReviewDossier.tsx`
- `src/components/StatusPill.tsx`
- `src/lib/config.ts`
- `src/lib/genlayer.ts`
- `src/lib/review.ts`
- `src/styles.css`
- `tests/review.test.mjs`

## Delete

None.

Do not delete or replace `contracts/ProofSponsor.py` or `contracts/ProofSponsorV2.py`. They are included unchanged so a whole-repository upload remains safe.

## Source integrity before deployment

- `contracts/ProofSponsor.py`: `f2267a11b8b724509d2e8a0d3461bab8ba19e5dc49ae12f44a0fb786f1ad1e9d`
- `contracts/ProofSponsorV2.py`: `8cc60cc93b195679172b8a6240d24f54a87be6c40be70784ba061e8f4775df3f`
- `contracts/ProofSponsorV3.py`: `932cd6f3bc6176c4d416d3870ef9123d313217bdfb1843bf427adc1021f59394`

The exact V3 source is deployed at `0x5f9950BCe63AcAb1b5DF02f0231A645fcbB74e0A`; its deployment transaction and runtime recovery evidence are recorded in `README.md`, `CHANGELOG.md`, and `RUNTIME_EVIDENCE.md`. Keep the zero address in `.env.example` so a repository clone never implies a production target. Configure `VITE_CONTRACT_ADDRESS` and `VITE_CONTRACT_VERSION=3` only in the deployment platform.
