# SkillMesh Revenue Mesh

Onchain operating budget system for self-funding agent organizations.

Built for the `OKX Build X Hackathon` in the `X Layer Arena`.

## One-line pitch

SkillMesh Revenue Mesh is a self-funding agent organization on X Layer that scouts opportunities, routes capital, and spends its own onchain budget to hire specialist agents.

## Category

SkillMesh Revenue Mesh should be understood as:

`an onchain operating budget system for self-funding agent organizations`

That is the core category we want judges to remember.

## Why this is different

This is not:

- a generic AI company dashboard
- a generic task marketplace
- a pure trading bot

This is a visible onchain organization with treasury, specialist hiring, and proof.

It can:

1. scout treasury context
2. prepare a live route
3. spend treasury budget over `x402`
4. record mission proof on `X Layer`
5. mint a receipt-backed artifact

That maps directly to the hackathon brief:

`earn -> route -> pay -> interact -> prove`

## Core agents

- `Orchestrator`: command and mission routing
- `Scout`: OKX market and treasury context
- `Trader`: route-aware execution planning
- `Translator`: paid specialist
- `Summarizer`: paid specialist
- `CodeReviewer`: paid specialist
- `Treasury`: proof and receipt recording

## Core stack

- `OKX Onchain OS`
- `Uniswap AI`
- `x402`
- `X Layer`

## Canonical demo mission

One clean mission is the public demo path:

1. `Scout` reads treasury context
2. `Trader` returns a live route
3. the organization performs one real specialist hire
4. `Treasury` writes task proof and mints a receipt

This is the shortest path to a memorable and verifiable demo.

## Proof

### Contracts

- Registry: `0xAe0bCB2181ff57E344D65aFBB6B033acf799d345`
- Receipt: `0xbc8cdbc75105E6f25f886D9f3505784D5fdFeAd3`

### Canonical transactions

- Registry deploy tx: `0x70e2a9a2cbd5e68f380f8f7b080b9baabf9e3dc4fc3de185e7949f0fc767b842`
- Receipt deploy tx: `0x33f80872d0a53bc20879d491120b9ea4b676b09c2e45bc4bf6cc3fc47f898ebe`
- Mission proof tx: `0xbdc153b13c48fec7e2da104f90bdf9755d375b48524e6786784c15191469e50c`
- Receipt mint tx: `0xcfa37406418fd82eae96c254b55032b8fa304ee126be4acca9554b3ef8587268`
- Specialist settlement tx: `0x9c72cd4131f398f743bf4aa75033a1e42f04202cbf643fe69462d5fdc9678d05`

### Canonical mission artifact

- Task id: `5cafdc6f-5aa8-4596-af86-a8fabc8ecd61`
- Artifact: `artifacts/receipts/5cafdc6f-5aa8-4596-af86-a8fabc8ecd61.json`

## Organization wallets

- Orchestrator: `0x90ec52fe001a5b59b356eb55ffb6931b7c37db26`
- Scout: `0x399b67977ec2b478568a9ecb7a27cb48c2d99ecb`
- Trader: `0x7bd1931968132d893971b3f715c1153ddf70b3d5`
- Treasury: `0x86a031a0618b43a0269e0e20d504fca6fc3a149a`

The Orchestrator wallet is the canonical organization identity for submission.

## Public links

- GitHub: `https://github.com/OrdNews/skillmesh-revenue-mesh`
- Demo video: `<<DEMO_URL>>`
- Moltbook: `<<MOLTBOOK_URL>>`
- X post: `<<X_POST_URL>>`

## Run locally

```bash
npm start
```

Then open `http://127.0.0.1:3000`.

## Useful commands

Run a real specialist purchase:

```bash
npm run purchase:summarizer
npm run purchase:translator
npm run purchase:review
```

Prepare or update the proof layer:

```bash
npm run proof:deploy
npm run proof:register
npm run proof:write -- --task-id <task-id>
```

## Environment

The project reads:

- `OKX_API_KEY` or `OK_API_KEY`
- `OKX_SECRET_KEY` or `OK_SECRET_KEY`
- `OKX_PASSPHRASE`
- `XLAYER_RPC_URL`
- `X402_FACILITATOR_URL`
- `SKILLMESH_REGISTRY_ADDRESS`
- `SKILLMESH_RECEIPT_ADDRESS`
- `ONCHAINOS_ACCOUNT_ID`

## Local records

- wallet topology: `agent-wallets.json`
- startup funding: `funding-ledger.json`
- live specialist settlements: `live-purchases.json`
- proof registrations and task writes: `proof-ledger.json`
- deployed proof contracts: `deployments/xlayer-proof.json`
- receipt artifacts: `artifacts/receipts/`

## Submission posture

Internally, the project is already strong enough for rehearsal and capture.

Externally, we should publish only after:

1. the Moltbook post is live
2. the X post is live
3. the demo video is uploaded
4. the Google Form is filled with final public links only
