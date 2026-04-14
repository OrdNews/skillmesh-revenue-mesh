# OnchainOS Skills Research

Updated: 2026-04-13

## What Was Studied

- attempted the official install command: `npx skills add okx/onchainos-skills`
- cloned the real repository to `/tmp/onchainos-skills`
- inspected the repo README, package metadata, plugin manifests, shared preflight rules, and all 14 `SKILL.md` files
- verified the local CLI is installed and running as `onchainos 2.2.8`

## Important Reality Checks

### 1. This is a skill suite, not one skill

The repo contains **14 separate skills** under `skills/`, not a single monolithic skill:

1. `okx-agentic-wallet`
2. `okx-audit-log`
3. `okx-defi-invest`
4. `okx-defi-portfolio`
5. `okx-dex-market`
6. `okx-dex-signal`
7. `okx-dex-swap`
8. `okx-dex-token`
9. `okx-dex-trenches`
10. `okx-dex-ws`
11. `okx-onchain-gateway`
12. `okx-security`
13. `okx-wallet-portfolio`
14. `okx-x402-payment`

### 2. The installation docs are partially stale

- `README.md` correctly reflects the larger skill suite.
- `.codex/INSTALL.md` still references an older smaller set of skill directories.
- The `npx skills add` installer detected **14 skills**, which matches the real repository layout.

Conclusion: treat the repository contents as the source of truth, not the shorter install note.

### 3. The local CLI and the skill metadata align

- local CLI version: `onchainos 2.2.8`
- skill metadata version across the repo: `2.2.8`

This is good. We are not in obvious version drift.

## The Shared Operating Model

Across most skills, the repo enforces the same practical model:

1. verify or update the `onchainos` CLI before first use in a session
2. use OKX API credentials from environment variables
3. route the user to the correct sub-skill based on intent
4. prefer chain-aware and safety-aware execution
5. avoid silent guessing for risky operations

Common environment assumptions:

- `OKX_API_KEY`
- `OKX_SECRET_KEY`
- `OKX_PASSPHRASE`

Common safety themes:

- do not guess chain mappings when ambiguous
- separate read-only flows from value-moving flows
- run balance checks before spend
- run security checks before risky execution
- prefer one-shot official flows instead of hand-rolled transaction logic when available

## Capability Map

### A. Wallet and Treasury Identity

#### `okx-agentic-wallet`

What it gives us:

- login / verify / add / switch account
- grouped chain addresses
- authenticated balances
- sends, history, smart-contract calls
- message signing

Why it matters for SkillMesh:

- this is the canonical backbone for our organization wallet topology
- it validates the way we already built `Orchestrator / Scout / Trader / Treasury`
- it gives us an official lifecycle for account switching and wallet state

Verdict:

- **must use**

### B. Paying Specialists

#### `okx-x402-payment`

What it gives us:

- official x402 payment proof generation
- TEE signing path
- local EIP-3009 fallback
- version-aware handling for x402 v1 and v2

Why it matters for SkillMesh:

- this is directly aligned with our specialist hiring lane
- it formalizes the exact buyer-side behavior we already started implementing
- it reduces “custom payment glue” risk

Verdict:

- **must use**

### C. Market Context and Route Discovery

#### `okx-dex-market`

What it gives us:

- spot prices
- K-line / candles
- index prices
- wallet PnL
- address tracker activities

Why it matters for SkillMesh:

- this is the best fit for `Scout`
- it gives us judge-visible evidence for why treasury moved
- it lets us explain the “why now?” behind a mission

Verdict:

- **must use**

#### `okx-dex-signal`

What it gives us:

- smart money / KOL / whale signal lists
- trader leaderboard
- tracker activities

Why it matters for SkillMesh:

- this is how `Scout` becomes more differentiated than a normal market data widget
- it allows us to say the organization is not just reading price, but reading behavior
- it can feed opportunity generation for canonical missions

Verdict:

- **high value second-wave integration**

#### `okx-dex-token`

What it gives us:

- token search
- hot tokens
- liquidity pools
- advanced token info
- holder distribution
- cluster analysis

Why it matters for SkillMesh:

- this can make `Scout` much smarter
- cluster analysis is especially useful if we want “judge wow” research depth
- advanced info can justify risk-aware treasury decisions

Verdict:

- **high value second-wave integration**

## What We Actually Applied

The original plan treated `okx-dex-signal` and `okx-dex-token` as second-wave integrations.
That changed once the live routes and security gate were stable.

