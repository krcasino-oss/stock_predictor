"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { scoreIndicators } = require("../lib/scoring");

function baseIndicators(overrides = {}) {
  return {
    lastClose: 100,
    sma5: 100,
    sma20: 100,
    sma60: 100,
    rsi14: 50,
    macd: { macd: 0, signal: 0, histogram: 0 },
    bollinger: { middle: 100, upper: 110, lower: 90 },
    volumeRatio: 1,
    ...overrides,
  };
}

test("모든 지표가 중립이면 HOLD/점수 0", () => {
  const result = scoreIndicators(baseIndicators());
  assert.equal(result.totalScore, 0);
  assert.equal(result.label, "HOLD");
});

test("강한 상승 정렬 + 과매도 RSI + 거래량 폭증이면 STRONG_BUY", () => {
  const ind = baseIndicators({
    sma5: 110,
    sma20: 105,
    sma60: 100,
    rsi14: 25,
    macd: { macd: 5, signal: 2, histogram: 3 },
    lastClose: 91,
    volumeRatio: 2.5,
  });
  const result = scoreIndicators(ind);
  assert.equal(result.label, "STRONG_BUY");
  assert.ok(result.totalScore >= 6);
  assert.ok(result.confidence > 0);
});

test("강한 하락 정렬 + 과매수 RSI + 거래량 급감이면 STRONG_SELL", () => {
  const ind = baseIndicators({
    sma5: 90,
    sma20: 95,
    sma60: 100,
    rsi14: 80,
    macd: { macd: -5, signal: -2, histogram: -3 },
    lastClose: 109,
    volumeRatio: 0.3,
  });
  const result = scoreIndicators(ind);
  assert.equal(result.label, "STRONG_SELL");
  assert.ok(result.totalScore <= -6);
});

test("explain은 각 지표별 데이터 출처와 판단근거 문자열을 포함한다", () => {
  const result = scoreIndicators(baseIndicators({ volumeRatio: 2.5 }));
  for (const key of ["trend", "rsi", "macd", "bollinger", "volume"]) {
    assert.ok(typeof result.explain[key].data === "string" && result.explain[key].data.length > 0);
    assert.ok(typeof result.explain[key].reason === "string" && result.explain[key].reason.length > 0);
  }
  assert.match(result.explain.volume.reason, /\(\+2\)/);
});

test("confidence는 0~100 범위를 벗어나지 않는다", () => {
  const ind = baseIndicators({
    sma5: 110,
    sma20: 105,
    sma60: 100,
    rsi14: 10,
    macd: { macd: 5, signal: 1, histogram: 4 },
    lastClose: 90,
    volumeRatio: 3,
  });
  const result = scoreIndicators(ind);
  assert.ok(result.confidence >= 0 && result.confidence <= 100);
});
