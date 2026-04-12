const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { getLiveExecutionContext } = require("./lib/live-okx");
const { buildTaskProofHash } = require("./lib/proof-contracts");
const { readProofDeployment } = require("./lib/proof-deployments");
const {
  buildBuyerAccepts,
  buildPaymentRequirements,
  fetchSupported,
  getApiConfig,
  getStableConfig,
  settlePayment,
  verifyPayment
} = require("./lib/okx-x402");

const ENV_FILE = path.join(__dirname, ".env");
const FUNDING_LEDGER_FILE = path.join(__dirname, "funding-ledger.json");
const LIVE_PURCHASES_FILE = path.join(__dirname, "live-purchases.json");
const PROOF_LEDGER_FILE = path.join(__dirname, "proof-ledger.json");
const X402_CACHE_FILE = path.join(__dirname, "x402-cache.json");
const ARTIFACTS_DIR = path.join(__dirname, "artifacts");
const RECEIPT_ARTIFACTS_DIR = path.join(ARTIFACTS_DIR, "receipts");

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    return;
  }

  const contents = fs.readFileSync(ENV_FILE, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function getEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return value;
    }
  }

  return "";
}

loadEnvFile();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const AGENT_CARD_DIR = path.join(PUBLIC_DIR, "agent-cards");
const PAYMENT_SYMBOL = getEnvValue("X402_SETTLEMENT_SYMBOL") || "USDT";

const AGENTS = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    role: "Command router",
    skill: "workflow-planning",
    accountId: "095cbe13-ef3e-4969-9858-fa3566ea4f56",
    wallet: "0x90ec52fe001a5b59b356eb55ffb6931b7c37db26",
    price: null,
    balance: 23.49,
    accent: "ember",
    metadataPath: "/agent-cards/orchestrator.json",
    endpoint: "/workers/orchestrator"
  },
  {
    id: "scout",
    name: "Scout",
    role: "Market scouting",
    skill: "okx-market-intel",
    accountId: "0fc75072-b5dd-4490-a650-0e6347fe2e38",
    wallet: "0x399b67977ec2b478568a9ecb7a27cb48c2d99ecb",
    price: null,
    balance: 1.85,
    accent: "sky",
    metadataPath: "/agent-cards/scout.json",
    endpoint: "/workers/scout"
  },
  {
    id: "trader",
    name: "Trader",
    role: "Route execution",
    skill: "uniswap-route-planning",
    accountId: "ba91c05f-288b-40d3-94e2-544acb6a79e2",
    wallet: "0x7bd1931968132d893971b3f715c1153ddf70b3d5",
    price: null,
    balance: 6.71,
    accent: "rose",
    metadataPath: "/agent-cards/trader.json",
    endpoint: "/workers/trader"
  },
  {
    id: "translator",
    name: "Translator",
    role: "Paid worker",
    skill: "translation",
    wallet: "0xa3f4...9d21",
    price: 0.01,
    balance: 1.84,
    accent: "teal",
    metadataPath: "/agent-cards/translator.json",
    endpoint: "/workers/translator"
  },
  {
    id: "summarizer",
    name: "Summarizer",
    role: "Paid worker",
    skill: "summarization",
    wallet: "0xb12d...3a44",
    price: 0.005,
    balance: 2.16,
    accent: "gold",
    metadataPath: "/agent-cards/summarizer.json",
    endpoint: "/workers/summarizer"
  },
  {
    id: "codeReviewer",
    name: "CodeReviewer",
    role: "Paid worker",
    skill: "code-review",
    wallet: "0xc8e1...4b72",
    price: 0.02,
    balance: 0.91,
    accent: "mint",
    metadataPath: "/agent-cards/codeReviewer.json",
    endpoint: "/workers/codeReviewer"
  },
  {
    id: "treasury",
    name: "Treasury",
    role: "Settlement proof",
    skill: "receipt-minting",
    accountId: "78a68c07-30cf-41a2-b354-b482a15549d4",
    wallet: "0x86a031a0618b43a0269e0e20d504fca6fc3a149a",
    price: null,
    balance: 1.85,
    accent: "slate",
    metadataPath: "/agent-cards/treasury.json",
    endpoint: "/workers/treasury"
  }
];

const INTEGRATION_CHECKLIST = [
  {
    id: "xlayer-rpc",
    label: "X Layer RPC",
    envs: ["XLAYER_RPC_URL"],
    note: "Required for live contract writes and balance reads."
  },
  {
    id: "registry-address",
    label: "Registry contract",
    envs: ["SKILLMESH_REGISTRY_ADDRESS"],
    note: "Target address for task completion proof writes."
  },
  {
    id: "receipt-address",
    label: "Receipt contract",
    envs: ["SKILLMESH_RECEIPT_ADDRESS"],
    note: "Target address for receipt minting."
  },
  {
    id: "okx-api-key",
    label: "OKX API key",
    envs: ["OKX_API_KEY", "OK_API_KEY", "ONCHAIN_OS_API_KEY"],
    note: "Needed for authenticated calls to the OKX payment stack."
  },
  {
    id: "okx-secret-key",
    label: "OKX secret key",
    envs: ["OKX_SECRET_KEY", "OK_SECRET_KEY"],
    note: "Required for request signing."
  },
  {
    id: "okx-passphrase",
    label: "OKX passphrase",
    envs: ["OKX_PASSPHRASE"],
    note: "Required alongside the API and secret keys."
  },
  {
    id: "x402-facilitator",
    label: "x402 facilitator",
    envs: ["X402_FACILITATOR_URL"],
    note: "Required for replacing mock payment events."
  }
];

const TASKS = new Map();
const LIVE_CONTEXT = {
  snapshot: null,
  error: null,
  refreshedAt: 0
};
const ORG_CONTEXT = {
  snapshots: {},
  error: null,
  refreshedAt: 0
};
const X402_CONTEXT = {
  supported: null,
  error: null,
  refreshedAt: 0
};

function readFundingLedger() {
  if (!fs.existsSync(FUNDING_LEDGER_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(FUNDING_LEDGER_FILE, "utf8"));
  } catch (error) {
    return null;
  }
}

