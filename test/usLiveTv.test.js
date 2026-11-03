"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");

const { handler } = require("../minute_predictor/us-live-tv/server");

function get(server, urlPath) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    http.get({ host: "127.0.0.1", port, path: urlPath }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode, type: res.headers["content-type"], body }));
    }).on("error", reject);
  });
}

test("독립 실행판 live-utils.js는 메인 버전과 동일해야 한다", () => {
  const a = fs.readFileSync(path.join(__dirname, "../public/live-utils.js"), "utf-8");
  const b = fs.readFileSync(path.join(__dirname, "../minute_predictor/us-live-tv/public/live-utils.js"), "utf-8");
  assert.equal(a, b);
});

test("독립 실행판 서버: 화면·채널 API 제공, 상위 경로 접근 차단", async () => {
  const server = http.createServer(handler).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    const home = await get(server, "/");
    assert.equal(home.status, 200);
    assert.match(home.type, /text\/html/);
    const api = await get(server, "/api/live-channels");
    assert.equal(api.status, 200);
    assert.ok(JSON.parse(api.body).length > 0);
    assert.equal((await get(server, "/%2e%2e/server.js")).status, 404);
    assert.equal((await get(server, "/..%2fserver.js")).status, 403);
  } finally {
    server.close();
  }
});
