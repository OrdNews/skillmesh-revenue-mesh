const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { getStableConfig } = require("./okx-x402");

const execFileAsync = promisify(execFile);

const DEFAULT_PROXY_URL = "http://127.0.0.1:7890";
const DEFAULT_ACCOUNT_ID = "095cbe13-ef3e-4969-9858-fa3566ea4f56";
const ONCHAINOS_PATH = path.join(os.homedir(), ".local", "bin");
const SECURITY_CACHE_FILE = path.join(__dirname, "..", "security-scan-cache.json");
const SCOUT_INTEL_CACHE_FILE = path.join(__dirname, "..", "scout-intel-cache.json");
const SECURITY_RISK_FLAGS = [
  "isRiskToken",
  "isHoneypot",
  "isFakeLiquidity",
  "isLiquidityRemoval",
  "isLowLiquidity",
  "isPump",
  "isDumping",
  "isCounterfeit",
  "isAirdropScam",
  "isRubbishAirdrop",
  "isWash",
  "isWash2",
  "isFundLinkage",
  "isHasBlockingHis",
  "isOverIssued"
];
const SIGNAL_WALLET_TYPE_LABELS = {
  "1": "smart money",
  "2": "KOL",
  "3": "whale"
};

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

function toNullableNumber(value, digits = null) {
  if (value == null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return digits == null ? parsed : Number(parsed.toFixed(digits));
}

function formatCompactUsd(value) {
  const amount = toNullableNumber(value);
  if (amount == null) {
    return "n/a";
  }

  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(2)}B`;
  }

  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }

  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(2)}K`;
  }

  return `$${amount.toFixed(2)}`;
}

function formatPercent(value) {
  const parsed = toNullableNumber(value, 2);
  return parsed == null ? "n/a" : `${parsed}%`;
}

function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

function readSecurityCache() {
  if (!fs.existsSync(SECURITY_CACHE_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(SECURITY_CACHE_FILE, "utf8"));
  } catch (error) {
    return null;
  }
}

function writeSecurityCache(payload) {
  try {
    fs.writeFileSync(SECURITY_CACHE_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  } catch (error) {
    // Best effort cache only.
  }
}

function readScoutIntelCache() {
  if (!fs.existsSync(SCOUT_INTEL_CACHE_FILE)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(SCOUT_INTEL_CACHE_FILE, "utf8"));
  } catch (error) {
    return null;
  }
}