function readX402Cache() {
  if (!fs.existsSync(X402_CACHE_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(X402_CACHE_FILE, "utf8"));
  } catch (error) {
    return null;
  }
}

function readProofLedger() {
  if (!fs.existsSync(PROOF_LEDGER_FILE)) {
    return { updatedAt: null, registrations: [], taskProofs: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(PROOF_LEDGER_FILE, "utf8"));
  } catch (error) {
    return { updatedAt: null, registrations: [], taskProofs: [] };
  }
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function readLivePurchases() {
  if (!fs.existsSync(LIVE_PURCHASES_FILE)) {
    return { purchases: [] };
  }

  try {
    const payload = JSON.parse(fs.readFileSync(LIVE_PURCHASES_FILE, "utf8"));
    return {
      purchases: Array.isArray(payload?.purchases) ? payload.purchases : [],
      updatedAt: payload?.updatedAt || null
    };
  } catch (error) {
    return { purchases: [] };
  }
}

function getRelatedLivePurchases(task) {
  const ledger = readLivePurchases();
  if (!task?.id) {
    return [];
  }

  return ledger.purchases.filter((purchase) => purchase.taskId === task.id).slice(0, 5);
}

function runLivePurchase(options = {}) {
  const scriptPath = path.join(__dirname, "scripts", "live-x402-purchase.js");
  const args = [scriptPath];

  if (options.workerId) {
    args.push("--worker", options.workerId);
  }

  if (options.payerId) {
    args.push("--payer", options.payerId);
  }

  if (options.resource) {
    args.push("--resource", options.resource);
  }

  if (options.description) {
    args.push("--description", options.description);
  }

  if (options.taskId) {
    args.push("--task-id", options.taskId);
  }

  if (options.source) {
    args.push("--source", options.source);
  }

  if (options.syncSettle === false) {
    args.push("--async-settle");
  }

  return new Promise((resolve, reject) => {
    execFile(process.execPath, args, { cwd: __dirname, timeout: 120_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || stdout?.trim() || error.message));
        return;
      }

      try {
        const payload = JSON.parse(stdout);
        if (!payload.ok || !payload.record) {
          reject(new Error(payload.error || "Live purchase did not return a record"));
          return;
        }

        resolve(payload.record);
      } catch (parseError) {
        reject(new Error(`Live purchase returned invalid JSON: ${stdout}`));
      }
    });
  });
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const typeMap = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  };

  fs.readFile(filePath, (error, file) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": typeMap[ext] || "application/octet-stream"
    });
    res.end(file);
  });
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function formatUsd(value) {
  return `$${value.toFixed(3)} ${PAYMENT_SYMBOL}`;
}

function createHash() {
  return `0x${crypto.randomBytes(32).toString("hex")}`;
}

function getAgent(id) {
  return AGENTS.find((agent) => agent.id === id);
}

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

function buildPublicAgent(agent) {
  return {
    ...agent,
    balance: Number(agent.balance.toFixed(3)),
    metadataUrl: agent.metadataPath,
    cardApiUrl: `/api/agents/${agent.id}/card`,
    pricingLabel: agent.price == null ? "Internal" : formatUsd(agent.price)
  };
}

function cloneAgents(liveSnapshot = null, orgSnapshots = null) {
  const agents = AGENTS.map(buildPublicAgent);
  const liveWallets = {
    ...(orgSnapshots || {})
  };

  if (liveSnapshot) {
    liveWallets.orchestrator = liveSnapshot;
  }

  for (const agent of agents) {
    const snapshot = liveWallets[agent.id];
    if (!snapshot?.wallet?.address) {
      continue;
    }

    agent.wallet = snapshot.wallet.address;
    agent.balance = Number(snapshot.wallet.accountValueUsd || agent.balance);
  }

  return agents;
}

function copyAgentList(agentList) {
  return agentList.map((agent) => ({ ...agent }));
}

function getTaskAgent(task, agentId) {
  return task.runtimeAgents.find((agent) => agent.id === agentId);
}

function readAgentCard(agentId) {
  const filePath = path.join(AGENT_CARD_DIR, `${agentId}.json`);
  const contents = fs.readFileSync(filePath, "utf8");
  return JSON.parse(contents);
}

function getPaidWorkerIds(workerIds = []) {
  return workerIds.filter((workerId) => {
    const worker = getAgent(workerId);
    return Boolean(worker && worker.price != null);
  });
}

function getIntegrationStatus() {
  const deployment = readProofDeployment();
  const checks = INTEGRATION_CHECKLIST.map((item) => {
    const matchedEnv = item.envs.find((envName) => {
      const candidate = process.env[envName];
      return Boolean(candidate && String(candidate).trim());
    });

    let deploymentValue = null;
    if (item.id === "registry-address") {
      deploymentValue = deployment?.registry?.address || null;
    }
    if (item.id === "receipt-address") {
      deploymentValue = deployment?.receipt?.address || null;
    }

    return {
      ...item,
      env: matchedEnv || item.envs[0],
      ready: Boolean(matchedEnv || deploymentValue),
      source: matchedEnv ? "env" : deploymentValue ? "deployment" : "missing",
      value: deploymentValue || null
    };
  });

  const readyCount = checks.filter((item) => item.ready).length;
  return {
    mode: readyCount === checks.length ? "live-ready" : "prototype",
    readyCount,
    total: checks.length,
    checks
  };
}

async function refreshX402Supported(options = {}) {
  const { force = false } = options;
  const freshnessMs = 60_000;

  if (!force && Array.isArray(X402_CONTEXT.supported) && Date.now() - X402_CONTEXT.refreshedAt < freshnessMs) {
    return X402_CONTEXT.supported;
  }

  const config = getApiConfig();
  if (!config.ready) {
    return [];
  }

  try {
    const supported = await fetchSupported();
    X402_CONTEXT.supported = supported;
    X402_CONTEXT.error = null;
    X402_CONTEXT.refreshedAt = Date.now();
    return supported;
  } catch (error) {
    X402_CONTEXT.error = error;
    const cache = readX402Cache();
    if (Array.isArray(cache?.supported)) {
      X402_CONTEXT.supported = cache.supported;
      X402_CONTEXT.refreshedAt = cache.refreshedAt ? Date.parse(cache.refreshedAt) || Date.now() : Date.now();
      return cache.supported;
    }
    if (Array.isArray(X402_CONTEXT.supported)) {
      return X402_CONTEXT.supported;
    }
    return [];
  }
}

