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
2. grade the treasury lane with signal, structure, and concentration data
3. prepare a live route
4. spend treasury budget over `x402`
5. record mission proof on `X Layer`
6. mint a receipt-backed artifact

The `Scout` lane is not just a price widget.
In the live build it combines `OKX Market`, `OKX Signal`, `OKX Token`, and `OKX Security` so the organization can decide whether a treasury lane is good enough to justify budget deployment.

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

In the live build, that stack resolves into:

- `OKX Market` for wallet and route context
- `OKX Signal + Token` for Scout intelligence
- `OKX Security` for treasury risk gating
- `OKX Trade + Uniswap AI` for route-aware execution
- `x402` for specialist spend
- `X Layer` for proof and receipts

## Canonical demo mission

One clean mission is the public demo path:

1. `Scout` reads treasury context
2. `Scout` grades the treasury lane with signal, structure, and concentration data
3. `Trader` returns a live route
4. the organization performs one real specialist hire
5. `Treasury` writes task proof and mints a receipt

This is the shortest path to a memorable and verifiable demo.

## Proof

### Contracts

- Registry: `0xAe0bCB2181ff57E344D65aFBB6B033acf799d345`
- Receipt: `0xbc8cdbc75105E6f25f886D9f3505784D5fdFeAd3`

### Canonical transactions

- Registry deploy tx: `0x70e2a9a2cbd5e68f380f8f7b080b9baabf9e3dc4fc3de185e7949f0fc767b842`
- Receipt deploy tx: `0x33f80872d0a53bc20879d491120b9ea4b676b09c2e45bc4bf6cc3fc47f898ebe`
- Mission proof tx: `0xedbc9cfc88b6d2348ee517f0b1920e353d2e830cae579622bb694105d54a2105`
- Receipt mint tx: `0xa290dc1919d5d7ccc3e2d23e8ea7733cc9963f8444be0bdb9a2d43ec0f2bd2eb`
- Specialist settlement tx: `0xd9449e5693010ba9a23faf5e29f31bb6d84e3439af6d77f2bd1951b4023c70a7`

### Canonical mission artifact

- Task id: `20c4707f-ca85-4d0a-8ccf-4e6e54e49a31`
- Artifact: `artifacts/receipts/20c4707f-ca85-4d0a-8ccf-4e6e54e49a31.json`

## Organization wallets

- Orchestrator: `0x90ec52fe001a5b59b356eb55ffb6931b7c37db26`
- Scout: `0x399b67977ec2b478568a9ecb7a27cb48c2d99ecb`
- Trader: `0x7bd1931968132d893971b3f715c1153ddf70b3d5`
- Treasury: `0x86a031a0618b43a0269e0e20d504fca6fc3a149a`

The Orchestrator wallet is the canonical organization identity for submission.

## Public links

- GitHub: `https://github.com/OrdNews/skillmesh-revenue-mesh`
- Moltbook: `<<MOLTBOOK_URL>>`
- X post: `<<X_POST_URL>>`
- Video: not included

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
3. the Google Form is filled with final public links only
