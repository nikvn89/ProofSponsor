# GitHub web upload manifest

Extract the delivery ZIP, then upload the files and folders at its root to the existing `ProofSponsor` repository. The archive does not contain `.git`, `node_modules`, `dist`, Python caches, or TypeScript build artifacts.

## Add

- `contracts/ProofSponsorV3.py`
- `tests/test_contract_v3.py`
- `SECURITY.md`
- `MILESTONE_SUBMISSION.md`
- `.github/workflows/ci.yml`
- `docs/evidence/README.md`

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

After deploying this exact V3 source, copy its address, deploy transaction, and SHA into `README.md`, `CHANGELOG.md`, and `RUNTIME_EVIDENCE.md`; replace the zero address in `.env.example` and production environment configuration.