function buildX402Summary() {
  const config = getApiConfig();
  const stable = getStableConfig();
  const treasuryWallet = getAgent("treasury")?.wallet || "";
  const cache = readX402Cache();
  const supported = X402_CONTEXT.supported || cache?.supported || [];
  const cached = Array.isArray(cache?.supported) && cache.supported.length > 0;
  const specialistWorkers = AGENTS.filter((agent) => agent.price != null).map((worker) => ({
    id: worker.id,
    name: worker.name,
    amount: worker.price,
    settlementAsset: stable.symbol,
    payoutWallet: isEvmAddress(worker.wallet) ? worker.wallet : treasuryWallet
  }));

  return {
    ready: config.ready,
    payoutMode: "organizational-treasury-collection",
    payoutWallet: treasuryWallet,
    settlementAsset: stable.symbol,
    settlementAssetAddress: stable.asset,
    supportedCount: supported.length,
    supported,
    cachedAt: cache?.refreshedAt || null,
    source: cached ? "cached-supported-probe" : "live",
    error: supported.length ? null : X402_CONTEXT.error ? X402_CONTEXT.error.message : null,
    workers: specialistWorkers,
    livePurchases: readLivePurchases().purchases
  };
}

function buildProofSummary() {
  const ledger = readProofLedger();
  const deployment = readProofDeployment();
  const registryAddress = getEnvValue("SKILLMESH_REGISTRY_ADDRESS") || deployment?.registry?.address || null;
  const receiptAddress = getEnvValue("SKILLMESH_RECEIPT_ADDRESS") || deployment?.receipt?.address || null;
  return {
    registryAddress,
    receiptAddress,
    deployment: deployment || null,
    registrations: ledger.registrations || [],
    taskProofs: ledger.taskProofs || [],
    updatedAt: ledger.updatedAt || null,
    ready: Boolean(registryAddress && receiptAddress)
  };
}

function buildOrganizationSummary(snapshots = {}) {
  return AGENTS.filter((agent) => agent.accountId).map((agent) => {
    const snapshot = snapshots[agent.id];
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      accountId: agent.accountId,
      wallet: snapshot?.wallet?.address || agent.wallet,
      valueUsd: Number(snapshot?.wallet?.accountValueUsd || agent.balance || 0),
      holdings: (snapshot?.wallet?.tokens || []).map((token) => ({
        symbol: token.symbol,
        balance: token.balance,
        usdValue: token.usdValue
      })),
      quote: snapshot?.quote || null
    };
  });
}

function buildLiveSummary(snapshot, error = null, orgSnapshots = {}) {
  return {
    enabled: Boolean(snapshot || error),
    ready: Boolean(snapshot?.wallet),
    updatedAt: snapshot?.updatedAt || null,
    wallet: snapshot?.wallet || null,
    quote: snapshot?.quote || null,
    organization: buildOrganizationSummary(orgSnapshots),
    x402: buildX402Summary(),
    proof: buildProofSummary(),
    fundingLedger: readFundingLedger(),
    livePurchases: readLivePurchases(),
    error: error ? error.message : null
  };
}

async function refreshOrgContext(options = {}) {
  const { force = false } = options;
  const freshnessMs = 30_000;

  if (!force && Object.keys(ORG_CONTEXT.snapshots).length && Date.now() - ORG_CONTEXT.refreshedAt < freshnessMs) {
    return ORG_CONTEXT.snapshots;
  }

  const snapshots = {};

  try {
    for (const agent of AGENTS.filter((entry) => entry.accountId)) {
      snapshots[agent.id] = await getLiveExecutionContext({
        accountId: agent.accountId,
        includeQuote: agent.id === "trader"
      });
    }

    ORG_CONTEXT.snapshots = snapshots;
    ORG_CONTEXT.error = null;
    ORG_CONTEXT.refreshedAt = Date.now();
    return snapshots;
  } catch (error) {
    ORG_CONTEXT.error = error;
    if (Object.keys(ORG_CONTEXT.snapshots).length) {
      return ORG_CONTEXT.snapshots;
    }
    return {};
  }
}

async function refreshLiveContext(input = "", options = {}) {
  const { force = false } = options;
  const shouldQuote = analyzeIntent(input).trade || analyzeIntent(input).payAnyToken;
  const freshnessMs = 30_000;

  if (
    !force &&
    LIVE_CONTEXT.snapshot &&
    Date.now() - LIVE_CONTEXT.refreshedAt < freshnessMs &&
    (shouldQuote ? Boolean(LIVE_CONTEXT.snapshot.quote) : true)
  ) {
    return LIVE_CONTEXT.snapshot;
  }

  try {
    const snapshot = await getLiveExecutionContext({ includeQuote: shouldQuote });
    LIVE_CONTEXT.snapshot = snapshot;
    LIVE_CONTEXT.error = null;
    LIVE_CONTEXT.refreshedAt = Date.now();
    return snapshot;
  } catch (error) {
    LIVE_CONTEXT.error = error;
    if (LIVE_CONTEXT.snapshot) {
      return LIVE_CONTEXT.snapshot;
    }
    return null;
  }
}

function analyzeIntent(input) {
  const lowered = input.toLowerCase();
  return {
    translation:
      lowered.includes("translate") ||
      lowered.includes("translation") ||
      lowered.includes("中文") ||
      lowered.includes("英文") ||
      lowered.includes("翻译"),
    summary:
      lowered.includes("summary") ||
      lowered.includes("summarize") ||
      lowered.includes("brief") ||
      lowered.includes("摘要") ||
      lowered.includes("总结"),
    review:
      lowered.includes("code") ||
      lowered.includes("review") ||
      lowered.includes("bug") ||
      lowered.includes("refactor") ||
      lowered.includes("pull request") ||
      lowered.includes("repo"),
    trade:
      lowered.includes("trade") ||
      lowered.includes("swap") ||
      lowered.includes("route") ||
      lowered.includes("quote") ||
      lowered.includes("rebalance") ||
      lowered.includes("yield") ||
      lowered.includes("收益") ||
      lowered.includes("路径") ||
      lowered.includes("alpha") ||
      lowered.includes("token") ||
      lowered.includes("套利"),
    payAnyToken:
      lowered.includes("pay") ||
      lowered.includes("payment") ||
      lowered.includes("x402") ||
      lowered.includes("任意代币") ||
      lowered.includes("any token"),
    judge:
      lowered.includes("judge") ||
      lowered.includes("demo") ||
      lowered.includes("pitch") ||
      lowered.includes("评委") ||
      lowered.includes("演示")
  };
}

