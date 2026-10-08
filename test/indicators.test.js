"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { sma, ema, rsi, macd, bollinger, volumeRatio, computeIndicators } = require("../lib/indicators");

test("sma는 지정 기간 평균을 계산한다", () => {
  assert.equal(sma([1, 2, 3, 4, 5], 5), 3);
  assert.equal(sma([1, 2, 3], 5), null);
});

test("ema는 데이터가 충분하면 값을 반환한다", () => {
  const values = Array.from({ length: 30 }, (_, i) => 100 + i);
  const result = ema(values, 12);
  assert.ok(typeof result === "number");
});

test("rsi는 상승만 있으면 100에 가깝다", () => {
  const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
  const result = rsi(closes, 14);
  assert.equal(result, 100);
});

test("rsi는 하락만 있으면 0이다", () => {
  const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
  const result = rsi(closes, 14);
  assert.equal(result, 0);
});

test("macd는 데이터가 부족하면 null을 반환한다", () => {
  assert.equal(macd([1, 2, 3]), null);
});

test("bollinger는 중심선과 상하단 밴드를 계산한다", () => {
  const closes = Array(20).fill(100);
  const b = bollinger(closes, 20);
  assert.equal(b.middle, 100);
  assert.equal(b.upper, 100);
  assert.equal(b.lower, 100);
});

test("volumeRatio는 평균 대비 최근 거래량 배율을 계산한다", () => {
  const volumes = Array(20).fill(1000).concat([3000]);
  const ratio = volumeRatio(volumes, 20);
  assert.equal(ratio, 3);
});

test("computeIndicators는 OHLCV 행에서 전체 지표를 계산한다", () => {
  const rows = Array.from({ length: 70 }, (_, i) => ({
    date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100 + i,
    volume: 1000 + i,
  }));
  const ind = computeIndicators(rows);
  assert.equal(ind.lastClose, rows[rows.length - 1].close);
  assert.ok(ind.sma5 !== null);
  assert.ok(ind.sma20 !== null);
  assert.ok(ind.sma60 !== null);
  assert.ok(ind.rsi14 !== null);
});
