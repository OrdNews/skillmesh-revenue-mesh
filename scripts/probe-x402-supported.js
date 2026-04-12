const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ENV_FILE = path.join(__dirname, "..", ".env");
const OUTPUT_FILE = path.join(__dirname, "..", "x402-cache.json");
const REQUEST_PATH = "/api/v6/x402/supported";
const REQUEST_URL = `https://web3.okx.com${REQUEST_PATH}`;

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

function buildSignature(timestamp, secretKey) {
  const prehash = `${timestamp}GET${REQUEST_PATH}`;
  return crypto.createHmac("sha256", secretKey).update(prehash).digest("base64");
}

function runCurl(headers) {
  const output = execFileSync("curl", ["-s", "--max-time", "20", REQUEST_URL, ...headers], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024 * 4
  });

  return JSON.parse(output);
}

function buildCurlHeaders(apiKey, passphrase, timestamp, signature) {
  return [
    "-H",
    "Content-Type: application/json",
    "-H",
    `OK-ACCESS-KEY: ${apiKey}`,
    "-H",
    `OK-ACCESS-SIGN: ${signature}`,
    "-H",
    `OK-ACCESS-TIMESTAMP: ${timestamp}`,
    "-H",
    `OK-ACCESS-PASSPHRASE: ${passphrase}`
  ];
}

function main() {
  loadEnvFile();

  const apiKey = process.env.OKX_API_KEY || process.env.OK_API_KEY || process.env.ONCHAIN_OS_API_KEY;
  const secretKey = process.env.OKX_SECRET_KEY || process.env.OK_SECRET_KEY;
  const passphrase = process.env.OKX_PASSPHRASE;

  if (!apiKey || !secretKey || !passphrase) {
    throw new Error("OKX x402 credentials are not configured");
  }

  const timestamp = new Date().toISOString();
  const signature = buildSignature(timestamp, secretKey);
  const payload = runCurl(buildCurlHeaders(apiKey, passphrase, timestamp, signature));

  if (payload.code && payload.code !== "0") {
    throw new Error(payload.msg || "x402 supported probe failed");
  }

  const cache = {
    refreshedAt: new Date().toISOString(),
    supported: payload.data || []
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
  console.log(JSON.stringify(cache, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
