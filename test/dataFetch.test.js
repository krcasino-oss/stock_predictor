"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { parseSiseJson } = require("../lib/dataFetch");

test("parseSiseJson은 네이버 siseJson 응답을 OHLCV 배열로 변환한다", () => {
  const sample = `
[['날짜','시가','고가','저가','종가','거래량','외국인소진율'],
['20250901', 68400, 68600, 67500, 67600, 12002343, 50.32],
['20250902', 67700, 68200, 67300, 68000, 9000000, 50.40]
]`;
  const rows = parseSiseJson(sample);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    date: "2025-09-01",
    open: 68400,
    high: 68600,
    low: 67500,
    close: 67600,
    volume: 12002343,
  });
  assert.equal(rows[1].date, "2025-09-02");
});

test("parseSiseJson은 헤더만 있으면 빈 배열을 반환한다", () => {
  const rows = parseSiseJson("[['날짜','시가','고가','저가','종가','거래량']]");
  assert.deepEqual(rows, []);
});

test("parseSiseJson은 날짜 형식이 아닌 행을 건너뛴다", () => {
  const sample = `[['header'],['invalid', 1, 2, 3, 4, 5]]`;
  const rows = parseSiseJson(sample);
  assert.deepEqual(rows, []);
});
