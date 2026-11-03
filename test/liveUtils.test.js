"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseYouTubeInput, buildEmbedUrl, buildWatchUrl, usMarketStatus } = require("../public/live-utils");

const CH = "UCrp_UI8XtuYfpiqluWLD7Lw";

test("다양한 유튜브 주소 형식을 해석한다", () => {
  assert.deepEqual(parseYouTubeInput("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1"), { type: "video", videoId: "dQw4w9WgXcQ" });
  assert.deepEqual(parseYouTubeInput("youtu.be/dQw4w9WgXcQ"), { type: "video", videoId: "dQw4w9WgXcQ" });
  assert.deepEqual(parseYouTubeInput("https://m.youtube.com/live/dQw4w9WgXcQ?si=x"), { type: "video", videoId: "dQw4w9WgXcQ" });
  assert.deepEqual(parseYouTubeInput(`https://www.youtube.com/channel/${CH}`), { type: "channel", channelId: CH });
  assert.deepEqual(parseYouTubeInput(CH), { type: "channel", channelId: CH });
  assert.deepEqual(parseYouTubeInput("https://www.youtube.com/@CNBCtelevision/live"), { type: "handle", handle: "CNBCtelevision" });
  assert.deepEqual(parseYouTubeInput("@markets"), { type: "handle", handle: "markets" });
});

test("유튜브가 아니거나 빈 입력은 null", () => {
  assert.equal(parseYouTubeInput(""), null);
  assert.equal(parseYouTubeInput("https://example.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(parseYouTubeInput("아무말"), null);
});

test("임베드 주소에 한글 자막 옵션이 들어간다", () => {
  const url = new URL(buildEmbedUrl({ type: "channel", channelId: CH }));
  assert.equal(url.pathname, "/embed/live_stream");
  assert.equal(url.searchParams.get("channel"), CH);
  assert.equal(url.searchParams.get("cc_lang_pref"), "ko");
  assert.equal(url.searchParams.get("cc_load_policy"), "1");
  assert.equal(buildEmbedUrl({ type: "handle", handle: "x" }), null);
});

test("유튜브에서 열기 주소는 핸들을 우선 사용한다", () => {
  assert.equal(buildWatchUrl({ type: "channel", channelId: CH, handle: "CNBCtelevision" }), "https://www.youtube.com/@CNBCtelevision/live");
  assert.equal(buildWatchUrl({ type: "channel", channelId: CH }), `https://www.youtube.com/channel/${CH}/live`);
});

test("미국 장 상태를 뉴욕 시간 기준으로 판단한다", () => {
  // 2026-11-03(화) 15:00Z = 뉴욕 10:00 (EST)
  assert.equal(usMarketStatus(new Date("2026-11-03T15:00:00Z")).session, "OPEN");
  assert.equal(usMarketStatus(new Date("2026-11-03T12:00:00Z")).session, "PRE");
  assert.equal(usMarketStatus(new Date("2026-11-03T22:00:00Z")).session, "AFTER");
  assert.equal(usMarketStatus(new Date("2026-11-07T15:00:00Z")).session, "CLOSED");
});
