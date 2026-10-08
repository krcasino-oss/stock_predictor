"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  detectVolumeAnomaly,
  isCandidate,
  volumeStreak,
  detectDivergence,
  detectBreakout,
} = require("../lib/anomaly");

function makeRows(closes, volumes) {
  return closes.map((close, i) => ({
    date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
    open: close,
    high: close,
    low: close,
    close,
    volume: volumes[i],
  }));
}

test("데이터가 부족하면 NONE/빈 신호", () => {
  const result = detectVolumeAnomaly(makeRows([100, 101], [1000, 1000]));
  assert.equal(result.level, "NONE");
  assert.deepEqual(result.signals, []);
});

test("평소와 비슷한 흐름이면 이상징후가 없다", () => {
  const closes = Array(30).fill(100);
  const volumes = Array(30).fill(1000);
  const result = detectVolumeAnomaly(makeRows(closes, volumes));
  assert.equal(result.level, "NONE");
});

test("거래량이 평균 대비 3배 이상이면 HIGH 레벨 VOLUME_SURGE", () => {
  const closes = Array(21).fill(100);
  const volumes = Array(20).fill(1000).concat([3500]);
  const result = detectVolumeAnomaly(makeRows(closes, volumes));
  assert.equal(result.level, "HIGH");
  assert.ok(result.signals.some((s) => s.type === "VOLUME_SURGE" && s.level === "HIGH"));
});

test("거래량이 평균 대비 0.4배 미만이면 MEDIUM 레벨 VOLUME_COLLAPSE", () => {
  const closes = Array(21).fill(100);
  const volumes = Array(20).fill(1000).concat([300]);
  const result = detectVolumeAnomaly(makeRows(closes, volumes));
  assert.ok(result.signals.some((s) => s.type === "VOLUME_COLLAPSE"));
});

test("volumeStreak은 연속 증가일수를 센다", () => {
  assert.equal(volumeStreak([100, 200, 300, 400]), 3);
  assert.equal(volumeStreak([400, 300, 200, 100]), 0);
  assert.equal(volumeStreak([100, 200, 150, 300]), 1);
});

test("거래량 5일 연속 증가면 HIGH 레벨 VOLUME_STREAK", () => {
  const closes = Array(26).fill(100);
  const baseVolumes = Array(20).fill(1000);
  const risingVolumes = [1000, 1100, 1200, 1300, 1400, 1500];
  const result = detectVolumeAnomaly(makeRows(closes, baseVolumes.concat(risingVolumes)));
  assert.ok(result.signals.some((s) => s.type === "VOLUME_STREAK" && s.level === "HIGH"));
});

test("detectDivergence는 가격 상승+거래량 감소를 BEARISH_DIVERGENCE로 판정한다", () => {
  // period=5 → 직전 5일(2000 x5)과 최근 5일(500 x5) 비교, 가격은 100->110으로 상승
  const closes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 110];
  const volumes = [2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 500];
  const result = detectDivergence(closes, volumes, 5);
  assert.equal(result.type, "BEARISH_DIVERGENCE");
});

test("detectDivergence는 가격 하락+거래량 급증을 CAPITULATION_RISK로 판정한다", () => {
  const closes = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 90];
  const volumes = [500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 2000];
  const result = detectDivergence(closes, volumes, 5);
  assert.equal(result.type, "CAPITULATION_RISK");
});

test("detectBreakout은 최근 구간의 신고가/신저가 여부를 판정한다", () => {
  const closes = [90, 95, 100, 105, 110];
  const result = detectBreakout(closes, 5);
  assert.equal(result.isNewHigh, true);
  assert.equal(result.isNewLow, false);
});

test("신고가 경신 + 거래량 동반이면 HIGH 레벨 BREAKOUT_HIGH", () => {
  const closes = Array(59).fill(100).concat([120]);
  const volumes = Array(59).fill(1000).concat([1800]);
  const result = detectVolumeAnomaly(makeRows(closes, volumes));
  assert.ok(result.signals.some((s) => s.type === "BREAKOUT_HIGH"));
});

test("isCandidate는 level이 NONE이 아니면 true다", () => {
  assert.equal(isCandidate({ level: "HIGH", signals: [] }), true);
  assert.equal(isCandidate({ level: "MEDIUM", signals: [] }), true);
  assert.equal(isCandidate({ level: "NONE", signals: [] }), false);
  assert.equal(isCandidate(null), false);
});