function writeScoutIntelCache(payload) {
  try {
    fs.writeFileSync(SCOUT_INTEL_CACHE_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  } catch (error) {
    // Best effort cache only.
  }
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

function normalizeTargetSymbol(value, fallback = "UNKNOWN") {
  const symbol = String(value || fallback).trim();
  return symbol || fallback;
}

function extractQuoteTokenAddress(quote) {
  const candidates = [
    quote?.raw?.toToken?.tokenContractAddress,
    quote?.raw?.toToken?.tokenAddress,
    quote?.raw?.toToken?.address,
    quote?.raw?.toToken?.contractAddress,
    quote?.raw?.routerResult?.toToken?.tokenContractAddress,
    quote?.raw?.routerResult?.toToken?.tokenAddress
  ];

  return candidates.find((candidate) => isEvmAddress(candidate)) || "";
}

function buildSecurityTargets(context = {}) {
  const stable = getStableConfig();
  const targets = [];
  const pushTarget = (target) => {
    const normalizedAddress = String(target.address || "").toLowerCase();
    if (!isEvmAddress(normalizedAddress)) {
      return;
    }

    if (targets.some((entry) => entry.chainId === target.chainId && entry.address === normalizedAddress)) {
      return;
    }

    targets.push({
      chainId: String(target.chainId || "196"),
      address: normalizedAddress,
      symbol: normalizeTargetSymbol(target.symbol),
      role: target.role || "token"
    });
  };

  pushTarget({
    chainId: "196",
    address: stable.asset,
    symbol: stable.symbol,
    role: "settlement-asset"
  });

  const quoteAddress = extractQuoteTokenAddress(context.quote);
  if (quoteAddress) {
    pushTarget({
      chainId: "196",
      address: quoteAddress,
      symbol: context.quote?.toSymbol || "ROUTE_TARGET",
      role: "route-target"
    });
  }

  return targets;
}

function buildScoutTarget(context = {}) {
  const stable = getStableConfig();
  const quoteAddress =
    context.quote?.raw?.toToken?.tokenContractAddress ||
    context.quote?.raw?.routerResult?.toToken?.tokenContractAddress ||
    extractQuoteTokenAddress(context.quote);

  return {
    chain: "xlayer",
    chainId: "196",
    symbol: normalizeTargetSymbol(context.quote?.toSymbol || stable.symbol),
    address: String(quoteAddress || stable.asset).toLowerCase(),
    role: context.quote ? "route-target" : "settlement-asset"
  };
}

function summarizeRiskFlags(scan) {
  return SECURITY_RISK_FLAGS.filter((flag) => Boolean(scan?.[flag]))
    .map((flag) => flag.replace(/^is/, "").replace(/([A-Z])/g, " $1").trim().toLowerCase());
}

function buildRiskGate(targets, scans, options = {}) {
  const findings = scans
    .map((scan) => {
      const flags = summarizeRiskFlags(scan);
      const target = targets.find(
        (entry) =>
          entry.address.toLowerCase() === String(scan.tokenAddress || "").toLowerCase() &&
          entry.chainId === String(scan.chainId || "")
      );

      return {
        chainId: String(scan.chainId || ""),
        tokenAddress: String(scan.tokenAddress || ""),
        symbol: target?.symbol || "UNKNOWN",
        role: target?.role || "token",
        supported: Boolean(scan.isChainSupported),
        highRisk: Boolean(scan.isRiskToken),
        buyTaxes: scan.buyTaxes || "0",
        sellTaxes: scan.sellTaxes || "0",
        flags
      };
    })
    .filter((entry) => entry.tokenAddress);

  let status = "pass";
  if (findings.some((entry) => entry.highRisk)) {
    status = "block";
  } else if (findings.some((entry) => entry.supported === false)) {
    status = "warn";
  } else if (options.degraded) {
    status = "degraded";
  }

  let summary = "OKX Security cleared the current treasury lane. No high-risk token signals were detected.";
  if (status === "block") {
    summary = "OKX Security flagged a high-risk token condition. Treasury deployment is blocked until the route changes.";
  } else if (status === "warn") {
    summary = "OKX Security returned a partial or unsupported result. Manual review is required before treasury deployment.";
  } else if (status === "degraded") {
    summary = "OKX Security could not complete a live scan. Treasury actions should remain review-gated until a clean scan lands.";
  } else if (options.cached) {
    summary = "OKX Security is serving the last verified cached scan while the live security rail recovers.";
  }

  return {
    status,
    source: options.source || "okx-security",
    scannedAt: new Date().toISOString(),
    summary,
    cached: Boolean(options.cached),
    targets,
    findings,
    error: options.error || null
  };
}

function normalizeSignalEntries(entries, target) {
  return (Array.isArray(entries) ? entries : [])
    .slice(0, 6)
    .map((entry) => {
      const tokenAddress = String(entry?.token?.tokenAddress || "").toLowerCase();
      const symbol = normalizeTargetSymbol(entry?.token?.symbol, "UNKNOWN");

      return {
        tokenAddress,
        symbol,
        name: String(entry?.token?.name || symbol),
        amountUsd: toNullableNumber(entry?.amountUsd, 2),
        soldRatioPercent: toNullableNumber(entry?.soldRatioPercent, 2),
        triggerWalletCount: toNullableNumber(entry?.triggerWalletCount),
        walletType: String(entry?.walletType || ""),
        walletTypeLabel: SIGNAL_WALLET_TYPE_LABELS[String(entry?.walletType || "")] || "watchlist",
        marketCapUsd: toNullableNumber(entry?.token?.marketCapUsd, 2),
        top10HolderPercent: toNullableNumber(entry?.token?.top10HolderPercent, 2),
        timestamp: entry?.timestamp || null,
        matchedTarget:
          (tokenAddress && tokenAddress === String(target.address || "").toLowerCase()) ||
          symbol.toUpperCase() === String(target.symbol || "").toUpperCase()
      };
    });
}

function buildScoutVerdict(targetSnapshot, signalSnapshot, riskGate = null) {
  const reasons = [];
  let score = 0;

  if (targetSnapshot.communityRecognized) {
    score += 2;
    reasons.push("Target is community-recognized, which reduces symbol ambiguity.");
  } else {
    reasons.push("Target is not community-recognized, so symbol ambiguity stays elevated.");
  }

  if (targetSnapshot.riskControlLevel != null) {
    if (targetSnapshot.riskControlLevel <= 1) {
      score += 1;
      reasons.push(`Risk control level ${targetSnapshot.riskControlLevel} stays in the lowest OKX tier.`);
    } else if (targetSnapshot.riskControlLevel >= 3) {
      score -= 2;
      reasons.push(`Risk control level ${targetSnapshot.riskControlLevel} requires manual treasury review.`);
    }
  }

  if (targetSnapshot.liquidityUsd != null) {
    if (targetSnapshot.liquidityUsd >= 1_000_000) {
      score += 1;
      reasons.push(`Liquidity at ${formatCompactUsd(targetSnapshot.liquidityUsd)} can support treasury-sized routing.`);
    } else if (targetSnapshot.liquidityUsd < 100_000) {
      score -= 1;
      reasons.push(`Liquidity at ${formatCompactUsd(targetSnapshot.liquidityUsd)} is thin for treasury deployment.`);
    }
  }

  if (targetSnapshot.top10HoldPercent != null) {
    if (targetSnapshot.top10HoldPercent <= 25) {
      score += 1;
      reasons.push(`Top-10 concentration is contained at ${formatPercent(targetSnapshot.top10HoldPercent)}.`);
    } else if (targetSnapshot.top10HoldPercent >= 40) {
      score -= 1;
      reasons.push(`Top-10 concentration is elevated at ${formatPercent(targetSnapshot.top10HoldPercent)}.`);
    }
  }

  if (targetSnapshot.bundleHoldingPercent != null) {
    if (targetSnapshot.bundleHoldingPercent <= 1) {
      score += 1;
      reasons.push(`Bundle concentration remains low at ${formatPercent(targetSnapshot.bundleHoldingPercent)}.`);
    } else if (targetSnapshot.bundleHoldingPercent >= 5) {
      score -= 1;
      reasons.push(`Bundle concentration is high at ${formatPercent(targetSnapshot.bundleHoldingPercent)}.`);
    }
  }

  const matchingSignal = signalSnapshot.topSignals.find((signal) => signal.matchedTarget);
  if (matchingSignal) {
    reasons.push(
      `A matching ${matchingSignal.walletTypeLabel} signal hit ${targetSnapshot.symbol} for ${formatCompactUsd(
        matchingSignal.amountUsd
      )} with ${formatPercent(matchingSignal.soldRatioPercent)} sold ratio.`
    );

    if (matchingSignal.soldRatioPercent != null && matchingSignal.soldRatioPercent <= 50) {
      score += 1;
    } else if (matchingSignal.soldRatioPercent != null && matchingSignal.soldRatioPercent >= 85) {
      score -= 1;
    }
  } else if (signalSnapshot.topSignals.length) {
    const leadSignal = signalSnapshot.topSignals[0];
    reasons.push(
      `No direct signal is attached to ${targetSnapshot.symbol}; current X Layer board is led by ${leadSignal.symbol}.`
    );
  } else {
    reasons.push("Signal board is quiet, so the decision relies on structure rather than crowd flow.");
  }

  if (riskGate?.status && riskGate.status !== "pass") {
    reasons.push(`Security gate currently reports ${riskGate.status}, so spend must stay review-gated.`);
  }

  let lane = "review";
  let summary =
    "Scout sees a speculative or structurally weak lane. Treasury should keep budget deployment in review mode.";

  if (score >= 4) {
    lane = "budget-ready";
    summary =
      "Scout sees a liquid, community-recognized lane with manageable concentration. Treasury can open budget if the security gate stays clean.";
  } else if (score >= 2) {
    lane = "watch";
    summary =
      "Scout sees a usable lane, but concentration or flow signals still warrant monitored budget deployment.";
  }

  return {
    lane,
    score,
    summary,
    reasons: reasons.slice(0, 6)
  };
}

function buildScoutIntelligence(target, priceInfo, advancedInfo, rawSignals, riskGate, options = {}) {
  const signalSnapshot = {
    chainId: "196",
    chainName: "X Layer",
    totalSignals: Array.isArray(rawSignals) ? rawSignals.length : 0,
    topSignals: normalizeSignalEntries(rawSignals, target)
  };

  signalSnapshot.matchedTarget = signalSnapshot.topSignals.some((signal) => signal.matchedTarget);

  const tokenTags = Array.isArray(advancedInfo?.tokenTags) ? advancedInfo.tokenTags : [];
  const targetSnapshot = {
    chainId: "196",
    chainName: "X Layer",
    symbol: target.symbol,
    address: target.address,
    role: target.role,
    priceUsd: toNullableNumber(priceInfo?.price, 6),
    marketCapUsd: toNullableNumber(priceInfo?.marketCap, 2),
    liquidityUsd: toNullableNumber(priceInfo?.liquidity, 2),
    volume24hUsd: toNullableNumber(priceInfo?.volume24H, 2),
    holders: toNullableNumber(priceInfo?.holders),
    txs24h: toNullableNumber(priceInfo?.txs24H),
    priceChange24H: toNullableNumber(priceInfo?.priceChange24H, 2),
    riskControlLevel: toNullableNumber(advancedInfo?.riskControlLevel),
    top10HoldPercent: toNullableNumber(advancedInfo?.top10HoldPercent, 2),
    bundleHoldingPercent: toNullableNumber(advancedInfo?.bundleHoldingPercent, 2),
    communityRecognized: tokenTags.includes("communityRecognized"),
    tokenTags
  };

  return {
    status: options.status || "live",
    source: options.source || "okx-market-scout",
    scannedAt: new Date().toISOString(),
    cached: Boolean(options.cached),
    error: options.error || null,
    target: targetSnapshot,
    signals: signalSnapshot,
    verdict: buildScoutVerdict(targetSnapshot, signalSnapshot, riskGate)
  };
}

async function getLiveScoutIntel(context = {}) {
  const target = buildScoutTarget(context);
  const cache = readScoutIntelCache();

  try {
    const [pricePayload, advancedPayload] = await Promise.all([
      runOnchainosJson(["token", "price-info", "--chain", target.chain, "--address", target.address], {
        timeout: 60_000
      }),
      runOnchainosJson(["token", "advanced-info", "--chain", target.chain, "--address", target.address], {
        timeout: 60_000
      })
    ]);

    const priceInfo = Array.isArray(pricePayload?.data) ? pricePayload.data[0] || null : pricePayload?.data || null;
    const advancedInfo = advancedPayload?.data || null;

    let rawSignals = [];
    let signalError = null;

    try {
      const signalPayload = await runOnchainosJson(["signal", "list", "--chain", target.chain], {
        timeout: 60_000
      });
      rawSignals = Array.isArray(signalPayload?.data) ? signalPayload.data : [];
    } catch (error) {
      signalError = error;
      if (cache?.target?.address === target.address && Array.isArray(cache?.signals?.topSignals)) {
        rawSignals = cache.signals.topSignals.map((entry) => ({
          amountUsd: entry.amountUsd,
          soldRatioPercent: entry.soldRatioPercent,
          walletType: entry.walletType,
          triggerWalletCount: entry.triggerWalletCount,
          timestamp: entry.timestamp,
          token: {
            tokenAddress: entry.tokenAddress,
            symbol: entry.symbol,
            name: entry.name,
            marketCapUsd: entry.marketCapUsd,
            top10HolderPercent: entry.top10HolderPercent
          }
        }));
      }
    }

    const scoutIntel = buildScoutIntelligence(target, priceInfo, advancedInfo, rawSignals, context.riskGate, {
      source: signalError ? "okx-market-scout + cached-signals" : "okx-market-scout",
      cached: Boolean(signalError && cache?.signals?.topSignals),
      error: signalError ? `Signal feed fallback: ${signalError.message}` : null
    });

    writeScoutIntelCache(scoutIntel);
    return scoutIntel;
  } catch (error) {
    if (cache?.target) {
      return {
        ...cache,
        source: "cached-market-scout",
        cached: true,
        error: error.message
      };
    }

    return {
      status: "degraded",
      source: "okx-market-scout",
      scannedAt: new Date().toISOString(),
      cached: false,
      error: error.message,
      target: {
        chainId: "196",
        chainName: "X Layer",
        symbol: target.symbol,
        address: target.address,
        role: target.role
      },
      signals: {
        chainId: "196",
        chainName: "X Layer",
        totalSignals: 0,
        matchedTarget: false,
        topSignals: []
      },
      verdict: {
        lane: "review",
        score: 0,
        summary:
          "Scout could not refresh live market structure data, so the treasury lane stays in review mode.",
        reasons: ["Live token intelligence could not be refreshed from OKX."]
      }
    };
  }
}

async function getLiveRiskGate(context = {}) {
  const targets = buildSecurityTargets(context);
  if (!targets.length) {
    return buildRiskGate([], [], {
      degraded: true,
      source: "okx-security",
      error: "No scannable EVM token contracts were available for the current treasury lane."
    });
  }

  const tokenArg = targets.map((target) => `${target.chainId}:${target.address}`).join(",");

  try {
    const payload = await runOnchainosJson(["security", "token-scan", "--tokens", tokenArg], {
      timeout: 60_000
    });
    const scans = Array.isArray(payload?.data) ? payload.data : [];
    const gate = buildRiskGate(targets, scans, {
      source: "okx-security"
    });

    writeSecurityCache({
      updatedAt: gate.scannedAt,
      tokenArg,
      gate
    });

    return gate;
  } catch (error) {
    const cache = readSecurityCache();
    if (cache?.gate) {
      return {
        ...cache.gate,
        source: "cached-okx-security",
        cached: true,
        error: error.message,
        summary: "Live OKX Security scanning failed, so the dashboard is using the last verified cached scan."
      };
    }

    return buildRiskGate(targets, [], {
      degraded: true,
      source: "okx-security",
      error: error.message
    });
  }
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
    includeQuote = false,
    includeRiskGate = true,
    includeScoutIntel = true
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

  let riskGate = null;
  if (includeRiskGate) {
    riskGate = await getLiveRiskGate({ wallet, quote });
  }

  let scoutIntel = null;
  if (includeScoutIntel) {
    scoutIntel = await getLiveScoutIntel({ wallet, quote, riskGate });
  }

  return {
    updatedAt: new Date().toISOString(),
    wallet,
    quote,
    riskGate,
    scoutIntel
  };
}

module.exports = {
  DEFAULT_ACCOUNT_ID,
  buildRuntimeEnv,
  getLiveExecutionContext,
  getLiveRiskGate,
  getLiveScoutIntel,
  runOnchainosJson
};
