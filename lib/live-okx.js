const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const DEFAULT_PROXY_URL = "http://127.0.0.1:7890";
const DEFAULT_ACCOUNT_ID = "095cbe13-ef3e-4969-9858-fa3566ea4f56";
const ONCHAINOS_PATH = path.join(os.homedir(), ".local", "bin");

function buildRuntimeEnv() {
  const proxy = process.env.HTTP_PROXY || process.env.http_proxy || DEFAULT_PROXY_URL;
  return {
    ...process.env,
    PATH: `${ONCHAINOS_PATH}:${process.env.PATH || ""}`,
    http_proxy: proxy,
    https_proxy: proxy,
    HTTP_PROXY: proxy,
    HTTPS_PROXY: proxy
  };
}

function parseJsonBlocks(text) {
  const blocks = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        blocks.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return blocks
    .map((block) => {
      try {
        return JSON.parse(block);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

async function runOnchainosJson(args, options = {}) {
  const { timeout = 30_000 } = options;
  const result = await execFileAsync("onchainos", args, {
    env: buildRuntimeEnv(),
    timeout,
    maxBuffer: 4 * 1024 * 1024
  });

  const combined = [result.stdout, result.stderr].filter(Boolean).join("\n");
  const blocks = parseJsonBlocks(combined);
  const parsed = blocks.at(-1);

  if (!parsed) {
    throw new Error("Failed to parse onchainos output");
  }

  if (parsed.ok === false) {
    throw new Error(parsed.error || "onchainos request failed");
  }

  return parsed;
}

function formatUnits(rawValue, decimals) {
  const raw = BigInt(String(rawValue || "0"));
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fractionText}`;
}

function toFixedNumber(value, digits = 3) {
  return Number(Number(value || 0).toFixed(digits));
}

function normalizeWalletBalance(payload) {
  const details = payload?.data?.details || [];
  const tokenAssets = details.flatMap((group) => group.tokenAssets || []);
  const tokens = tokenAssets.map((token) => ({
    symbol: token.customSymbol || token.symbol,
    balance: token.balance,
    usdValue: token.usdValue,
    tokenAddress: token.tokenAddress || "",
    tokenPrice: token.tokenPrice,
    address: token.address,
    chainIndex: token.chainIndex
  }));

  const stableToken = tokens.find((token) => /USDT|USDC|USD/.test(token.symbol));
  return {
    accountValueUsd: toFixedNumber(payload?.data?.totalValueUsd || 0, 2),
    address: tokens[0]?.address || "",
    tokens,
    quoteSeedAmount: stableToken ? Math.min(5, Number(stableToken.balance)).toString() : null,
    stableSymbol: stableToken?.symbol || null
  };
}

function normalizeQuote(payload) {
  const quote = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  if (!quote) {
    return null;
  }

  const fromDecimals = Number(quote.fromToken?.decimal || 0);
  const toDecimals = Number(quote.toToken?.decimal || 0);
  const route = (quote.dexRouterList || []).map((entry) => ({
    dexName: entry.dexProtocol?.dexName || "Unknown DEX",
    percent: entry.dexProtocol?.percent || "0"
  }));

  return {
    fromSymbol: quote.fromToken?.tokenSymbol || "UNKNOWN",
    toSymbol: quote.toToken?.tokenSymbol || "UNKNOWN",
    fromAmount: formatUnits(quote.fromTokenAmount || "0", fromDecimals),
    toAmount: formatUnits(quote.toTokenAmount || "0", toDecimals),
    priceImpactPercent: quote.priceImpactPercent || "0",
    tradeFeeUsd: quote.tradeFee || "0",
    route,
    router: quote.router || "",
    network: "X Layer",
    raw: quote
  };
}

async function ensureWalletOnAccount(accountId = DEFAULT_ACCOUNT_ID) {
  await runOnchainosJson(["wallet", "login"]);
  if (accountId) {
    await runOnchainosJson(["wallet", "switch", accountId]);
  }
}

async function getLiveExecutionContext(options = {}) {
  const {
    accountId = process.env.ONCHAINOS_ACCOUNT_ID || DEFAULT_ACCOUNT_ID,
    includeQuote = false
  } = options;

  await ensureWalletOnAccount(accountId);

  const walletPayload = await runOnchainosJson(["wallet", "balance", "--chain", "xlayer", "--force"]);
  const wallet = normalizeWalletBalance(walletPayload);

  let quote = null;
  if (includeQuote && wallet.quoteSeedAmount && Number(wallet.quoteSeedAmount) > 0) {
    const quotePayload = await runOnchainosJson([
      "swap",
      "quote",
      "--from",
      wallet.stableSymbol ? wallet.stableSymbol.toLowerCase() : "usdt",
      "--to",
      "okb",
      "--readable-amount",
      wallet.quoteSeedAmount,
      "--chain",
      "xlayer"
    ]);
    quote = normalizeQuote(quotePayload);
  }

  return {
    updatedAt: new Date().toISOString(),
    wallet,
    quote
  };
}

module.exports = {
  DEFAULT_ACCOUNT_ID,
  buildRuntimeEnv,
  getLiveExecutionContext,
  runOnchainosJson
};
