const fs = require("fs");
const path = require("path");
const solc = require("solc");
const { JsonRpcProvider, getAddress, getCreate2Address, keccak256, toUtf8Bytes } = require("ethers");

const projectRoot = path.resolve(__dirname, "..");
const envFile = path.join(projectRoot, ".env");
const contractsDir = path.join(projectRoot, "contracts");
const factoryAddress = "0x4e59b44847b379578588920ca78fbf26c0b4956c";

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
const { readProofDeployment, writeProofDeployment } = require("../lib/proof-deployments");
const { runOnchainosJson } = require("../lib/live-okx");

function compileContracts() {
  const sources = {
    "SkillMeshRegistry.sol": {
      content: fs.readFileSync(path.join(contractsDir, "SkillMeshRegistry.sol"), "utf8")
    },
    "SkillMeshReceipt.sol": {
      content: fs.readFileSync(path.join(contractsDir, "SkillMeshReceipt.sol"), "utf8")
    }
  };

  const input = {
    language: "Solidity",
    sources,
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"]
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (Array.isArray(output.errors)) {
    const fatal = output.errors.filter((entry) => entry.severity === "error");
    if (fatal.length) {
      throw new Error(fatal.map((entry) => entry.formattedMessage).join("\n\n"));
    }
  }

  return {
    registry: output.contracts["SkillMeshRegistry.sol"].SkillMeshRegistry,
    receipt: output.contracts["SkillMeshReceipt.sol"].SkillMeshReceipt
  };
}

function buildSalt(label) {
  return keccak256(toUtf8Bytes(`skillmesh-revenue-mesh:${label}:v1`));
}

function stripHexPrefix(value) {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function buildFactoryCalldata(salt, initCode) {
  return `0x${stripHexPrefix(salt)}${stripHexPrefix(initCode)}`;
}

function getRpcUrl() {
  return process.env.XLAYER_RPC_URL || "https://rpc.xlayer.tech";
}

async function waitForDeploymentCode(provider, address) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 90_000) {
    const code = await provider.getCode(address);
    if (code && code !== "0x") {
      return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Timed out waiting for deployed bytecode at ${address}`);
}

async function deployOne(provider, label, contractArtifact, deployerWallet) {
  const salt = buildSalt(label);
  const bytecode = `0x${contractArtifact.evm.bytecode.object}`;
  const predictedAddress = getCreate2Address(getAddress(factoryAddress), salt, keccak256(bytecode));
  const existingCode = await provider.getCode(predictedAddress);

  if (existingCode && existingCode !== "0x") {
    return {
      label,
      predictedAddress,
      salt,
      bytecodeHash: keccak256(bytecode),
      tx: null,
      reused: true
    };
  }

  const inputData = buildFactoryCalldata(salt, bytecode);
  const payload = await runOnchainosJson(
    [
      "wallet",
      "contract-call",
      "--chain",
      "xlayer",
      "--to",
      factoryAddress,
      "--input-data",
      inputData,
      "--from",
      deployerWallet,
      "--force"
    ],
    { timeout: 180_000 }
  );

  await waitForDeploymentCode(provider, predictedAddress);

  return {
    label,
    predictedAddress,
    salt,
    bytecodeHash: keccak256(bytecode),
    tx: payload.data || payload,
    reused: false
  };
}

async function main() {
  const deployer = getAgent("treasury");
  if (!deployer?.wallet) {
    throw new Error("Treasury wallet is unavailable for proof deployment");
  }

  const provider = new JsonRpcProvider(getRpcUrl());
  const artifacts = compileContracts();
  const existing = readProofDeployment();

  const registry = await deployOne(provider, "registry", artifacts.registry, deployer.wallet);
  const receipt = await deployOne(provider, "receipt", artifacts.receipt, deployer.wallet);

  const deployment = {
    chain: "xlayer",
    updatedAt: new Date().toISOString(),
    deployer: {
      agentId: deployer.id,
      wallet: deployer.wallet
    },
    factoryAddress,
    registry: {
      address: registry.predictedAddress,
      salt: registry.salt,
      bytecodeHash: registry.bytecodeHash,
      tx: registry.tx,
      reused: registry.reused
    },
    receipt: {
      address: receipt.predictedAddress,
      salt: receipt.salt,
      bytecodeHash: receipt.bytecodeHash,
      tx: receipt.tx,
      reused: receipt.reused
    },
    previous: existing || null
  };

  writeProofDeployment(deployment);
  process.stdout.write(`${JSON.stringify({ ok: true, deployment }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    process.exit(1);
  });
}

module.exports = { main };
