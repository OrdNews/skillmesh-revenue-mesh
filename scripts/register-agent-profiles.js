const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const envFile = path.join(projectRoot, ".env");
const proofLedgerFile = path.join(projectRoot, "proof-ledger.json");

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
const { encodeRegisterAgentCall } = require("../lib/proof-contracts");
const { readProofDeployment } = require("../lib/proof-deployments");
const { buildRuntimeEnv, runOnchainosJson } = require("../lib/live-okx");

function readLedger() {
  if (!fs.existsSync(proofLedgerFile)) {
    return { updatedAt: null, registrations: [], taskProofs: [] };
  }
  return JSON.parse(fs.readFileSync(proofLedgerFile, "utf8"));
}

function writeLedger(ledger) {
  fs.writeFileSync(proofLedgerFile, `${JSON.stringify(ledger, null, 2)}\n`);
}

function parseArgs(argv) {
  const parsed = {
    agents: ["orchestrator", "scout", "trader", "treasury"]
  };

  const explicitAgents = [];
  for (let index = 2; index < argv.length; index += 1) {
    if (argv[index] === "--agent" && argv[index + 1]) {
      explicitAgents.push(argv[index + 1]);
      index += 1;
    }
  }

  if (explicitAgents.length) {
    parsed.agents = explicitAgents;
  }
  return parsed;
}

async function main() {
  const deployment = readProofDeployment();
  const registryAddress = process.env.SKILLMESH_REGISTRY_ADDRESS || deployment?.registry?.address;
  if (!registryAddress) {
    throw new Error("SKILLMESH_REGISTRY_ADDRESS is required");
  }

  const { agents } = parseArgs(process.argv);
  const ledger = readLedger();
  const records = [];

  for (const agentId of agents) {
    const agent = getAgent(agentId);
    if (!agent || !agent.accountId) {
      throw new Error(`Agent ${agentId} is missing or has no dedicated wallet account`);
    }

    const inputData = encodeRegisterAgentCall(agentId, agent);
    const result = await runOnchainosJson(
      [
        "wallet",
        "contract-call",
        "--chain",
        "xlayer",
        "--to",
        registryAddress,
        "--input-data",
        inputData,
        "--from",
        agent.wallet,
        "--force"
      ],
      {
        timeout: 120_000
      }
    );

    const record = {
      id: `${agentId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
      agentId,
      accountId: agent.accountId,
      wallet: agent.wallet,
      tx: result.data || result
    };
    records.push(record);
  }

  ledger.updatedAt = new Date().toISOString();
  ledger.registrations = [...records, ...(ledger.registrations || [])].slice(0, 50);
  writeLedger(ledger);
  process.stdout.write(`${JSON.stringify({ ok: true, records }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exit(1);
  });
}

module.exports = { main };