function pickWorkers(input) {
  const intent = analyzeIntent(input);
  const workers = ["scout"];

  if (intent.translation) {
    workers.push("translator");
  }

  if (intent.summary) {
    workers.push("summarizer");
  }

  if (intent.review) {
    workers.push("codeReviewer");
  }

  if (workers.length === 1) {
    workers.push("summarizer");
  }

  if (intent.trade || intent.payAnyToken || workers.some((workerId) => getAgent(workerId)?.price != null)) {
    workers.splice(1, 0, "trader");
  }

  return Array.from(new Set(workers));
}

function buildTaskPlan(input, selectedWorkers, intent) {
  const lane = selectedWorkers.map((worker) => worker.name).join(" -> ");
  return [
    `Normalize user intent from: "${input}"`,
    `Scout market context with OKX capabilities before any treasury spend decisions.`,
    `Plan the execution lane: ${lane}.`,
    intent.trade
      ? "Use Trader to compare route candidates and prepare a swap-friendly path that can strengthen or preserve the operating budget."
      : "Use Trader as a pay-with-any-token fallback so the organization can keep hiring specialists without treasury friction.",
    "Spend the organization treasury on specialist workers over x402, then write proof artifacts to X Layer."
  ];
}

function getProtocolStack() {
  const integration = getIntegrationStatus();
  const readyIds = new Set(integration.checks.filter((item) => item.ready).map((item) => item.id));
  const okxAuth =
    readyIds.has("okx-api-key") &&
    readyIds.has("okx-secret-key") &&
    readyIds.has("okx-passphrase");
  const x402Ready = okxAuth && readyIds.has("x402-facilitator");
  const xlayerReady = readyIds.has("xlayer-rpc");
  const proofReady =
    xlayerReady &&
    readyIds.has("registry-address") &&
    readyIds.has("receipt-address");

  return [
    {
      id: "okx-market",
      label: "OKX Market Intelligence",
      owner: "Scout",
      status: okxAuth ? "primed" : "setup",
      summary: "Token discovery, price snapshots, and wallet-aware market context."
    },
    {
      id: "okx-trade",
      label: "OKX Trade Execution",
      owner: "Trader",
      status: okxAuth ? "primed" : "setup",
      summary: "Supported chains, quotes, approvals, and swap construction."
    },
    {
      id: "uniswap-ai",
      label: "Uniswap AI Routing",
      owner: "Trader",
      status: "design-ready",
      summary: "Pathfinding, pay-with-any-token, and execution strategy composition."
    },
    {
      id: "x402",
      label: "x402 Settlement Rail",
      owner: "Workers",
      status: x402Ready ? "primed" : "setup",
      summary: "Per-call service settlement between agents in USDC."
    },
    {
      id: "xlayer",
      label: "X Layer Proof Layer",
      owner: "Treasury",
      status: proofReady ? "primed" : xlayerReady ? "partial" : "setup",
      summary: "Completion records, receipt minting, and proof-linked evidence."
    }
  ];
}

function getOpportunityRadar(input = "") {
  const intent = analyzeIntent(input);
  return [
    {
      id: "service-funding",
      title: "Self-Funding Loop",
      status: intent.payAnyToken || intent.trade ? "focus" : "armed",
      route: "Scout opportunity -> route treasury capital -> hire specialists -> keep the swarm funded",
      thesis: "Turn treasury assets into operating budget, then spend that budget on specialist intelligence."
    },
    {
      id: "alpha-lane",
      title: "Treasury Expansion Lane",
      status: intent.trade ? "focus" : "watch",
      route: "OKX market read -> route comparison -> swap-ready execution",
      thesis: "Let Scout and Trader convert raw market context into a capital move the organization can justify."
    },
    {
      id: "proof-lane",
      title: "Operational Proof Lane",
      status: intent.judge ? "focus" : "armed",
      route: "budget spend -> x402 settlement -> registry write -> receipt artifact",
      thesis: "Every treasury decision should end in a tx hash, receipt, or exportable proof artifact."
    }
  ];
}

function buildStrategy(input, selectedWorkers, intent) {
  const paidWorkers = selectedWorkers.filter((worker) => worker.price != null);
  const protocols = ["OKX Market", "OKX Trade", "Uniswap AI", "x402", "X Layer"];
  const executionLane = selectedWorkers.map((worker) => worker.name).join(" -> ");

  return {
    headline: intent.trade
      ? "Scout the market, route treasury capital, strengthen the operating budget, then hire specialist agents."
      : "Scout market context, preserve a self-funding treasury loop, then hire specialist agents over x402.",
    objective: input,
    executionLane,
    paymentPolicy: paidWorkers.length
      ? `Deploy treasury budget into ${paidWorkers.length} specialist worker call${paidWorkers.length > 1 ? "s" : ""} over x402.`
      : "No external specialist spend required.",
    routePolicy: intent.trade
      ? "Trader compares OKX trade context with Uniswap AI routing before any treasury deployment."
      : "Trader keeps a pay-with-any-token fallback ready so the organization can keep buying capability on asset mismatch.",
    budgetPolicy: "Only spend treasury budget after Scout and Trader produce enough context to justify the purchase.",
    treasuryLoop: "Scout -> Route -> Fund -> Hire -> Prove",
    proofPolicy: "Treasury records why budget was spent, who was hired, and what proof artifact was produced on X Layer.",
    protocols
  };
}

function addStep(task, partial) {
  task.steps.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    status: "done",
    ...partial
  });
}

function addTransaction(task, partial) {
  const transaction = {
    id: crypto.randomUUID(),
    hash: createHash(),
    timestamp: new Date().toISOString(),
    network: "X Layer",
    linkLabel: "details",
    mock: true,
    ...partial
  };
  task.transactions.unshift(transaction);
  return transaction;
}

