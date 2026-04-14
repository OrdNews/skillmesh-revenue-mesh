# SkillMesh Revenue Mesh Launch Audit

## Goal

Ship a submission-grade release for the OKX Build X Hackathon that is:

- convincing to AI judges
- memorable to human judges
- safe enough to demo live
- consistent across product, code, chain proof, and public-facing materials

This is not a perfection trap. It is a release gate.

## Release Standard

We only launch externally when all `P0` items are green.

Scoring lens:

- Product originality and future realism
- Onchain OS depth
- Uniswap integration quality
- X Layer proof density
- Demo clarity
- GitHub readability
- Moltbook/X shareability

## P0 Launch Gates

### 1. Core Story

- [ ] One-sentence pitch is stable and repeated everywhere
- [ ] Project name is final
- [ ] The demo shows a self-funding agent organization, not a generic task bot
- [ ] We can explain why this is different from an AI company dashboard
- [ ] We can explain why this is different from a trading bot

Launch wording:

`A self-funding agent organization on X Layer that scouts opportunities, routes capital, and spends its own onchain budget to hire specialist agents.`

### 2. Product Flow

- [ ] One primary demo path is fixed
- [ ] The primary path can complete in under 2 minutes
- [ ] The UI makes the flow legible without narration
- [ ] The user can clearly see scout -> route -> hire -> prove
- [ ] Real-money actions are explicit and gated

Primary demo path:

1. User submits one treasury mission
2. Scout identifies an opportunity
3. Trader returns a live route or quote
4. The organization performs one real specialist hire
5. Treasury records proof and receipt on X Layer

### 3. Onchain Proof

- [ ] Proof contracts are deployed on X Layer
- [ ] Agent registrations exist onchain
- [ ] At least one task proof write exists onchain
- [ ] At least one receipt mint exists onchain
- [ ] At least one real specialist settlement tx exists
- [ ] We can open every tx during the demo

Canonical proof set:

- Registry: `0xAe0bCB2181ff57E344D65aFBB6B033acf799d345`
- Receipt: `0xbc8cdbc75105E6f25f886D9f3505784D5fdFeAd3`
- Mission proof tx: `0xbdc153b13c48fec7e2da104f90bdf9755d375b48524e6786784c15191469e50c`
- Receipt mint tx: `0xcfa37406418fd82eae96c254b55032b8fa304ee126be4acca9554b3ef8587268`
- Specialist settlement tx: `0x9c72cd4131f398f743bf4aa75033a1e42f04202cbf643fe69462d5fdc9678d05`

### 4. Wallet and Treasury Topology

- [ ] Orchestrator wallet is the canonical organization identity
- [ ] Scout wallet exists and is funded
- [ ] Trader wallet exists and is funded
- [ ] Treasury wallet exists and is funded
- [ ] Funding ledger is accurate
- [ ] No wallet shown in the product conflicts with the README or demo script

Canonical organization address:

- Orchestrator: `0x90ec52fe001a5b59b356eb55ffb6931b7c37db26`

### 5. Live Execution Integrity

- [ ] Live quote fetch works reliably
- [ ] Real specialist hiring works from the UI
- [ ] Real specialist hiring works from script fallback
- [ ] Receipt artifact binds to the correct task id
- [ ] One mission can complete with a real purchase and real proof
- [ ] Failure modes are understandable to a live audience

### 6. Safety and Demo Control

- [ ] Real-money actions require explicit user choice
- [ ] Spend sizes are intentionally tiny
- [ ] Demo wallets hold only demo funds
- [ ] There is a safe fallback path if live settlement fails
- [ ] There is a no-surprises dry-run path for recorded demos

### 7. UI and UX

- [ ] Hero copy matches the winning story
- [ ] There are no dead buttons
- [ ] Proof panel shows real values
- [ ] Wallet panel shows real balances
- [ ] Funding panel shows real tx links
- [ ] Specialist purchase panel shows real settlements
- [ ] The page looks intentional on desktop

### 8. GitHub Submission Surface

- [ ] Repo is public
- [ ] README headline is strong in the first screen
- [ ] README explains what the project is in 15 seconds
- [ ] README links contracts, txs, Moltbook, and X post
- [ ] README quick start is accurate
- [ ] README includes track choice and ecosystem fit
- [ ] README includes the exact proof addresses and one canonical task artifact

### 9. Moltbook Submission Surface

- [ ] Moltbook post headline is sharp
- [ ] First image or clip is strong enough to stop scroll
- [ ] Moltbook post contains project link, GitHub link, and proof links
- [ ] The post explains the future use case, not just the hackathon build
- [ ] At least one follow-up update is prepared

### 10. X / Social Surface

- [ ] One short launch post is written
- [ ] One thread outline is written
- [ ] The key visual can be screenshotted quickly
- [ ] The post names OKX, X Layer, Onchain OS, and Uniswap appropriately
- [ ] The post is consistent with the README and Moltbook wording

### 11. Submission Form

- [ ] Google Form is filled with final links only
- [ ] Agentic Wallet Address is the correct canonical wallet
- [ ] GitHub repo link is public
- [ ] X link is correct
- [ ] Moltbook link is correct
- [ ] Team information is consistent with the repo

## P1 Polish

- [ ] Specialist agents also get direct proof links
- [ ] More than one mission artifact is available
- [ ] Screenshots for README are production-quality
- [ ] A short architecture graphic is exported
- [ ] Funding ledger is mirrored in the UI more elegantly

## Stop-Ship Conditions

Do not launch externally if any of these are true:

- Any proof link is broken
- Any displayed wallet address is wrong
- The product claims a live action that is still mocked
- The README and UI tell different stories
- The demo needs luck to succeed
- The public repo exposes secrets
- The form links point to private resources

## Launch Sequence

1. Freeze the core story
2. Run live mission smoke test
3. Verify all proof links
4. Finalize README
5. Publish GitHub
6. Publish Moltbook
7. Publish X post
8. Submit Google Form

## Go / No-Go

Final rule:

If the project is not perfect, that is acceptable.

If the project is inconsistent, confusing, or unverifiable, that is not acceptable.
