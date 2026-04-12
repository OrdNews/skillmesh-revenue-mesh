const fs = require("fs");
const path = require("path");
const { JsonRpcProvider } = require("ethers");

const projectRoot = path.resolve(__dirname, "..");
const envFile = path.join(projectRoot, ".env");
const proofLedgerFile = path.join(projectRoot, "proof-ledger.json");
const receiptArtifactsDir = path.join(projectRoot, "artifacts", "receipts");

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

const { getAgent } = require("../server");
const {
  buildTaskProofHash,
  encodeMintReceiptCall,
  encodeRecordTaskCompletionCall
} = require("../lib/proof-contracts");
const { readProofDeployment } = require("../lib/proof-deployments");
const { runOnchainosJson } = require("../lib/live-okx");

function parseArgs(argv) {
  const parsed = {
    taskId: "",
    mode: "all"
  };

  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === "--task-id" && argv[index + 1]) {
      parsed.taskId = argv[index + 1];
      index += 1;
    } else if (argv[index] === "--mode" && argv[index + 1]) {
      parsed.mode = argv[index + 1];
      index += 1;
    }
  }

  return parsed;
}

function readLedger() {
  if (!fs.existsSync(proofLedgerFile)) {
    return { updatedAt: null, registrations: [], taskProofs: [] };
  }
  return JSON.parse(fs.readFileSync(proofLedgerFile, "utf8"));
}

function writeLedger(ledger) {
  fs.writeFileSync(proofLedgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
}

function readTaskReceipt(taskId) {
  const filePath = path.join(receiptArtifactsDir, `${taskId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Receipt artifact not found for task ${taskId}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getRpcUrl() {
  return process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech";
}

async function waitForTx(txHash) {
  if (!txHash) {
    return;
  }

  const provider = new JsonRpcProvider(getRpcUrl());
  await provider.waitForTransaction(txHash, 1, 90_000);
}

async function callContract({ to, from, inputData, gasLimit }) {
  const args = [
    "wallet",
    "contract-call",
    "--chain",
    "xlayer",
    "--to",
    to,
    "--input-data",
    inputData,
    "--from",
    from
  ];

  if (gasLimit) {
    args.push("--gas-limit", String(gasLimit));
  }

  args.push("--force");

  const payload = await runOnchainosJson(args, { timeout: 120_000 });
  return payload.data || payload;
}

async function main() {
  const deployment = readProofDeployment();
  const registryAddress = process.env.SKILLMESH_REGISTRY_ADDRESS || deployment?.registry?.address;
  const receiptAddress = process.env.SKILLMESH_RECEIPT_ADDRESS || deployment?.receipt?.address;
  const { taskId, mode } = parseArgs(process.argv);

  if (!taskId) {
    throw new Error("--task-id is required");
  }
  if (!registryAddress || !receiptAddress) {
    throw new Error("SKILLMESH_REGISTRY_ADDRESS and SKILLMESH_RECEIPT_ADDRESS are required");
  }

  const taskReceipt = readTaskReceipt(taskId);
  if (!taskReceipt.proofTaskHash) {
    taskReceipt.proofTaskHash = buildTaskProofHash(taskReceipt);
  }

  const treasury = getAgent("treasury");
  const orchestrator = getAgent("orchestrator");
  const outputs = {};

  if (mode === "all" || mode === "task") {
    outputs.recordTaskCompletion = await callContract({
      to: registryAddress,
      from: treasury.wallet,
      inputData: encodeRecordTaskCompletionCall(taskReceipt),
      gasLimit: 350000
    });
    await waitForTx(outputs.recordTaskCompletion?.txHash);
  }

  if (mode === "all" || mode === "receipt") {
    outputs.mintReceipt = await callContract({
      to: receiptAddress,
      from: treasury.wallet,
      gasLimit: 250000,
      inputData: encodeMintReceiptCall({
        ...taskReceipt,
        orchestrator
      })
    });
  }

  const record = {
    id: `${taskId}-${Date.now()}`,
    taskId,
    createdAt: new Date().toISOString(),
    proofTaskHash: taskReceipt.proofTaskHash,
    mode,
    outputs
  };

  const ledger = readLedger();
  ledger.updatedAt = new Date().toISOString();
  ledger.taskProofs = [record, ...(ledger.taskProofs || [])].slice(0, 50);
  writeLedger(ledger);

  process.stdout.write(`${JSON.stringify({ ok: true, record }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exit(1);
  });
}

module.exports = { main };
