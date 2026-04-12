const state = {
  agents: [],
  integration: null,
  stack: [],
  opportunities: [],
  live: null,
  organization: [],
  fundingLedger: null,
  livePurchases: null,
  proof: null,
  purchaseBusy: false,
  purchaseStatus: "No live specialist purchase has been triggered from the dashboard yet.",
  taskId: null,
  task: null,
  pollHandle: null
};

const networkGrid = document.querySelector("#network-grid");
const flowStrip = document.querySelector("#network-flow");
const stackList = document.querySelector("#stack");
const strategyCard = document.querySelector("#strategy");
const pipeline = document.querySelector("#pipeline");
const opportunities = document.querySelector("#opportunities");
const transactions = document.querySelector("#transactions");
const receipt = document.querySelector("#receipt");
const finalOutput = document.querySelector("#final-output");
const balances = document.querySelector("#balances");
const readiness = document.querySelector("#readiness");
const orgWallets = document.querySelector("#org-wallets");
const fundingProof = document.querySelector("#funding-proof");
const livePurchases = document.querySelector("#live-purchases");
const proofLedger = document.querySelector("#proof-ledger");
const purchaseStatus = document.querySelector("#purchase-status");
const livePurchaseButtons = Array.from(document.querySelectorAll(".live-purchase-button"));
const metricWorkers = document.querySelector("#metric-workers");
const metricStatus = document.querySelector("#metric-status");
const metricReady = document.querySelector("#metric-ready");
const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const liveSpendToggle = document.querySelector("#live-spend-toggle");

function currencyLabel(price) {
  return price == null ? "internal" : `$${price.toFixed(3)}/call`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }
  return response.json();
}