function buildWorkerOutput(workerId, input, task) {
  const compact = input.replace(/\s+/g, " ").trim();
  const traderQuote = task.liveContext?.quote || task.orgSnapshots?.trader?.quote || null;

  if (workerId === "scout") {
    if (task.liveContext?.wallet) {
      const holdings = task.liveContext.wallet.tokens
        .map((token) => `${token.balance} ${token.symbol}`)
        .join(", ");
      return `OKX scout readout: live treasury wallet detected at ${task.liveContext.wallet.address}. Current operating reserves: ${holdings}.`;
    }

    return "OKX scout readout: market context is attached, the treasury loop is viable, and the orchestrator can proceed with a route-aware spend plan.";
  }

  if (workerId === "trader") {
    if (traderQuote) {
      const routeNames = traderQuote.route.map((item) => item.dexName).join(" -> ");
      return `Trader plan: live quote fetched for ${traderQuote.fromAmount} ${traderQuote.fromSymbol} -> ${traderQuote.toAmount} ${traderQuote.toSymbol} via ${routeNames}, keeping treasury deployment capital-aware.`;
    }

    return task.intent.trade
      ? "Trader plan: compare route candidates, request a quote, and keep a pay-with-any-token fallback ready before any specialist purchase or swap execution."
      : "Trader plan: precompute a Uniswap AI route so the organization can keep funding specialist work even if treasury inventory starts in the wrong asset.";
  }

  if (workerId === "translator") {
    return `ZH translation preview: ${compact.slice(0, 90)}${compact.length > 90 ? "..." : ""}`;
  }

  if (workerId === "summarizer") {
    return "Three-line summary: the request asks for a compact execution story, protocol clarity, and a final output that judges can scan in seconds.";
  }

  return "Code review summary: keep the OKX + Uniswap execution lane visible, preserve x402 as the service payment rail, and make proof artifacts first-class.";
}

function buildFinalOutput(task) {
  const livePurchases = getRelatedLivePurchases(task);
  return [
    `Strategy: ${task.strategy.headline}`,
    `Execution lane: ${task.strategy.executionLane}`,
    `Budget policy: ${task.strategy.paymentPolicy}`,
    `Treasury loop: ${task.strategy.treasuryLoop}`,
    "",
    ...task.workerOutputs.map((output) => `${output.workerName}: ${output.result}`),
    "",
    ...(livePurchases.length
      ? [
          "Live specialist proofs:",
          ...livePurchases.map(
            (purchase) =>
              `- ${purchase.workerName} settled ${purchase.amountDisplay} on X Layer (${purchase.settle?.[0]?.txHash || "pending"})`
          ),
          ""
        ]
      : []),
    `Proof lane: ${task.strategy.proofPolicy}`
  ].join("\n");
}

function buildReceiptExport(task) {
  const relatedLivePurchases = getRelatedLivePurchases(task);
  return {
    project: "SkillMesh Revenue Mesh",
    mode: getIntegrationStatus().mode,
    exportedAt: new Date().toISOString(),
    taskId: task.id,
    input: task.input,
    status: task.status,
    createdAt: task.createdAt,
    completedAt: task.completedAt || null,
    proofTaskHash: task.proofTaskHash,
    orchestrator: getTaskAgent(task, "orchestrator"),
    workers: task.selectedWorkerIds.map((workerId) => getTaskAgent(task, workerId)),
    plan: task.plan,
    strategy: task.strategy,
    stack: task.stack,
    opportunities: task.opportunities,
    liveSpendRequested: task.liveSpendRequested,
    liveSpendTargetId: task.liveSpendTargetId,
    steps: task.steps,
    transactions: task.transactions,
    livePurchases: relatedLivePurchases,
    live: buildLiveSummary(task.liveContext, null, ORG_CONTEXT.snapshots),
    organization: buildOrganizationSummary(ORG_CONTEXT.snapshots),
    fundingLedger: readFundingLedger(),
    receipt: task.receipt,
    receiptArtifactUrl: `/artifacts/receipts/${task.id}.json`,
    finalOutput: task.finalOutput
  };
}

function writeReceiptArtifact(task) {
  ensureDir(RECEIPT_ARTIFACTS_DIR);
  const filePath = path.join(RECEIPT_ARTIFACTS_DIR, `${task.id}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(buildReceiptExport(task), null, 2)}\n`);
}

