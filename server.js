"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");

const { predictAll, predictOne, saveDailyReport, narrowCandidates } = require("./lib/predict");

const app = express();
const PORT = Number(process.env.PORT || 3100);

const SYMBOLS_FILE = path.join(__dirname, "config", "symbols.json");

function loadSymbols() {
  return JSON.parse(fs.readFileSync(SYMBOLS_FILE, "utf-8"));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/symbols", (req, res) => {
  res.json(loadSymbols());
});

/** 등록된 전체 종목을 예측하고 결과를 리포트에 저장한다. */
app.get("/api/predict", async (req, res) => {
  try {
    const symbols = loadSymbols();
    const useCache = req.query.refresh !== "1";
    const results = await predictAll(symbols, { useCache });
    saveDailyReport(results);
    res.json({ date: new Date().toISOString(), results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** 단일 종목코드로 즉시 예측한다(등록 여부와 무관). */
app.get("/api/predict/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const useCache = req.query.refresh !== "1";
    const symbols = loadSymbols();
    const known = symbols.find((s) => s.symbol === symbol);
    const result = await predictOne(known ?? { symbol, name: symbol }, { useCache });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** 거래량·수급 이상징후가 포착된 종목만 추려서 보여준다(후보 축소). */
app.get("/api/candidates", async (req, res) => {
  try {
    const symbols = loadSymbols();
    const useCache = req.query.refresh !== "1";
    const results = await predictAll(symbols, { useCache });
    saveDailyReport(results);
    const candidates = narrowCandidates(results);
    res.json({
      date: new Date().toISOString(),
      total: results.length,
      candidateCount: candidates.length,
      results: candidates,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`stock-predictor 서버 실행 중: http://0.0.0.0:${PORT}`);
});

module.exports = app;