We have now applied them inside the product as a visible `Scout intelligence` layer:

- `Scout` uses `token price-info` to read the current treasury target lane
- `Scout` uses `token advanced-info` to inspect concentration, risk tier, and token tags
- `Scout` uses `signal list` on X Layer to compare the current treasury target with the live smart-money board
- the mission now computes a `Scout verdict` before treasury budget opens
- if the Scout lane falls to `review`, treasury spend is held even when the security gate is green

This matters because it changes the meaning of `Scout`:

- before: read wallet context and price
- now: read structure, signal flow, and concentration before the organization spends budget

In practice, this is one of the strongest differentiators in the stack.
It moves the demo away from “agent sees a quote and spends” toward:

`agent evaluates whether the current treasury lane is structurally good enough to justify budget deployment`

## Live Findings That Matter

During live verification on X Layer, we confirmed:

- native `OKB` can be queried through the native placeholder address `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`
- `token price-info` returns usable live liquidity and volume for the route target
- `token advanced-info` returns risk tier and concentration fields that are useful in a treasury policy
- `signal list` returns a real X Layer board that can be surfaced directly in the product

That means the Scout lane can now reason about:

- liquidity depth
- 24h volume
- OKX risk tier
- top-10 concentration
- bundle concentration
- whether the treasury target is currently echoed by the live signal board

## Updated Priority Order

The product-facing order is now:

1. `okx-agentic-wallet`
2. `okx-x402-payment`
3. `okx-security`
4. `okx-dex-market`
5. `okx-dex-signal`
6. `okx-dex-token`
7. `okx-dex-swap`
8. `okx-onchain-gateway`

Reason:

- wallet gives identity
- x402 gives spend
- security gates risk
- signal + token intelligence now decide whether budget should open at all
- swap and gateway execute only after that decision is already justified

### D. Route Execution

#### `okx-dex-swap`

What it gives us:

- quote
- approve
- execute
- raw unsigned swap transaction data
- liquidity source introspection
- MEV protection guidance

Why it matters for SkillMesh:

- this is the natural engine for `Trader`
- it fits our “route capital before spending budget” narrative
- it is better than hand-assembling swaps for MVP speed and correctness

Verdict:

- **must use**

### E. Transaction Final Mile

#### `okx-onchain-gateway`

What it gives us:

- gas price
- gas-limit estimate
- transaction simulation
- signed transaction broadcast
- order tracking

Why it matters for SkillMesh:

- perfect for proof-heavy or manual transaction flows
- useful whenever we need to simulate or broadcast something not covered by `swap execute`
- useful for stricter preflight checks before treasury spends

Verdict:

- **must use selectively**

### F. Security Guardrails

#### `okx-security`

What it gives us:

- token-scan
- dapp-scan
- tx-scan
- signature-scan
- approval checks

Why it matters for SkillMesh:

- this is probably the most underused but highest-leverage differentiator
- it lets us add a real “risk gate” before capital deployment
- it helps us avoid looking like a reckless trading swarm

Verdict:

- **must integrate as a visible guardrail**

### G. Portfolio Context

#### `okx-wallet-portfolio`

What it gives us:

- public-address portfolio value
- token balances
- chain-specific public holdings queries

Why it matters for SkillMesh:

- useful when `Scout` researches external addresses
- useful for public proof panels and wallet-overview screens

Verdict:

- **useful but not core**

#### `okx-defi-portfolio`

What it gives us:

- DeFi positions across supported protocols

Why it matters for SkillMesh:

- useful if we evolve from “operating budget” to “treasury allocation”

Verdict:

- **not MVP**

#### `okx-defi-invest`

What it gives us:

- DeFi search
- invest / withdraw / claim flows

Why it matters for SkillMesh:

- potentially powerful for a future “treasury deployment” story
- but it changes our product from operating-budget logic into portfolio-management logic

Verdict:

- **not MVP**

### H. Meme / Trenches / Streaming / Logs

#### `okx-dex-trenches`

What it gives us:

- meme token scanning
- dev reputation
- bundle analysis
- aped wallets

Verdict for SkillMesh:

- exciting, but likely too far from our current story unless we pivot to “alpha swarm”
- **do not add now**

#### `okx-dex-ws`

What it gives us:

- background WebSocket sessions
- real-time signals / prices / trades / meme events

Verdict for SkillMesh:

- great for a later “live screen” upgrade
- not necessary for the canonical demo
- **do not add before launch**

#### `okx-audit-log`

What it gives us:

- audit log path and usage

Verdict for SkillMesh:

- helpful operationally
- not product-defining
- **nice to have**

## Best Integration Strategy for SkillMesh

## Tier 1 — Immediate, high-value, should be visible in the product

1. `okx-agentic-wallet`
2. `okx-x402-payment`
3. `okx-dex-market`
4. `okx-dex-swap`
5. `okx-onchain-gateway`
6. `okx-security`

These six together map almost perfectly onto our current product:

- `Scout` → `okx-dex-market` + `okx-security`
- `Trader` → `okx-dex-swap` + `okx-onchain-gateway`
- `Treasury` → `okx-agentic-wallet` + `okx-x402-payment`

## Tier 2 — Adds depth and differentiation without changing the product category

1. `okx-dex-signal`
2. `okx-dex-token`
3. `okx-wallet-portfolio`

These three are the best candidates for making the project feel smarter and less generic.

## Tier 3 — Strong tools, wrong timing

1. `okx-defi-invest`
2. `okx-defi-portfolio`
3. `okx-dex-trenches`
4. `okx-dex-ws`
5. `okx-audit-log`

These are useful, but they either expand scope too much or do not improve the core judging story enough right now.

## What This Changes For Our Product

The biggest insight is this:

We should not present SkillMesh as a generic “agent framework that happens to call OKX”.

We should present it as an operating system built on three visible OKX layers:

1. **identity and custody** — Agentic Wallet
2. **capital movement and market execution** — Market + Swap + Gateway
3. **budgeted capability purchase** — x402 Payment

That is a much stronger product story.

## Concrete Product Improvements We Should Make

### 1. Add a visible risk gate before route execution

Current issue:

- our story is strong, but risk review is implied more than shown

Improve with:

- run `okx-security` before treasury deployment
- show a “risk gate: pass / warn / block” step in the mission timeline
- show the result in UI before specialist hire

Why:

- makes the organization feel disciplined
- differentiates us from “reckless autonomous trader” demos

### 2. Make Scout behavior more intelligent using signal + token research

Current issue:

- `Scout` is directionally good, but still reads as generic market research

Improve with:

- combine `okx-dex-signal` and `okx-dex-token`
- give Scout a richer opportunity memo:
  - smart money behavior
  - token liquidity
  - holder cluster concentration
  - creator / dev warning notes

Why:

- creates a stronger “why this mission exists” narrative
- gives judges more evidence that our organization is reasoning, not just routing

### 3. Tighten Trader into the official OKX execution path

Current issue:

- our current route story mixes OKX and Uniswap concepts in a smart way, but the product should show the official execution semantics more clearly

Improve with:

- use `okx-dex-swap quote`
- use `okx-dex-swap execute` where appropriate
- use `okx-onchain-gateway simulate` for raw transactions or proof-related calls

Why:

- reduces “custom integration” ambiguity
- makes the demo easier to explain

### 4. Keep x402 as the core spend primitive

Current issue:

- x402 is already one of our strongest differentiators, but it should remain visibly central

Improve with:

- explicitly position x402 as the organization’s “budget spending protocol”
- keep specialist hiring as the clearest real-money action in the demo

Why:

- it is the cleanest bridge between agent autonomy and onchain proof

## What We Should Not Do Right Now

1. do not pivot into a meme-trading product just because `okx-dex-trenches` exists
2. do not add DeFi deposit/withdraw flows before launch
3. do not build a real-time WS control center before the core release is finished
4. do not add every OKX feature to the UI just because it is available

The winning move is selective integration, not maximum surface area.

## Final Recommendation

For SkillMesh Revenue Mesh, the highest-value interpretation of `onchainos-skills` is:

### Core stack to emphasize publicly

- `okx-agentic-wallet`
- `okx-dex-market`
- `okx-dex-swap`
- `okx-onchain-gateway`
- `okx-security`
- `okx-x402-payment`

### Best product sentence

`SkillMesh uses OKX Agentic Wallet for treasury identity, OKX market and swap skills for capital routing, OKX security as a risk gate, and OKX x402 payment to let the organization spend its own operating budget on specialist intelligence.`

### Best next implementation move

If we want the most meaningful improvement with the least scope risk:

1. integrate `okx-security` as a first-class mission step
2. upgrade `Scout` with `okx-dex-signal` + `okx-dex-token`
3. keep `x402` specialist hiring as the spend action that closes the loop

That would make the project feel more intelligent, more disciplined, and more first-place ready without changing its core category.