function simulateTask(task) {
  const selectedWorkers = task.selectedWorkerIds.map((workerId) => getTaskAgent(task, workerId));
  const paidWorkers = selectedWorkers.filter((worker) => worker.price != null);
  const orchestrator = getTaskAgent(task, "orchestrator");
  const treasury = getTaskAgent(task, "treasury");
  const scout = getTaskAgent(task, "scout");
  const trader = getTaskAgent(task, "trader");
  const timeline = [];

  timeline.push(() => {
    addStep(task, {
      type: "orchestrator",
      title: "Mission accepted by Orchestrator",
      detail: "Natural-language request ingested and queued as a treasury-aware execution mission."
    });
  });

  timeline.push(() => {
    const walletSummary = task.liveContext?.wallet;
    const marketEvent = addTransaction(task, {
      type: "market",
      label: walletSummary ? "OKX Market live wallet snapshot" : "OKX Market scout snapshot",
      amount: walletSummary ? `$${walletSummary.accountValueUsd.toFixed(2)} wallet value` : "signal read",
      from: scout.wallet,
      to: "OKX Market Skills",
      network: "OKX Market",
      explorerUrl: "https://web3.okx.com/onchainos/dev-docs/home/skills-mcp-services",
      linkLabel: "skills docs",
      mock: false
    });

    task.workerOutputs.push({
      workerId: scout.id,
      workerName: scout.name,
      cardUrl: scout.metadataPath,
      paymentAmount: "Internal",
      result: buildWorkerOutput(scout.id, task.input, task)
    });

    addStep(task, {
      type: "market",
      title: "Scout attached OKX market context",
      detail: walletSummary
        ? `Live treasury wallet ${walletSummary.address} currently holds ${walletSummary.tokens
            .map((token) => `${token.balance} ${token.symbol}`)
            .join(", ")}. Evidence id: ${marketEvent.hash.slice(0, 12)}...`
        : `Captured token discovery and funding cues before execution. Evidence id: ${marketEvent.hash.slice(0, 12)}...`
    });
  });

  if (task.selectedWorkerIds.includes("trader")) {
    timeline.push(() => {
      const quote = task.liveContext?.quote || task.orgSnapshots?.trader?.quote || null;
      const routeDetail = quote?.route.map((item) => item.dexName).join(" -> ");
      const routeEvent = addTransaction(task, {
        type: "route",
        label: quote ? "Uniswap + OKX live route quote" : "Uniswap AI route planner",
        amount: quote
          ? `${quote.fromAmount} ${quote.fromSymbol} -> ${quote.toAmount} ${quote.toSymbol}`
          : "pay-with-any-token path",
        from: trader.wallet,
        to: "Uniswap AI",
        network: "Uniswap AI",
        explorerUrl: "https://github.com/Uniswap/uniswap-ai",
        linkLabel: "repo",
        mock: false
      });

      task.workerOutputs.push({
        workerId: trader.id,
        workerName: trader.name,
        cardUrl: trader.metadataPath,
        paymentAmount: "Internal",
        result: buildWorkerOutput(trader.id, task.input, task)
      });

      addStep(task, {
        type: "route",
        title: "Trader prepared the execution route",
        detail: quote
          ? `Fetched a live X Layer quote through ${routeDetail}. Price impact ${quote.priceImpactPercent}%. The route is ready to support the organization budget loop. Route id: ${routeEvent.hash.slice(0, 12)}...`
          : task.intent.trade
            ? `Compared route candidates and staged a swap-friendly path. Route id: ${routeEvent.hash.slice(0, 12)}...`
            : `Prepared a funding fallback so x402 settlements can execute even on asset mismatch. Route id: ${routeEvent.hash.slice(0, 12)}...`
      });
    });
  }

  if (task.intent.trade) {
    timeline.push(() => {
      const quote = task.liveContext?.quote || task.orgSnapshots?.trader?.quote || null;
      addTransaction(task, {
        type: "swap",
        label: "Trader staged swap execution",
        amount: quote ? `${quote.toAmount} ${quote.toSymbol} target output` : "quote + swap payload",
        from: orchestrator.wallet,
        to: "Universal Router",
        network: "X Layer",
        explorerUrl: `https://www.oklink.com/xlayer/tx/${createHash()}`,
        linkLabel: "mock explorer"
      });

      addStep(task, {
        type: "swap",
        title: "Swap-ready payload prepared",
        detail: quote
          ? `The execution lane now has a live quote for ${quote.fromAmount} ${quote.fromSymbol} -> ${quote.toAmount} ${quote.toSymbol}, ready for the final signed treasury deployment step.`
          : "The execution lane now contains a route candidate, an execution quote, and a treasury-aware handoff back to the orchestrator."
      });
    });
  }

  paidWorkers.forEach((worker) => {
    timeline.push(() => {
      const amount = worker.price || 0;
      orchestrator.balance = Number((orchestrator.balance - amount).toFixed(3));
      worker.balance = Number((worker.balance + amount).toFixed(3));

      task.workerOutputs.push({
        workerId: worker.id,
        workerName: worker.name,
        cardUrl: worker.metadataPath,
        paymentAmount: formatUsd(amount),
        result: buildWorkerOutput(worker.id, task.input, task)
      });

      const paymentTx = addTransaction(task, {
        type: "payment",
        label: `${worker.name} x402 settlement`,
        amount: formatUsd(amount),
        from: orchestrator.wallet,
        to: worker.wallet,
        explorerUrl: `https://www.oklink.com/xlayer/tx/${createHash()}`,
        linkLabel: "mock explorer"
      });

      addStep(task, {
        type: "worker",
        title: `${worker.name} finished execution`,
        detail: `Spent ${formatUsd(amount)} from treasury over x402 and received a ${worker.skill} payload back into the organization.`
      });

      task.payments.push({
        workerId: worker.id,
        workerName: worker.name,
        amount: formatUsd(amount),
        txHash: paymentTx.hash
      });
    });
  });

  if (task.liveSpendRequested && task.liveSpendTargetId) {
    timeline.push(async () => {
      const targetWorker = getTaskAgent(task, task.liveSpendTargetId);

      if (!targetWorker || targetWorker.price == null) {
        addStep(task, {
          type: "live-spend",
          title: "Live specialist hire skipped",
          detail: "The requested worker was not available as a priced specialist when the live budget lane opened."
        });
        return;
      }

      addStep(task, {
        type: "live-spend",
        title: "Live specialist hire requested",
        detail: `A real x402 settlement is being submitted for ${targetWorker.name}. This mission is configured to spend real treasury budget on exactly one specialist.`
      });

      try {
        const record = await runLivePurchase({
          workerId: targetWorker.id,
          payerId: "orchestrator",
          taskId: task.id,
          source: "mission",
          description: `${targetWorker.name} specialist purchase triggered by task ${task.id}`
        });

        const settledTxHash = record.settle?.[0]?.txHash || createHash();
        addTransaction(task, {
          type: "live-payment",
          label: `${targetWorker.name} live x402 settlement`,
          amount: record.amountDisplay || formatUsd(targetWorker.price || 0),
          from: record.payerWallet || orchestrator.wallet,
          to: record.payTo || treasury.wallet,
          explorerUrl: `https://www.oklink.com/xlayer/tx/${settledTxHash}`,
          linkLabel: "live tx",
          hash: settledTxHash,
          mock: false
        });

        task.payments.push({
          workerId: targetWorker.id,
          workerName: targetWorker.name,
          amount: record.amountDisplay || formatUsd(targetWorker.price || 0),
          txHash: settledTxHash,
          live: true
        });

        addStep(task, {
          type: "live-spend",
          title: `${targetWorker.name} live settlement confirmed`,
          detail: `Real treasury budget was deployed for ${record.amountDisplay || formatUsd(targetWorker.price || 0)}. The settlement landed on X Layer with tx ${settledTxHash.slice(0, 14)}...`
        });

        await refreshOrgContext({ force: true });
        await refreshLiveContext("", { force: true });
      } catch (error) {
        addStep(task, {
          type: "live-spend",
          title: "Live specialist hire failed",
          detail: `The real x402 lane returned an error: ${error.message}`
        });
      }
    });
  }

  timeline.push(() => {
    const completionTx = addTransaction(task, {
      type: "contract",
      label: "SkillMeshRegistry.recordTaskCompletion",
      amount: "proof event",
      from: treasury.wallet,
      to: "SkillMeshRegistry",
      explorerUrl: `https://www.oklink.com/xlayer/tx/${createHash()}`,
      linkLabel: "mock explorer"
    });

    addStep(task, {
      type: "treasury",
      title: "Treasury recorded task completion",
      detail: "Recorded why treasury budget was deployed, which agents were hired, and what proof path the organization produced."
    });

    task.completionTxHash = completionTx.hash;
  });

  timeline.push(() => {
    const totalPaid = paidWorkers.reduce((sum, worker) => sum + (worker.price || 0), 0);
    const receiptTx = addTransaction(task, {
      type: "receipt",
      label: "SkillMeshReceipt.mintReceipt",
      amount: "receipt minted",
      from: treasury.wallet,
      to: orchestrator.wallet,
      explorerUrl: `https://www.oklink.com/xlayer/tx/${createHash()}`,
      linkLabel: "mock explorer"
    });

    task.status = "completed";
    task.completedAt = new Date().toISOString();
    task.balancesAfter = copyAgentList(task.runtimeAgents);
    task.receipt = {
      tokenId: `SM-${task.id.slice(0, 8).toUpperCase()}`,
      totalPaid: formatUsd(totalPaid),
      workerCount: paidWorkers.length,
      agentCount: task.selectedWorkerIds.length + 2,
      protocolLane: task.strategy.protocols.join(" -> "),
      thesis: task.strategy.headline,
      taskHash: task.proofTaskHash,
      receiptTxHash: receiptTx.hash,
      completionTxHash: task.completionTxHash,
      downloadUrl: `/api/tasks/${task.id}/receipt.json`,
      artifactUrl: `/artifacts/receipts/${task.id}.json`,
      liveSpecialistCount: getRelatedLivePurchases(task).length,
      payoutMap: paidWorkers.map((worker) => ({
        worker: worker.name,
        amount: formatUsd(worker.price || 0),
        cardUrl: worker.metadataPath
      })),
      liveWallet: task.liveContext?.wallet?.address || null
    };
    task.finalOutput = buildFinalOutput(task);
    writeReceiptArtifact(task);

    addStep(task, {
      type: "receipt",
      title: "Receipt prepared for final delivery",
      detail: "The dashboard can now show treasury usage, hired specialists, payout proofs, and a final exportable artifact."
    });
  });

  (async () => {
    for (const step of timeline) {
      await new Promise((resolve) => setTimeout(resolve, 850));
      try {
        await step();
      } catch (error) {
        addStep(task, {
          type: "error",
          title: "Timeline step failed",
          detail: error.message
        });
      }
    }
  })();
}

