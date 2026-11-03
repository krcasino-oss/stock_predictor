"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const express = require("express");

const { predictAll, predictOne, saveDailyReport, narrowCandidates } = require("./lib/predict");

const app = express();
const PORT = Number(process.env.PORT || 330);
/** 330처럼 1024 미만 포트는 루팅 안 된 안드로이드(Termux)에서 열 수 없으므로 이 포트로 대체한다. */
const FALLBACK_PORT = Number(process.env.FALLBACK_PORT || 3300);
let activePort = PORT;

const SYMBOLS_FILE = path.join(__dirname, "config", "symbols.json");
const LIVE_CHANNELS_FILE = path.join(__dirname, "config", "live-channels.json");

function loadSymbols() {
  return JSON.parse(fs.readFileSync(SYMBOLS_FILE, "utf-8"));
}

/** 사설망(내부망) IPv4 주소 목록을 검사해 반환한다(루프백/내부 인터페이스 제외). */
function getLocalIPs() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/symbols", (req, res) => {
  res.json(loadSymbols());
});

/** 미국 증시 라이브 방송(유튜브) 채널 프리셋 목록. */
app.get("/api/live-channels", (req, res) => {
  res.json(JSON.parse(fs.readFileSync(LIVE_CHANNELS_FILE, "utf-8")));
});

/** 현재 서버가 접속 가능한 내부망 IP와 포트 정보를 반환한다(UI 표시용). */
app.get("/api/server-info", (req, res) => {
  res.json({ port: activePort, localIPs: getLocalIPs() });
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

function printBanner(port) {
  const localIPs = getLocalIPs();
  console.log(`stock-predictor 서버 실행 중 (포트 ${port})`);
  console.log(`  - http://localhost:${port}`);
  console.log(`  - http://localhost:${port}/live.html (미국 증시 라이브 방송)`);
  if (localIPs.length === 0) {
    console.log("  - (내부망 IP를 찾지 못했습니다. 네트워크 연결 상태를 확인하세요.)");
  } else {
    for (const ip of localIPs) {
      console.log(`  - http://${ip}:${port} (같은 네트워크의 다른 기기에서 접속 가능)`);
    }
  }
}

function start(port, allowFallback) {
  const server = app.listen(port, "0.0.0.0", (err) => {
    if (err) return; // Express 5는 실패 시에도 콜백을 호출한다 → 아래 error 핸들러에서 처리
    activePort = port;
    printBanner(port);
  });
  server.on("error", (err) => {
    if (allowFallback && err.code === "EACCES" && port !== FALLBACK_PORT) {
      console.warn(
        `⚠️ 포트 ${port}는 권한이 없어 열 수 없습니다(1024 미만 포트는 Termux에서 루팅 없이 사용 불가).` +
          ` 대신 포트 ${FALLBACK_PORT}로 실행합니다.`
      );
      start(FALLBACK_PORT, false);
      return;
    }
    console.error(`서버 시작 실패 (포트 ${port}): ${err.message}`);
    process.exit(1);
  });
}

if (require.main === module) {
  start(PORT, true);
}

module.exports = app;
