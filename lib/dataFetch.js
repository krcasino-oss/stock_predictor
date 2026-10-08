"use strict";

/**
 * 네이버 금융 공개 데이터에서 일봉(OHLCV)을 가져온다.
 * KB증권 API는 현재가만 지원하고 과거 일봉을 제공하지 않으므로,
 * 2단계 예측시스템은 별도의 무료 공개 데이터(네이버 금융)를 사용한다.
 *
 * 응답 형식은 JSON이 아니라 작은따옴표를 쓰는 배열 리터럴 문자열이라
 * 정규식으로 행 단위 파싱을 한다.
 */
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const DATA_DIR = path.join(__dirname, "..", "data");

function cacheFile(symbol) {
  return path.join(DATA_DIR, `${symbol}.json`);
}

function todayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** 캐시가 오늘 생성된 것이면 그대로 사용한다. */
function readCache(symbol) {
  const file = cacheFile(symbol);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (parsed.cachedAt === todayString() && Array.isArray(parsed.rows) && parsed.rows.length > 0) {
      return parsed.rows;
    }
  } catch {
    return null;
  }
  return null;
}

function writeCache(symbol, rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    cacheFile(symbol),
    JSON.stringify({ cachedAt: todayString(), rows }, null, 2),
    "utf-8"
  );
}

/** 네이버 siseJson 응답(작은따옴표 배열 리터럴)을 OHLCV 행 배열로 파싱한다. */
function parseSiseJson(text) {
  const blocks = [...text.matchAll(/\[([^\[\]]*)\]/g)].map((m) => m[1]);
  if (blocks.length < 2) return [];
  // 첫 블록은 헤더(날짜/시가/고가/저가/종가/거래량/...)이므로 제외
  const rows = [];
  for (const block of blocks.slice(1)) {
    const cells = block.split(",").map((c) => c.trim().replace(/^'|'$/g, "").replace(/^"|"$/g, ""));
    if (cells.length < 6) continue;
    const [date, open, high, low, close, volume] = cells;
    if (!/^\d{8}$/.test(date)) continue;
    rows.push({
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    });
  }
  return rows;
}

/**
 * symbol(6자리 종목코드)의 최근 일봉을 가져온다.
 * useCache=false면 캐시를 무시하고 새로 수집한다.
 */
async function fetchOhlcv(symbol, { useCache = true, days = 200 } = {}) {
  if (useCache) {
    const cached = readCache(symbol);
    if (cached) return cached;
  }

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Math.ceil((days * 7) / 5) - 10); // 주말/공휴일 여유분

  const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const url = "https://api.finance.naver.com/siseJson.naver";
  const response = await axios.get(url, {
    params: {
      symbol,
      requestType: 1,
      startTime: fmt(start),
      endTime: fmt(end),
      timeframe: "day",
    },
    timeout: 10000,
  });

  const rows = parseSiseJson(String(response.data)).slice(-days);
  if (rows.length === 0) {
    throw new Error(`'${symbol}' 종목의 일봉 데이터를 가져오지 못했습니다.`);
  }
  writeCache(symbol, rows);
  return rows;
}

module.exports = { fetchOhlcv, parseSiseJson };