function formatDelta(before, after) {
  const delta = Number((after - before).toFixed(3));
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(3)} USD`;
}

function renderAgents() {
  metricWorkers.textContent = String(state.agents.length);
  const activeWorkers = new Set(state.task?.selectedWorkerIds || []);

  networkGrid.innerHTML = state.agents
    .map((agent) => {
      const isActive =
        agent.id === "orchestrator" ||
        agent.id === "treasury" ||
        activeWorkers.has(agent.id);

      return `
        <article class="agent-card accent-${agent.accent} ${isActive ? "is-active" : ""}">
          <div class="agent-card-top">
            <span class="agent-role">${escapeHtml(agent.role)}</span>
            <span class="agent-price">${escapeHtml(currencyLabel(agent.price))}</span>
          </div>
          <h3>${escapeHtml(agent.name)}</h3>
          <p class="agent-skill">${escapeHtml(agent.skill)}</p>
          <a class="agent-link" href="${escapeHtml(agent.metadataUrl)}" target="_blank" rel="noreferrer">agent card</a>
          <dl class="agent-meta">
            <div>
              <dt>Wallet</dt>
              <dd>${escapeHtml(agent.wallet)}</dd>
            </div>
            <div>
              <dt>Value</dt>
              <dd>${agent.balance.toFixed(3)} USD</dd>
            </div>
          </dl>
        </article>
      `;
    })
    .join("");

  if (!state.task) {
    flowStrip.innerHTML = `
      <div class="flow-pill">
        <strong>Idle</strong>
        <span>Start a task to animate market scouting, route planning, x402 settlements, and proof.</span>
      </div>
    `;
    return;
  }

  const lane = (state.task.selectedWorkerIds || [])
    .map((workerId) => state.agents.find((agent) => agent.id === workerId)?.name || workerId)
    .join(" -> ");

  flowStrip.innerHTML = `
    <div class="flow-pill">
      <strong>Route</strong>
      <span>Orchestrator -> ${escapeHtml(lane || "Scout -> Trader")} -> Treasury</span>
    </div>
    <div class="flow-pill">
      <strong>Protocols</strong>
      <span>${escapeHtml(state.task.strategy.protocols.join(" -> "))}</span>
    </div>
    <div class="flow-pill">
      <strong>Status</strong>
      <span>${escapeHtml(state.task.status)}</span>
    </div>
  `;
}

function renderStack() {
  if (!state.stack.length) {
    stackList.className = "stack-list empty-state";
    stackList.innerHTML = "<p>Protocol stack details will load here.</p>";
    return;
  }

  stackList.className = "stack-list";
  stackList.innerHTML = state.stack
    .map(
      (item) => `
        <article class="stack-card">
          <div class="stack-top">
            <strong>${escapeHtml(item.label)}</strong>
            <span class="stack-status stack-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
          </div>
          <p>${escapeHtml(item.summary)}</p>
          <div class="stack-meta">
            <span>Owner: ${escapeHtml(item.owner)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderStrategy() {
  if (!state.task?.strategy) {
    strategyCard.className = "strategy-card empty-state";
    strategyCard.innerHTML = "<p>Start a workflow to see the current strategy snapshot.</p>";
    return;
  }

  const strategy = state.task.strategy;
  strategyCard.className = "strategy-card";
  strategyCard.innerHTML = `
    <span class="strategy-label">Current strategy</span>
    <h3>${escapeHtml(strategy.headline)}</h3>
    <p>${escapeHtml(strategy.objective)}</p>
    <div class="strategy-grid-list">
      <div>
        <dt>Execution lane</dt>
        <dd>${escapeHtml(strategy.executionLane)}</dd>
      </div>
      <div>
        <dt>Budget policy</dt>
        <dd>${escapeHtml(strategy.paymentPolicy)}</dd>
      </div>
      <div class="strategy-wide">
        <dt>Route policy</dt>
        <dd>${escapeHtml(strategy.routePolicy)}</dd>
      </div>
      <div class="strategy-wide">
        <dt>Treasury guardrail</dt>
        <dd>${escapeHtml(strategy.budgetPolicy || "Treasury guardrails will appear here.")}</dd>
      </div>
      <div>
        <dt>Treasury loop</dt>
        <dd>${escapeHtml(strategy.treasuryLoop || "Scout -> Route -> Fund -> Hire -> Prove")}</dd>
      </div>
      <div class="strategy-wide">
        <dt>Proof policy</dt>
        <dd>${escapeHtml(strategy.proofPolicy)}</dd>
      </div>
    </div>
    <div class="tag-row">
      ${strategy.protocols
        .map((protocol) => `<span class="tag-pill">${escapeHtml(protocol)}</span>`)
        .join("")}
    </div>
  `;
}

function renderPipeline() {
  if (!state.task || state.task.steps.length === 0) {
    pipeline.className = "pipeline-list empty-state";
    pipeline.innerHTML =
      "<p>No workflow running yet. Launch a task to watch the orchestration path.</p>";
    return;
  }

  pipeline.className = "pipeline-list";
  pipeline.innerHTML = state.task.steps
    .map(
      (step, index) => `
        <article class="step-card step-${escapeHtml(step.type)}">
          <div class="step-index">${index + 1}</div>
          <div class="step-body">
            <div class="step-top">
              <h3>${escapeHtml(step.title)}</h3>
              <span class="step-status">${escapeHtml(step.status)}</span>
            </div>
            <p>${escapeHtml(step.detail)}</p>
            <span class="step-time">${new Date(step.timestamp).toLocaleTimeString()}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderOpportunities() {
  const lanes = state.task?.opportunities || state.opportunities;
  if (!lanes.length) {
    opportunities.className = "opportunities-list empty-state";
    opportunities.innerHTML = "<p>Opportunity lanes will appear here after the app loads.</p>";
    return;
  }

  opportunities.className = "opportunities-list";
  opportunities.innerHTML = lanes
    .map(
      (lane) => `
        <article class="opportunity-card">
          <div class="opportunity-top">
            <strong>${escapeHtml(lane.title)}</strong>
            <span class="opportunity-status status-${escapeHtml(lane.status)}">${escapeHtml(lane.status)}</span>
          </div>
          <p>${escapeHtml(lane.thesis)}</p>
          <span class="opportunity-route">${escapeHtml(lane.route)}</span>
        </article>
      `
    )
    .join("");
}

function renderTransactions() {
  if (!state.task || state.task.transactions.length === 0) {
    transactions.className = "tx-list empty-state";
    transactions.innerHTML =
      "<p>Evidence entries will appear here as the protocol lane advances.</p>";
    return;
  }

  transactions.className = "tx-list";
  transactions.innerHTML = state.task.transactions
    .map(
      (tx) => `
        <article class="tx-card">
          <div class="tx-head">
            <strong>${escapeHtml(tx.label)}</strong>
            <span>${escapeHtml(tx.amount)}</span>
          </div>
          <p>${escapeHtml(tx.from)} -> ${escapeHtml(tx.to)}</p>
          <div class="tx-foot">
            <span>${escapeHtml(tx.network)}</span>
            <a href="${escapeHtml(tx.explorerUrl)}" target="_blank" rel="noreferrer">${escapeHtml(
              tx.linkLabel || "details"
            )}</a>
          </div>
        </article>
      `
    )
    .join("");
}

function renderReceipt() {
  if (!state.task || !state.task.receipt) {
    receipt.className = "receipt-card empty-state";
    receipt.innerHTML =
      "<p>No receipt minted yet. Complete a workflow to see the final artifact.</p>";
    return;
  }

  receipt.className = "receipt-card";
  receipt.innerHTML = `
    <div class="receipt-top">
      <span class="receipt-kicker">Receipt token</span>
      <strong>${escapeHtml(state.task.receipt.tokenId)}</strong>
    </div>
    <dl class="receipt-grid-list">
      <div>
        <dt>Total paid</dt>
        <dd>${escapeHtml(state.task.receipt.totalPaid)}</dd>
      </div>
      <div>
        <dt>Agents involved</dt>
        <dd>${escapeHtml(String(state.task.receipt.agentCount))}</dd>
      </div>
      <div class="receipt-wide">
        <dt>Protocol lane</dt>
        <dd>${escapeHtml(state.task.receipt.protocolLane)}</dd>
      </div>
      <div class="receipt-wide">
        <dt>Task hash</dt>
        <dd>${escapeHtml(state.task.receipt.taskHash)}</dd>
      </div>
      <div>
        <dt>Live hires</dt>
        <dd>${escapeHtml(String(state.task.receipt.liveSpecialistCount || 0))}</dd>
      </div>
    </dl>
    <p class="receipt-thesis">${escapeHtml(state.task.receipt.thesis)}</p>
    <div class="receipt-payouts">
      ${state.task.receipt.payoutMap
        .map(
          (payout) => `
            <div class="receipt-pill">
              <a href="${escapeHtml(payout.cardUrl)}" target="_blank" rel="noreferrer">${escapeHtml(payout.worker)}</a>
              <strong>${escapeHtml(payout.amount)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
    <div class="receipt-actions">
      <a class="receipt-download" href="${escapeHtml(state.task.receipt.downloadUrl)}" target="_blank" rel="noreferrer">
        Download receipt JSON
      </a>
      <a class="receipt-download" href="${escapeHtml(state.task.receipt.artifactUrl || `/artifacts/receipts/${state.task.id}.json`)}" target="_blank" rel="noreferrer">
        Open proof artifact
      </a>
    </div>
  `;
}

function renderFinalOutput() {
  if (!state.task || !state.task.finalOutput) {
    finalOutput.className = "output-card empty-state";
    finalOutput.textContent =
      "Results from Scout, Trader, and the specialist workers will land here.";
    return;
  }

  finalOutput.className = "output-card";
  finalOutput.textContent = state.task.finalOutput;
}

function renderBalances() {
  if (!state.task || !state.task.balancesBefore || !state.task.balancesAfter) {
    balances.className = "balances-list empty-state";
    balances.innerHTML =
      "<p>Run a workflow to compare agent balances before and after settlement.</p>";
    return;
  }

  const beforeMap = new Map(state.task.balancesBefore.map((agent) => [agent.id, agent]));
  const afterMap = new Map(state.task.balancesAfter.map((agent) => [agent.id, agent]));

  balances.className = "balances-list";
  balances.innerHTML = Array.from(afterMap.values())
    .map((agent) => {
      const before = beforeMap.get(agent.id);
      const delta = Number((agent.balance - before.balance).toFixed(3));
      const deltaClass = delta > 0 ? "delta-up" : delta < 0 ? "delta-down" : "delta-flat";

      return `
        <article class="balance-card">
          <div>
            <strong>${escapeHtml(agent.name)}</strong>
            <span>${escapeHtml(agent.wallet)}</span>
          </div>
          <div class="balance-values">
            <span>${before.balance.toFixed(3)} -> ${agent.balance.toFixed(3)} USD</span>
            <strong class="${deltaClass}">${formatDelta(before.balance, agent.balance)}</strong>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderReadiness() {
  if (!state.integration) {
    readiness.className = "readiness-list empty-state";
    readiness.innerHTML = "<p>Environment checks will appear here after the app loads.</p>";
    return;
  }

  readiness.className = "readiness-list";
  const liveCards = [];

  if (state.live?.wallet) {
    const holdings = state.live.wallet.tokens
      .map((token) => `${token.balance} ${token.symbol}`)
      .join(", ");
    liveCards.push(`
      <article class="readiness-card">
        <div class="readiness-top">
          <strong>Live wallet</strong>
          <span class="readiness-status ready">active</span>
        </div>
        <p>${escapeHtml(state.live.wallet.address)} · ${escapeHtml(holdings)}</p>
        <code>$${escapeHtml(String(state.live.wallet.accountValueUsd.toFixed(2)))} on X Layer</code>
      </article>
    `);
  }

  if (state.live?.quote) {
    const route = state.live.quote.route.map((item) => item.dexName).join(" -> ");
    liveCards.push(`
      <article class="readiness-card">
        <div class="readiness-top">
          <strong>Live route</strong>
          <span class="readiness-status ready">quoted</span>
        </div>
        <p>${escapeHtml(state.live.quote.fromAmount)} ${escapeHtml(state.live.quote.fromSymbol)} -> ${escapeHtml(
          state.live.quote.toAmount
        )} ${escapeHtml(state.live.quote.toSymbol)}</p>
        <code>${escapeHtml(route)}</code>
      </article>
    `);
  }

  if (state.live?.x402) {
    liveCards.push(`
      <article class="readiness-card">
        <div class="readiness-top">
          <strong>x402 seller rail</strong>
          <span class="readiness-status ${state.live.x402.ready ? "ready" : "pending"}">
            ${state.live.x402.ready ? "primed" : "setup"}
          </span>
        </div>
        <p>${escapeHtml(state.live.x402.settlementAsset)} -> ${escapeHtml(state.live.x402.payoutWallet || "missing payout wallet")}</p>
        <code>${escapeHtml(`${state.live.x402.supportedCount || 0} supported payment schemes cached`)}</code>
      </article>
    `);
  }

  if (state.live?.error) {
    liveCards.push(`
      <article class="readiness-card">
        <div class="readiness-top">
          <strong>Live integration</strong>
          <span class="readiness-status pending">degraded</span>
        </div>
        <p>${escapeHtml(state.live.error)}</p>
        <code>live context fallback in use</code>
      </article>
    `);
  }

  readiness.innerHTML = `${liveCards.join("")}${state.integration.checks
    .map(
      (check) => `
        <article class="readiness-card">
          <div class="readiness-top">
            <strong>${escapeHtml(check.label)}</strong>
            <span class="readiness-status ${check.ready ? "ready" : "pending"}">
              ${check.ready ? "ready" : "pending"}
            </span>
          </div>
          <p>${escapeHtml(check.note)}</p>
          <code>${escapeHtml(check.env)}</code>
        </article>
      `
    )
    .join("")}`;
}

function renderOrganization() {
  const wallets = state.organization.length ? state.organization : state.live?.organization || [];

  if (!wallets.length) {
    orgWallets.className = "org-list empty-state";
    orgWallets.innerHTML = "<p>Organization wallets will appear here after the app loads.</p>";
    return;
  }

  orgWallets.className = "org-list";
  orgWallets.innerHTML = wallets
    .map((wallet) => {
      const holdings = wallet.holdings?.length
        ? wallet.holdings.map((token) => `${token.balance} ${token.symbol}`).join(", ")
        : "No holdings yet";
      const route = wallet.quote?.route?.length
        ? wallet.quote.route.map((item) => item.dexName).join(" -> ")
        : "No live quote attached";

      return `
        <article class="org-card">
          <div class="org-top">
            <strong>${escapeHtml(wallet.name)}</strong>
            <span>${escapeHtml(wallet.role)}</span>
          </div>
          <p class="org-wallet">${escapeHtml(wallet.wallet)}</p>
          <div class="org-meta">
            <span>Account: ${escapeHtml(wallet.accountId)}</span>
            <span>Value: ${escapeHtml(wallet.valueUsd.toFixed(2))} USD</span>
          </div>
          <p class="org-holdings">${escapeHtml(holdings)}</p>
          <code>${escapeHtml(route)}</code>
        </article>
      `;
    })
    .join("");
}

function renderFundingProof() {
  const ledger = state.fundingLedger || state.live?.fundingLedger;

  if (!ledger?.transfers?.length) {
    fundingProof.className = "proof-list empty-state";
    fundingProof.innerHTML = "<p>Seed funding transfers will appear here after the app loads.</p>";
    return;
  }

  fundingProof.className = "proof-list";
  fundingProof.innerHTML = ledger.transfers
    .map((transfer) => {
      const assets = transfer.assets
        .map((asset) => {
          const tx = asset.txHash
            ? `<a href="https://www.oklink.com/xlayer/tx/${escapeHtml(asset.txHash)}" target="_blank" rel="noreferrer">${escapeHtml(asset.txHash.slice(0, 12))}...</a>`
            : "<span>seeded</span>";

          return `
            <div class="proof-asset">
              <strong>${escapeHtml(asset.amount)} ${escapeHtml(asset.symbol)}</strong>
              ${tx}
            </div>
          `;
        })
        .join("");

      return `
        <article class="proof-card">
          <div class="proof-top">
            <strong>${escapeHtml(transfer.role)}</strong>
            <span>${escapeHtml(transfer.address)}</span>
          </div>
          <div class="proof-assets">${assets}</div>
        </article>
      `;
    })
    .join("");
}

function renderLivePurchases() {
  const purchases = state.livePurchases?.purchases || state.live?.livePurchases?.purchases || [];

  if (!purchases.length) {
    livePurchases.className = "proof-list empty-state";
    livePurchases.innerHTML = "<p>Live specialist purchases will appear here after the first settlement lands.</p>";
    return;
  }

  livePurchases.className = "proof-list";
  livePurchases.innerHTML = purchases
    .map((purchase) => {
      const txHash =
        purchase.settle?.txHash ||
        purchase.settle?.transactionHash ||
        purchase.settle?.hash ||
        purchase.verify?.txHash ||
        "";
      const txLink = txHash
        ? `<a href="https://www.oklink.com/xlayer/tx/${escapeHtml(txHash)}" target="_blank" rel="noreferrer">${escapeHtml(txHash.slice(0, 12))}...</a>`
        : "<span>pending proof</span>";

      return `
        <article class="proof-card">
          <div class="proof-top">
            <strong>${escapeHtml(purchase.workerName)}</strong>
            <span>${escapeHtml(purchase.payerName)} -> ${escapeHtml(purchase.payTo)}</span>
          </div>
          <div class="proof-assets">
            <div class="proof-asset">
              <strong>${escapeHtml(purchase.amountDisplay || `${purchase.paymentRequirements?.maxAmountRequired || "0"} units`)}</strong>
              <span>${escapeHtml(purchase.paymentRequirements?.description || "specialist purchase")}</span>
            </div>
            <div class="proof-asset">
              <strong>${escapeHtml(purchase.status || "recorded")}</strong>
              ${txLink}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderProofLedger() {
  const proof = state.proof || state.live?.proof;

  if (!proof) {
    proofLedger.className = "proof-list empty-state";
    proofLedger.innerHTML =
      "<p>Proof registrations and task writes will appear here after the proof layer is connected.</p>";
    return;
  }

  const registrations = Array.isArray(proof.registrations) ? proof.registrations : [];
  const taskProofs = Array.isArray(proof.taskProofs) ? proof.taskProofs : [];

  if (!registrations.length && !taskProofs.length) {
    const deploymentTxs = [];
    if (proof.deployment?.registry?.tx?.txHash) {
      deploymentTxs.push(`
        <div class="proof-asset">
          <strong>Registry deploy tx</strong>
          <a href="https://www.oklink.com/xlayer/tx/${escapeHtml(proof.deployment.registry.tx.txHash)}" target="_blank" rel="noreferrer">${escapeHtml(proof.deployment.registry.tx.txHash.slice(0, 12))}...</a>
        </div>
      `);
    }
    if (proof.deployment?.receipt?.tx?.txHash) {
      deploymentTxs.push(`
        <div class="proof-asset">
          <strong>Receipt deploy tx</strong>
          <a href="https://www.oklink.com/xlayer/tx/${escapeHtml(proof.deployment.receipt.tx.txHash)}" target="_blank" rel="noreferrer">${escapeHtml(proof.deployment.receipt.tx.txHash.slice(0, 12))}...</a>
        </div>
      `);
    }

    proofLedger.className = "proof-list";
    proofLedger.innerHTML = `
      <article class="proof-card">
        <div class="proof-top">
          <strong>Proof contracts</strong>
          <span>${escapeHtml(proof.ready ? "ready for writes" : "addresses pending")}</span>
        </div>
        <div class="proof-assets">
          <div class="proof-asset">
            <strong>Registry</strong>
            <span>${escapeHtml(proof.registryAddress || "missing")}</span>
          </div>
          <div class="proof-asset">
            <strong>Receipt</strong>
            <span>${escapeHtml(proof.receiptAddress || "missing")}</span>
          </div>
          ${deploymentTxs.join("")}
        </div>
      </article>
    `;
    return;
  }

  proofLedger.className = "proof-list";
  proofLedger.innerHTML = `
    <article class="proof-card">
      <div class="proof-top">
        <strong>Proof contracts</strong>
        <span>${escapeHtml(proof.ready ? "ready for writes" : "addresses pending")}</span>
      </div>
      <div class="proof-assets">
        <div class="proof-asset">
          <strong>Registry</strong>
          <span>${escapeHtml(proof.registryAddress || "missing")}</span>
        </div>
        <div class="proof-asset">
          <strong>Receipt</strong>
          <span>${escapeHtml(proof.receiptAddress || "missing")}</span>
        </div>
        ${
          proof.deployment?.registry?.tx?.txHash
            ? `
              <div class="proof-asset">
                <strong>Registry deploy tx</strong>
                <a href="https://www.oklink.com/xlayer/tx/${escapeHtml(proof.deployment.registry.tx.txHash)}" target="_blank" rel="noreferrer">${escapeHtml(proof.deployment.registry.tx.txHash.slice(0, 12))}...</a>
              </div>
            `
            : ""
        }
        ${
          proof.deployment?.receipt?.tx?.txHash
            ? `
              <div class="proof-asset">
                <strong>Receipt deploy tx</strong>
                <a href="https://www.oklink.com/xlayer/tx/${escapeHtml(proof.deployment.receipt.tx.txHash)}" target="_blank" rel="noreferrer">${escapeHtml(proof.deployment.receipt.tx.txHash.slice(0, 12))}...</a>
              </div>
            `
            : ""
        }
      </div>
    </article>
    ${registrations
      .slice(0, 4)
      .map(
        (entry) => `
          <article class="proof-card">
            <div class="proof-top">
              <strong>Agent registration</strong>
              <span>${escapeHtml(entry.agentId || "unknown")}</span>
            </div>
            <div class="proof-assets">
              <div class="proof-asset">
                <strong>Wallet</strong>
                <span>${escapeHtml(entry.wallet || "missing")}</span>
              </div>
              <div class="proof-asset">
                <strong>Tx</strong>
                <span>${escapeHtml(entry.tx?.txHash || entry.tx?.hash || "pending")}</span>
              </div>
            </div>
          </article>
        `
      )
      .join("")}
    ${taskProofs
      .slice(0, 4)
      .map(
        (entry) => `
          <article class="proof-card">
            <div class="proof-top">
              <strong>Task proof write</strong>
              <span>${escapeHtml(entry.taskId || "unknown task")}</span>
            </div>
            <div class="proof-assets">
              <div class="proof-asset">
                <strong>Proof hash</strong>
                <span>${escapeHtml(entry.proofTaskHash || "missing")}</span>
              </div>
              <div class="proof-asset">
                <strong>Outputs</strong>
                <span>${escapeHtml(Object.keys(entry.outputs || {}).join(" + ") || "pending")}</span>
              </div>
            </div>
          </article>
        `
      )
      .join("")}
  `;
}

function renderPurchaseToolbar() {
  purchaseStatus.textContent = state.purchaseStatus;
  purchaseStatus.className = `purchase-status ${state.purchaseBusy ? "is-busy" : ""}`;
  livePurchaseButtons.forEach((button) => {
    button.disabled = state.purchaseBusy;
    button.textContent = state.purchaseBusy ? "Submitting..." : button.dataset.liveWorker === "codeReviewer"
      ? "Hire CodeReviewer"
      : button.dataset.liveWorker === "translator"
        ? "Hire Translator"
        : "Hire Summarizer";
  });
}

function renderAll() {
  metricStatus.textContent = state.task ? state.task.status : "Idle";
  metricReady.textContent = state.integration
    ? `${state.integration.readyCount} / ${state.integration.total}`
    : "0 / 0";
  renderAgents();
  renderStack();
  renderStrategy();
  renderPipeline();
  renderOpportunities();
  renderTransactions();
  renderReceipt();
  renderFinalOutput();
  renderBalances();
  renderReadiness();
  renderOrganization();
  renderFundingProof();
  renderLivePurchases();
  renderProofLedger();
  renderPurchaseToolbar();
}

async function loadAgents() {
  const payload = await fetchJson("/api/agents");
  state.agents = payload.agents;
  renderAll();
}

async function loadStatus() {
  const payload = await fetchJson("/api/status");
  state.integration = payload.integration;
  state.stack = payload.stack || [];
  state.opportunities = payload.opportunities || [];
  state.live = payload.live || null;
  state.organization = payload.live?.organization || [];
  state.fundingLedger = payload.live?.fundingLedger || null;
  state.livePurchases = payload.live?.livePurchases || null;
  state.proof = payload.live?.proof || null;
  if (!state.agents.length) {
    state.agents = payload.agents;
  }
  renderAll();
}

async function loadLiveSummary() {
  const payload = await fetchJson("/api/live/summary");
  state.live = payload.live || null;
  state.organization = payload.live?.organization || [];
  state.fundingLedger = payload.live?.fundingLedger || null;
  state.livePurchases = payload.live?.livePurchases || null;
  state.proof = payload.live?.proof || null;
  if (payload.agents) {
    state.agents = payload.agents;
  }
  renderAll();
}

async function triggerLivePurchase(workerId) {
  const worker = state.agents.find((agent) => agent.id === workerId);
  state.purchaseBusy = true;
  state.purchaseStatus = `Submitting a live x402 purchase for ${worker?.name || workerId}...`;
  renderAll();

  try {
    const payload = await fetchJson("/api/live/purchases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ workerId })
    });

    state.livePurchases = payload.purchases || state.livePurchases;
    state.live = payload.live || state.live;
    state.organization = payload.live?.organization || state.organization;
    state.fundingLedger = payload.live?.fundingLedger || state.fundingLedger;
    state.proof = payload.live?.proof || state.proof;
    const txHash = payload.record?.settle?.[0]?.txHash || "pending proof";
    state.purchaseStatus = `${payload.record?.workerName || workerId} settled successfully on X Layer: ${txHash}`;
  } catch (error) {
    state.purchaseStatus = `Live purchase failed: ${error.message}`;
  } finally {
    state.purchaseBusy = false;
    renderAll();
  }
}

async function pollTask() {
  if (!state.taskId) {
    return;
  }

  const payload = await fetchJson(`/api/tasks/${state.taskId}`);
  state.task = payload.task;

  if (payload.task.balancesAfter) {
    state.agents = payload.task.balancesAfter;
  }

  renderAll();

  if (payload.task.status === "completed" && state.pollHandle) {
    window.clearInterval(state.pollHandle);
    state.pollHandle = null;
  }
}

async function submitTask(input) {
  const payload = await fetchJson("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ input, liveSpend: Boolean(liveSpendToggle?.checked) })
  });

  state.taskId = payload.taskId;
  state.task = {
    status: "running",
    selectedWorkerIds: [],
    steps: [],
    transactions: [],
    liveSpendRequested: Boolean(liveSpendToggle?.checked)
  };

  renderAll();
  await pollTask();

  if (state.pollHandle) {
    window.clearInterval(state.pollHandle);
  }

  state.pollHandle = window.setInterval(() => {
    pollTask().catch((error) => {
      console.error(error);
      window.clearInterval(state.pollHandle);
      state.pollHandle = null;
    });
  }, 800);
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = taskInput.value.trim();

  if (!input) {
    taskInput.focus();
    return;
  }

  submitTask(input).catch((error) => {
    alert(error.message);
  });
});

livePurchaseButtons.forEach((button) => {
  button.addEventListener("click", () => {
    triggerLivePurchase(button.dataset.liveWorker).catch((error) => {
      state.purchaseBusy = false;
      state.purchaseStatus = `Live purchase failed: ${error.message}`;
      renderAll();
    });
  });
});

document.querySelectorAll("[data-preset]").forEach((button) => {
  button.addEventListener("click", () => {
    taskInput.value = button.dataset.preset || "";
    taskInput.focus();
  });
});

Promise.all([loadStatus(), loadAgents(), loadLiveSummary()]).catch((error) => {
  console.error(error);
  pipeline.className = "pipeline-list empty-state";
  pipeline.innerHTML = `<p>Failed to load app state: ${escapeHtml(error.message)}</p>`;
});
