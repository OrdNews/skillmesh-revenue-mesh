const crypto = require("crypto");

const DEFAULT_BASE_URL = "https://web3.okx.com/api/v6/x402";
const DEFAULT_CHAIN_INDEX = "196";
const DEFAULT_CHAIN_NAME = "X Layer";
const DEFAULT_STABLE_ASSET = "0x779ded0c9e1022225f8e0630b35a9b54be713736";
const DEFAULT_STABLE_SYMBOL = "USDT";
const DEFAULT_STABLE_DECIMALS = 6;
const DEFAULT_TIMEOUT_SECONDS = 600000;
const DEFAULT_TOKEN_NAME = "USD₮0";
const DEFAULT_TOKEN_VERSION = "1";

function getEnvValue(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function getBaseUrl() {
  const configured = getEnvValue("X402_FACILITATOR_URL");
  if (!configured) {
    return DEFAULT_BASE_URL;
  }

  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

function getApiConfig() {
  const apiKey = getEnvValue("OKX_API_KEY", "OK_API_KEY", "ONCHAIN_OS_API_KEY");
  const secretKey = getEnvValue("OKX_SECRET_KEY", "OK_SECRET_KEY");
  const passphrase = getEnvValue("OKX_PASSPHRASE");

  return {
    apiKey,
    secretKey,
    passphrase,
    ready: Boolean(apiKey && secretKey && passphrase)
  };
}

function normalizePath(requestPath) {
  if (!requestPath.startsWith("/")) {
    return `/${requestPath}`;
  }

  return requestPath;
}

function buildRequestUrl(requestPath) {
  const baseUrl = getBaseUrl();
  const path = normalizePath(requestPath);

  if (baseUrl.endsWith("/api/v6/x402")) {
    return `${baseUrl}${path}`;
  }

  if (baseUrl.endsWith("/api/v6/x402/")) {
    return `${baseUrl.slice(0, -1)}${path}`;
  }

  return `${baseUrl}${path}`;
}

function buildSignedPath(requestPath) {
  const baseUrl = new URL(getBaseUrl());
  const path = normalizePath(requestPath);
  const basePath = baseUrl.pathname.endsWith("/")
    ? baseUrl.pathname.slice(0, -1)
    : baseUrl.pathname;

  return `${basePath}${path}`;
}

function signRequest(timestamp, method, requestPath, body, secretKey) {
  const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body || ""}`;
  return crypto.createHmac("sha256", secretKey).update(prehash).digest("base64");
}

async function requestX402(method, requestPath, body = null) {
  const config = getApiConfig();
  if (!config.ready) {
    throw new Error("OKX x402 credentials are not configured");
  }

  const path = normalizePath(requestPath);
  const url = buildRequestUrl(path);
  const signedPath = buildSignedPath(path);
  const timestamp = new Date().toISOString();
  const serializedBody = body ? JSON.stringify(body) : "";
  const signature = signRequest(timestamp, method, signedPath, serializedBody, config.secretKey);

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "OK-ACCESS-KEY": config.apiKey,
      "OK-ACCESS-SIGN": signature,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": config.passphrase
    },
    body: serializedBody || undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.msg || payload.message || `x402 request failed with status ${response.status}`);
  }

  if (payload.code && payload.code !== "0") {
    throw new Error(payload.msg || "x402 request failed");
  }

  return payload;
}

function priceToSmallestUnit(price, decimals = DEFAULT_STABLE_DECIMALS) {
  const numeric = Number(price || 0);
  const scaled = Math.round(numeric * 10 ** decimals);
  return String(scaled);
}

function getStableConfig() {
  return {
    asset: getEnvValue("X402_SETTLEMENT_ASSET", "X402_ASSET_ADDRESS") || DEFAULT_STABLE_ASSET,
    symbol: getEnvValue("X402_SETTLEMENT_SYMBOL") || DEFAULT_STABLE_SYMBOL,
    decimals: Number(getEnvValue("X402_SETTLEMENT_DECIMALS") || DEFAULT_STABLE_DECIMALS)
  };
}

function buildPaymentRequirements(worker, options = {}) {
  const chainIndex = getEnvValue("X402_CHAIN_INDEX") || DEFAULT_CHAIN_INDEX;
  const chainName = getEnvValue("X402_CHAIN_NAME") || DEFAULT_CHAIN_NAME;
  const stable = getStableConfig();
  const payTo = options.payTo;

  if (!payTo) {
    throw new Error("A payout wallet is required to build x402 payment requirements");
  }

  return {
    x402Version: 1,
    scheme: "exact",
    network: {
      chainIndex,
      chainName
    },
    payTo,
    asset: stable.asset,
    settlementAsset: stable.symbol,
    amount: priceToSmallestUnit(worker.price || 0, stable.decimals),
    amountDisplay: `${worker.price} ${stable.symbol}`,
    decimals: stable.decimals,
    workerId: worker.id,
    workerName: worker.name,
    endpoint: worker.endpoint,
    note: "Current seller rail uses the organizational treasury payout wallet. Buyer-signed payloads are still required for verify/settle."
  };
}

function buildBuyerAccepts(worker, options = {}) {
  const requirements = buildPaymentRequirements(worker, options);
  return [
    {
      scheme: requirements.scheme,
      network: `eip155:${requirements.network.chainIndex}`,
      amount: requirements.amount,
      asset: requirements.asset,
      payTo: requirements.payTo,
      maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
      extra: {
        name: getEnvValue("X402_TOKEN_NAME") || DEFAULT_TOKEN_NAME,
        version: getEnvValue("X402_TOKEN_VERSION") || DEFAULT_TOKEN_VERSION
      }
    }
  ];
}

function buildVerifyRequirements(worker, options = {}) {
  const requirements = buildPaymentRequirements(worker, options);
  return {
    scheme: requirements.scheme,
    chainIndex: requirements.network.chainIndex,
    maxAmountRequired: requirements.amount,
    resource: options.resource || worker.endpoint || `/workers/${worker.id}`,
    description: options.description || `${worker.name} specialist task`,
    mimeType: options.mimeType || "application/json",
    payTo: requirements.payTo,
    maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
    asset: requirements.asset,
    outputSchema: options.outputSchema || null,
    extra: {
      name: getEnvValue("X402_TOKEN_NAME") || DEFAULT_TOKEN_NAME,
      version: getEnvValue("X402_TOKEN_VERSION") || DEFAULT_TOKEN_VERSION
    }
  };
}

function buildPaymentPayloadFromProof(proof, options = {}) {
  return {
    x402Version: 1,
    scheme: options.scheme || "exact",
    network: options.network || `eip155:${options.chainIndex || DEFAULT_CHAIN_INDEX}`,
    payload: proof
  };
}

async function fetchSupported() {
  const payload = await requestX402("GET", "/supported");
  return payload.data || [];
}

function buildVerifyRequest(paymentPayload, paymentRequirements, options = {}) {
  const chainIndex =
    options.chainIndex ||
    paymentRequirements?.chainIndex ||
    getEnvValue("X402_CHAIN_INDEX") ||
    DEFAULT_CHAIN_INDEX;
  const requestBody = {
    x402Version: 1,
    chainIndex,
    paymentPayload,
    paymentRequirements
  };
  return requestBody;
}

function buildSettleRequest(paymentPayload, paymentRequirements, options = {}) {
  const chainIndex =
    options.chainIndex ||
    paymentRequirements?.chainIndex ||
    getEnvValue("X402_CHAIN_INDEX") ||
    DEFAULT_CHAIN_INDEX;
  return {
    x402Version: 1,
    chainIndex,
    syncSettle: options.syncSettle !== false,
    paymentPayload,
    paymentRequirements
  };
}

async function verifyPayment(paymentPayload, paymentRequirements = null, options = {}) {
  const requestBody = buildVerifyRequest(paymentPayload, paymentRequirements, options);
  const payload = await requestX402("POST", "/verify", requestBody);
  return payload.data;
}

async function settlePayment(paymentPayload, paymentRequirements = null, options = {}) {
  const requestBody = buildSettleRequest(paymentPayload, paymentRequirements, options);
  const payload = await requestX402("POST", "/settle", requestBody);
  return payload.data;
}

module.exports = {
  DEFAULT_CHAIN_INDEX,
  DEFAULT_CHAIN_NAME,
  DEFAULT_TIMEOUT_SECONDS,
  buildBuyerAccepts,
  buildPaymentPayloadFromProof,
  buildPaymentRequirements,
  buildRequestUrl,
  buildSignedPath,
  buildSettleRequest,
  buildVerifyRequest,
  buildVerifyRequirements,
  fetchSupported,
  getApiConfig,
  getBaseUrl,
  getStableConfig,
  settlePayment,
  signRequest,
  verifyPayment
};