function createTask(input, liveContext = null, orgSnapshots = ORG_CONTEXT.snapshots, options = {}) {
  const intent = analyzeIntent(input);
  const selectedWorkerIds = pickWorkers(input);
  const runtimeAgents = copyAgentList(cloneAgents(liveContext, orgSnapshots));
  const selectedWorkers = selectedWorkerIds.map((workerId) =>
    runtimeAgents.find((worker) => worker.id === workerId)
  );
  const stack = getProtocolStack();
  const opportunities = getOpportunityRadar(input);
  const taskId = crypto.randomUUID();
  const task = {
    id: taskId,
    input,
    status: "running",
    createdAt: new Date().toISOString(),
    intent,
    selectedWorkerIds,
    selectedWorkers: selectedWorkers.map(buildPublicAgent),
    runtimeAgents,
    liveContext,
    orgSnapshots,
    plan: buildTaskPlan(input, selectedWorkers, intent),
    strategy: buildStrategy(input, selectedWorkers, intent),
    stack,
    opportunities,
    liveSpendRequested: Boolean(options.liveSpend && getPaidWorkerIds(selectedWorkerIds).length),
    liveSpendTargetId: options.liveSpend ? getPaidWorkerIds(selectedWorkerIds)[0] || null : null,
    steps: [],
    transactions: [],
    payments: [],
    workerOutputs: [],
    balancesBefore: copyAgentList(runtimeAgents),
    balancesAfter: null,
    proofTaskHash: null,
    receipt: null,
    completionTxHash: null,
    finalOutput: ""
  };
  task.proofTaskHash = buildTaskProofHash(task);

  TASKS.set(task.id, task);
  simulateTask(task);
  return task;
}

function routeApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/healthz") {
    json(res, 200, { ok: true, service: "skillmesh-commerce" });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    json(res, 200, {
      project: "SkillMesh Revenue Mesh",
      angle: "A self-funding agent organization on X Layer",
      integration: getIntegrationStatus(),
      stack: getProtocolStack(),
      opportunities: getOpportunityRadar(),
      agents: cloneAgents(LIVE_CONTEXT.snapshot, ORG_CONTEXT.snapshots),
      live: buildLiveSummary(LIVE_CONTEXT.snapshot, LIVE_CONTEXT.error, ORG_CONTEXT.snapshots)
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/agents") {
    json(res, 200, { agents: cloneAgents(LIVE_CONTEXT.snapshot, ORG_CONTEXT.snapshots) });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/live/summary") {
    refreshLiveContext("", { force: true })
      .then((snapshot) =>
        refreshOrgContext({ force: true }).then((orgSnapshots) =>
          refreshX402Supported({ force: true }).then(() => ({
            snapshot,
            orgSnapshots
          }))
        )
      )
      .then(({ snapshot, orgSnapshots }) => {
        json(res, 200, {
          live: buildLiveSummary(snapshot, LIVE_CONTEXT.error, orgSnapshots),
          agents: cloneAgents(snapshot, orgSnapshots)
        });
      })
      .catch((error) => json(res, 500, { error: error.message }));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/funding-ledger") {
    json(res, 200, { ledger: readFundingLedger() });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/live/purchases") {
    json(res, 200, readLivePurchases());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/proof-ledger") {
    json(res, 200, { proof: buildProofSummary() });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/live/purchases") {
    collectBody(req)
      .then((rawBody) => {
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const workerId = payload.workerId || "summarizer";
        const worker = getAgent(workerId);

        if (!worker || worker.price == null) {
          json(res, 404, { error: "Priced specialist worker not found" });
          return;
        }

        runLivePurchase({
          workerId,
          payerId: payload.payerId || "orchestrator",
          description: payload.description || `${worker.name} specialist purchase triggered from the dashboard`,
          taskId: payload.taskId || "",
          source: payload.source || "dashboard"
        })
          .then((record) =>
            refreshOrgContext({ force: true })
              .then((orgSnapshots) =>
                refreshLiveContext("", { force: true }).then((snapshot) => ({
                  record,
                  snapshot,
                  orgSnapshots
                }))
              )
              .then(({ record, snapshot, orgSnapshots }) =>
                json(res, 200, {
                  ok: true,
                  record,
                  purchases: readLivePurchases(),
                  live: buildLiveSummary(snapshot, LIVE_CONTEXT.error, orgSnapshots)
                })
              )
          )
          .catch((error) => json(res, 502, { ok: false, error: error.message }));
      })
      .catch((error) => json(res, 400, { error: error.message }));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/x402/supported") {
    refreshX402Supported({ force: true })
      .then((supported) => json(res, 200, { x402: buildX402Summary(), supported }))
      .catch((error) => json(res, 500, { error: error.message }));
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/x402/workers/") && url.pathname.endsWith("/requirements")) {
    const workerId = url.pathname.split("/")[4];
    const worker = getAgent(workerId);
    const treasury = getAgent("treasury");

    if (!worker || worker.price == null) {
      json(res, 404, { error: "Specialist worker not found" });
      return true;
    }

    try {
      const payoutWallet = isEvmAddress(worker.wallet) ? worker.wallet : treasury.wallet;
      const requirements = buildPaymentRequirements(worker, { payTo: payoutWallet });
      const accepts = buildBuyerAccepts(worker, {
        payTo: payoutWallet
      });
      json(res, 200, {
        worker: buildPublicAgent(worker),
        payoutMode: isEvmAddress(worker.wallet) ? "worker-direct" : "treasury-collection",
        requirements,
        accepts
      });
    } catch (error) {
      json(res, 500, { error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/x402/verify") {
    collectBody(req)
      .then((rawBody) => {
        const payload = rawBody ? JSON.parse(rawBody) : {};
        if (!payload.paymentPayload) {
          json(res, 400, { error: "paymentPayload is required" });
          return;
        }

        verifyPayment(payload.paymentPayload, payload.paymentRequirements, { chainIndex: payload.chainIndex })
          .then((data) => json(res, 200, { ok: true, data }))
          .catch((error) => json(res, 502, { ok: false, error: error.message }));
      })
      .catch((error) => json(res, 400, { error: error.message }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/x402/settle") {
    collectBody(req)
      .then((rawBody) => {
        const payload = rawBody ? JSON.parse(rawBody) : {};
        if (!payload.paymentPayload) {
          json(res, 400, { error: "paymentPayload is required" });
          return;
        }

        settlePayment(payload.paymentPayload, payload.paymentRequirements, {
          chainIndex: payload.chainIndex,
          syncSettle: payload.syncSettle
        })
          .then((data) => json(res, 200, { ok: true, data }))
          .catch((error) => json(res, 502, { ok: false, error: error.message }));
      })
      .catch((error) => json(res, 400, { error: error.message }));
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/agents/") && url.pathname.endsWith("/card")) {
    const agentId = url.pathname.split("/")[3];
    const agent = getAgent(agentId);

    if (!agent) {
      json(res, 404, { error: "Agent not found" });
      return true;
    }

    json(res, 200, { card: readAgentCard(agentId) });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/tasks/") && url.pathname.endsWith("/receipt.json")) {
    const taskId = url.pathname.split("/")[3];
    const task = TASKS.get(taskId);

    if (!task) {
      json(res, 404, { error: "Task not found" });
      return true;
    }

    if (!task.receipt) {
      json(res, 409, { error: "Receipt not ready yet" });
      return true;
    }

    json(res, 200, buildReceiptExport(task));
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/tasks/")) {
    const taskId = url.pathname.split("/").pop();
    const task = TASKS.get(taskId);

    if (!task) {
      json(res, 404, { error: "Task not found" });
      return true;
    }

    json(res, 200, { task });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/tasks") {
    collectBody(req)
      .then((rawBody) => {
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const input = String(payload.input || "").trim();

        if (!input) {
          json(res, 400, { error: "Task input is required" });
          return;
        }

        refreshLiveContext(input, { force: true })
          .then((snapshot) =>
            refreshOrgContext({ force: true }).then((orgSnapshots) => ({
              snapshot,
              orgSnapshots
            }))
          )
          .then(({ snapshot, orgSnapshots }) => {
            const task = createTask(input, snapshot, orgSnapshots, {
              liveSpend: Boolean(payload.liveSpend)
            });
            json(res, 201, { taskId: task.id });
          })
          .catch((error) => json(res, 500, { error: error.message }));
      })
      .catch((error) => json(res, 400, { error: error.message }));

    return true;
  }

  return false;
}

function routeStatic(req, res, url) {
  const isArtifactPath = url.pathname.startsWith("/artifacts/");
  const staticRoot = isArtifactPath ? ARTIFACTS_DIR : PUBLIC_DIR;
  const relativePath = isArtifactPath
    ? url.pathname.replace(/^\/artifacts\/?/, "")
    : url.pathname === "/"
      ? "index.html"
      : url.pathname.replace(/^\/+/, "");
  let filePath = path.join(staticRoot, relativePath);

  if (!filePath.startsWith(staticRoot)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  sendFile(res, filePath);
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (routeApi(req, res, url)) {
      return;
    }

    routeStatic(req, res, url);
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`SkillMesh Commerce running at http://127.0.0.1:${PORT}`);
  });
}

module.exports = {
  AGENTS,
  createServer,
  getAgent,
  getIntegrationStatus
};
