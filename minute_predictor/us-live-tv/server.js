#!/usr/bin/env node
"use strict";
/**
 * 미국 증시 라이브 방송(유튜브) 골라보기 - 독립 실행 서버
 * Node.js 기본 모듈만 사용하므로 npm install이 필요 없습니다.
 *   실행: node server.js
 *   기본 포트 3200 (변경: PORT=번호 node server.js)
 */
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = Number(process.env.PORT || 3200);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const CHANNELS_FILE = path.join(__dirname, "channels.json");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
  res.end(body);
}

function handler(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch (e) {
    return send(res, 400, "잘못된 요청");
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "허용되지 않는 요청");

  if (pathname === "/api/live-channels") {
    fs.readFile(CHANNELS_FILE, "utf-8", (err, text) => {
      if (err) return send(res, 500, JSON.stringify({ error: "channels.json을 읽을 수 없습니다." }), MIME[".json"]);
      try {
        JSON.parse(text);
      } catch (e) {
        return send(res, 500, JSON.stringify({ error: "channels.json 형식 오류: " + e.message }), MIME[".json"]);
      }
      send(res, 200, text, MIME[".json"]);
    });
    return;
  }

  if (pathname === "/" || pathname === "/live.html") pathname = "/index.html";
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, "접근 불가");

  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, "없는 페이지입니다");
    send(res, 200, data, MIME[path.extname(file)] || "application/octet-stream");
  });
}

function localIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) if (net.family === "IPv4" && !net.internal) out.push(net.address);
  }
  return out;
}

function start(port) {
  const server = http.createServer(handler);
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") console.error(`포트 ${port}가 이미 사용 중입니다. PORT=다른번호 node server.js 로 실행하세요.`);
    else if (err.code === "EACCES") console.error(`포트 ${port}를 열 권한이 없습니다. 1024 이상 포트를 사용하세요.`);
    else console.error(`서버 시작 실패 (포트 ${port}): ${err.message}`);
    process.exit(1);
  });
  server.listen(port, HOST, () => {
    console.log(`📺 미국 증시 라이브 방송 서버 실행 중 (포트 ${port})`);
    console.log(`  - 이 폰에서:   http://127.0.0.1:${port}`);
    for (const ip of localIPs()) console.log(`  - 같은 와이파이: http://${ip}:${port}`);
    console.log("  (종료: Ctrl+C)");
  });
}

if (require.main === module) start(PORT);

module.exports = { handler };
