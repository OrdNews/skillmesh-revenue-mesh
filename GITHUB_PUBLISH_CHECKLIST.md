# GitHub Publish Checklist

## Safe to publish

- `README.md`
- `PROJECT_BRIEF.md`
- `LAUNCH_AUDIT.md`
- `LAUNCH_AUDIT_REPORT.md`
- `MOLTBOOK_POST.md`
- `X_POST.md`
- `DEMO_SCRIPT.md`
- `FORM_TEMPLATE.md`
- `SUBMISSION_PLAYBOOK.md`
- `package.json`
- `package-lock.json`
- `server.js`
- `lib/`
- `scripts/`
- `contracts/`
- `public/`
- `agent-wallets.json`
- `funding-ledger.json`
- `live-purchases.json`
- `proof-ledger.json`
- `deployments/xlayer-proof.json`
- `artifacts/receipts/`
- `x402-cache.json`

## Do not publish

- `.env`
- any screenshots that reveal secrets
- any terminal output that contains live credentials
- any browser capture that exposes private dashboards or hidden tokens

## Already ignored

The current `.gitignore` already excludes:

- `node_modules`
- `.env`
- `dist`
- `.DS_Store`

## Before first push

1. confirm `.env` is not staged
2. confirm `node_modules/` is not staged
3. search the repo for leaked secrets one more time
4. replace all `<<...>>` placeholders in public-facing files only when the final URLs exist
5. make sure the README is the first file a judge should read

## Recommended repo top section

Pin this order in the repo landing page:

1. project name
2. one-line pitch
3. proof contracts and canonical txs
4. Moltbook link
5. X post link
6. quick explanation of `Scout -> route -> pay -> prove`
