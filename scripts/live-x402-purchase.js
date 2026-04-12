const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const envFile = path.join(projectRoot, ".env");
const purchaseLedgerFile = path.join(projectRoot, "live-purchases.json");

function loadEnvFile() {
  if (!fs.existsSync(envFile)) {
    return;
  }

  const contents = fs.readFileSync(envFile, "utf8");
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

loadEnvFile();

const {
  buildBuyerAccepts,
  buildPaymentPayloadFromProof,
  buildRequestUrl,
  buildSignedPath,
  buildVerifyRequest,
  buildVerifyRequirements,
  buildSettleRequest,
  getApiConfig,
  signRequest
} = require("../lib/okx-x402");
const { getAgent } = require("../server");

function parseArgs(argv) {
  const parsed = {
    workerId: "summarizer",
    payerId: "orchestrator",
    resource: "",
    description: "",
    syncSettle: true,
    taskId: "",
    source: "script"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--worker" && argv[index + 1]) {
      parsed.workerId = argv[index + 1];
      index += 1;
    } else if (value === "--payer" && argv[index + 1]) {
      parsed.payerId = argv[index + 1];
      index += 1;
    } else if (value === "--resource" && argv[index + 1]) {
      parsed.resource = argv[index + 1];
      index += 1;
    } else if (value === "--description" && argv[index + 1]) {
      parsed.description = argv[index + 1];
      index += 1;
    } else if (value === "--async-settle") {
      parsed.syncSettle = false;
    } else if (value === "--task-id" && argv[index + 1]) {
      parsed.taskId = argv[index + 1];
      index += 1;
    } else if (value === "--source" && argv[index + 1]) {
      parsed.source = argv[index + 1];
      index += 1;
    }
  }

  return parsed;
}

function ensureAgent(agentId, role) {
  const agent = getAgent(agentId);
  if (!agent) {
    throw new Error(`${role} agent "${agentId}" was not found`);
  }
  return agent;
}

function readLedger() {
  if (!fs.existsSync(purchaseLedgerFile)) {
    return { updatedAt: null, purchases: [] };
  }

  try {
    const payload = JSON.parse(fs.readFileSync(purchaseLedgerFile, "utf8"));
    return {
      updatedAt: payload?.updatedAt || null,
      purchases: Array.isArray(payload?.purchases) ? payload.purchases : []
    };
  } catch (error) {
    return { updatedAt: null, purchases: [] };
  }
}

function writeLedger(ledger) {
  fs.writeFileSync(purchaseLedgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
}

function runCommand(command, args, env = process.env) {
  const stdout = execFileSync(command, args, {
    cwd: projectRoot,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  return stdout.trim();
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${text}`);
  }
}

function buildOkxHeaders(method, requestPath, bodyString) {
  const config = getApiConfig();
  if (!config.ready) {
    throw new Error("OKX credentials are missing");
  }

  const timestamp = new Date().toISOString();
  const signature = signRequest(timestamp, method, buildSignedPath(requestPath), bodyString, config.secretKey);
  return {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": config.apiKey,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": config.passphrase
  };
}

function callOkxJson(method, requestPath, body) {
  const bodyString = body ? JSON.stringify(body) : "";
  const headers = buildOkxHeaders(method, requestPath, bodyString);
  const url = buildRequestUrl(requestPath);
  const proxyUrl = process.env.OKX_PROXY_URL || "http://127.0.0.1:7890";
  const args = ["-sS", "-X", method.toUpperCase(), url];

  if (proxyUrl) {
    args.push("-x", proxyUrl);
  }

  for (const [header, value] of Object.entries(headers)) {
    args.push("-H", `${header}: ${value}`);
  }

  if (bodyString) {
    args.push("--data", bodyString);
  }

  const raw = runCommand("curl", args);
  const payload = parseJson(raw, `${method.toUpperCase()} ${requestPath}`);
  if (payload.code && payload.code !== "0") {
    throw new Error(payload.msg || `${requestPath} failed`);
  }
  return payload;
}

function buildEnvWithProxy() {
  const proxyUrl = process.env.OKX_PROXY_URL || "http://127.0.0.1:7890";
  return {
    ...process.env,
    PATH: `${process.env.HOME}/.local/bin:${process.env.PATH || ""}`,
    https_proxy: proxyUrl,
    HTTPS_PROXY: proxyUrl,
    http_proxy: proxyUrl,
    HTTP_PROXY: proxyUrl
  };
}

function buildPurchaseRecord(context) {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: context.status,
    workerId: context.worker.id,
    workerName: context.worker.name,
    payerId: context.payer.id,
    payerName: context.payer.name,
    payerWallet: context.payer.wallet,
    taskId: context.taskId || null,
    source: context.source || "script",
    payTo: context.paymentRequirements.payTo,
    amountDisplay: `${Number(context.worker.price || 0).toFixed(3)} USDT`,
    paymentRequirements: context.paymentRequirements,
    accepts: context.accepts,
    paymentPayload: context.paymentPayload,
    verify: context.verifyResult,
    settle: context.settleResult
  };
}

async function main() {
  const { workerId, payerId, resource, description, syncSettle, taskId, source } = parseArgs(process.argv);
  const worker = ensureAgent(workerId, "Worker");
  const payer = ensureAgent(payerId, "Payer");
  const treasury = ensureAgent("treasury", "Treasury");

  if (worker.price == null) {
    throw new Error(`Worker "${worker.id}" is not a priced specialist`);
  }

  if (!payer.wallet || !treasury.wallet) {
    throw new Error("Payer or treasury wallet is missing");
  }

  const accepts = buildBuyerAccepts(worker, { payTo: treasury.wallet });
  const paymentRequirements = buildVerifyRequirements(worker, {
    payTo: treasury.wallet,
    resource: resource || `http://127.0.0.1:3000/workers/${worker.id}`,
    description: description || `${worker.name} specialist purchase`
  });

  const proofRaw = runCommand(
    "onchainos",
    ["payment", "x402-pay", "--from", payer.wallet, "--accepts", JSON.stringify(accepts)],
    buildEnvWithProxy()
  );
  const proof = parseJson(proofRaw, "onchainos payment x402-pay");
  if (!proof.ok || !proof.data) {
    throw new Error(proof.error || "x402-pay did not return a payment proof");
  }

  const paymentPayload = buildPaymentPayloadFromProof(proof.data, {
    scheme: accepts[0].scheme,
    network: accepts[0].network
  });

  const verifyBody = buildVerifyRequest(paymentPayload, paymentRequirements, {
    chainIndex: paymentRequirements.chainIndex
  });
  const verifyPayload = callOkxJson("POST", "/verify", verifyBody);

  const settleBody = buildSettleRequest(paymentPayload, paymentRequirements, {
    chainIndex: paymentRequirements.chainIndex,
    syncSettle
  });
  const settlePayload = callOkxJson("POST", "/settle", settleBody);

  const record = buildPurchaseRecord({
    status: "settled",
    worker,
    payer,
    taskId,
    source,
    accepts,
    paymentRequirements,
    paymentPayload,
    verifyResult: verifyPayload.data || verifyPayload,
    settleResult: settlePayload.data || settlePayload
  });

  const ledger = readLedger();
  ledger.updatedAt = new Date().toISOString();
  ledger.purchases = [record, ...ledger.purchases].slice(0, 20);
  writeLedger(ledger);

  process.stdout.write(`${JSON.stringify({ ok: true, record }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exit(1);
  });
}

module.exports = {
  main
};
