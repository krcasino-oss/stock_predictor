"use strict";

/**
 * 종목 목록을 받아 데이터 수집 -> 지표계산 -> 점수화까지 한 번에 수행하고,
 * 결과를 reports/{date}.json 에 누적 저장한다(예측 검증용 이력).
 */
const fs = require("fs");
const path = require("path");

const { fetchOhlcv } = require("./dataFetch");
const { computeIndicators } = require("./indicators");
const { scoreIndicators } = require("./scoring");
const { detectVolumeAnomaly, isCandidate } = require("./anomaly");

const REPORTS_DIR = path.join(__dirname, "..", "reports");

function todayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function predictOne(symbolInfo, options = {}) {
  const { symbol, name } = symbolInfo;
  try {
    const rows = await fetchOhlcv(symbol, options);
    const indicators = computeIndicators(rows);
    const score = scoreIndicators(indicators);
    const anomaly = detectVolumeAnomaly(rows);
    return {
      symbol,
      name,
      asOf: rows[rows.length - 1]?.date ?? null,
      indicators,
      score,
      anomaly,
      isCandidate: isCandidate(anomaly),
      error: null,
    };
  } catch (err) {
    return {
      symbol,
      name,
      asOf: null,
      indicators: null,
      score: null,
      anomaly: null,
      isCandidate: false,
      error: err.message,
    };
  }
}

async function predictAll(symbols, options = {}) {
  const results = [];
  for (const symbolInfo of symbols) {
    // 네이버 공개 API에 과도한 동시 요청을 보내지 않도록 순차 처리한다.
    // eslint-disable-next-line no-await-in-loop
    results.push(await predictOne(symbolInfo, options));
  }
  return results;
}

function saveDailyReport(results) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const file = path.join(REPORTS_DIR, `${todayString()}.json`);
  fs.writeFileSync(file, JSON.stringify({ date: todayString(), results }, null, 2), "utf-8");
  return file;
}

/** 거래량·수급 이상징후가 있는 종목만 추려 "관심 후보" 목록을 만든다. */
function narrowCandidates(results) {
  return results.filter((r) => r.isCandidate);
}

module.exports = { predictOne, predictAll, saveDailyReport, narrowCandidates, todayString };
