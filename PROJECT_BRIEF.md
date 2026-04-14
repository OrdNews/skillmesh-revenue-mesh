# SkillMesh Revenue Mesh Project Brief

## Current project definition

`SkillMesh Revenue Mesh` is our refined X Layer Arena direction for the OKX Build X Hackathon.

One-line pitch:

`SkillMesh Revenue Mesh` is a self-funding agent organization on X Layer where agents scout with OKX, route treasury capital with Uniswap-aware execution, hire specialist agents over x402, and return a proof-backed receipt.

## Why this version is stronger

The original marketplace framing was too generic.
This upgraded version is closer to a winning hackathon story because it now covers all four verbs the prompt cares about in one organizational loop:

- earn
- route
- pay
- interact

## Final recommended MVP

Keep the scope intentionally narrow but make the narrative sharper.

### P0 features

- One `Orchestrator Agent`
- One `Scout Agent` for OKX market context, signal-board reads, token structure, and treasury-lane grading
- One `Trader Agent` for route planning and treasury deployment
- Three specialist workers: `Translator`, `Summarizer`, `CodeReviewer`
- One `Treasury Agent`
- Dedicated Agentic Wallet accounts for `Orchestrator`, `Scout`, `Trader`, and `Treasury`
- Seed startup balances pushed onchain to `Scout`, `Trader`, and `Treasury`
- A dashboard that shows the protocol stack, treasury loop, evidence trail, balances, and receipt
- A real seller-side x402 rail for `supported`, worker payment requirements, `verify`, and `settle`
- A live buyer-side purchase script that runs `accepts -> x402-pay -> verify -> settle` and records each settlement
- A deterministic proof deployment script that deploys and reuses the `Registry` and `Receipt` contracts on X Layer
- Dashboard controls that can trigger a real live specialist hire on demand
- Task submission can explicitly enable one real specialist hire and bind that spend to the mission receipt
- Each mission carries a deterministic `proofTaskHash`, exports a receipt artifact, and can later be written to the live proof contracts
- A visible `Scout intelligence` layer that uses OKX signal + token data to decide whether treasury budget should open
- Real payment flow on X Layer in the final integration phase
- Real proof writes in the final integration phase

## Submission and traction surfaces

We should treat the project as living in two places at the same time:

- `Moltbook BuildX` as the official participation and project-discovery surface
- `GitHub` as the code, architecture, and proof surface for judges

This matters because the strongest submission is not just a working demo.
It also needs a crisp public story, visible updates, and a page that humans can engage with during the event.

## Core protocol lane

- `OKX Market` for discovery and signal reads
- `OKX Signal + Token` for structure, concentration, and board context
- `OKX Security` for treasury risk gating
- `OKX Trade` for supported chains, quote, and swap construction
- `Uniswap AI` for route planning and pay-with-any-token strategy
- `x402` for specialist hiring and service settlement
- `X Layer` for proof and receipts

## One core demo flow

1. User submits a natural-language task.
2. Orchestrator activates `Scout` to attach market and treasury context.
3. `Scout` grades the current treasury lane using signal flow, structure, and concentration data.
4. `Trader` prepares a route-aware execution plan.
5. The organization spends treasury budget to hire specialist workers over x402 only if the Scout lane and risk gate allow it.
6. Treasury records completion on X Layer.
7. Frontend shows the protocol lane, evidence, treasury logic, receipt, and final delivery.

## Frontend experience

Avoid a chat clone and avoid a Trello board.

The UI now focuses on:

- `Agent Network`
- `Execution Stack`
- `Strategy Snapshot`
- `Pipeline`
- `Treasury Radar`
- `Scout Intelligence`
- `Risk Gate`
- `Execution Evidence`
- `Receipt`

## What not to build

These are out of scope unless the MVP is already finished:

- user auth
- worker marketplace management UI
- bidding system
- token economy
- multi-chain support
- complex escrow
- generic chat UI
- mobile polish
- analytics-heavy dashboards
- advanced reputation logic
- historical task archive

## Delivery plan

### Day 1

- finalize the dual-stack architecture
- keep the local prototype coherent
- prepare the protocol lane in the UI

### Day 2

- connect live Agentic Wallet balance and execution identity
- connect live quote and route evidence
- connect the x402 verify and settle path
- produce the first live specialist settlement artifact
- keep Scout and Trader visible in the execution story

### Day 3

- connect quote and route planning
- expose tx links and balance changes
- attach receipt generation to live chain data

### Day 4

- polish the main demo
- run end-to-end tests
- finalize README and recording assets
- prepare the Moltbook project page and traction copy
