/* 라이브 방송 페이지 공용 유틸 (브라우저 + Node 테스트 겸용) */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LiveUtils = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
  const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

  /**
   * 사용자가 입력한 유튜브 주소/ID를 해석한다.
   * @returns {{type:"video",videoId:string}|{type:"channel",channelId:string}|{type:"handle",handle:string}|null}
   */
  function parseYouTubeInput(input) {
    const s = String(input || "").trim();
    if (!s) return null;
    if (CHANNEL_ID.test(s)) return { type: "channel", channelId: s };
    if (VIDEO_ID.test(s)) return { type: "video", videoId: s };
    if (/^@[\w.-]+$/.test(s)) return { type: "handle", handle: s.slice(1) };

    let url;
    try {
      url = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s);
    } catch (e) {
      return null;
    }
    const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
    const parts = url.pathname.split("/").filter(Boolean);

    if (host === "youtu.be" && parts[0] && VIDEO_ID.test(parts[0])) {
      return { type: "video", videoId: parts[0] };
    }
    if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;

    const v = url.searchParams.get("v");
    if (v && VIDEO_ID.test(v)) return { type: "video", videoId: v };
    if (["live", "embed", "shorts", "v"].includes(parts[0]) && parts[1] && VIDEO_ID.test(parts[1])) {
      return { type: "video", videoId: parts[1] };
    }
    if (parts[0] === "embed" && parts[1] === "live_stream") {
      const ch = url.searchParams.get("channel");
      if (ch && CHANNEL_ID.test(ch)) return { type: "channel", channelId: ch };
    }
    if (parts[0] === "channel" && parts[1] && CHANNEL_ID.test(parts[1])) {
      return { type: "channel", channelId: parts[1] };
    }
    if (parts[0] && parts[0].startsWith("@") && parts[0].length > 1) {
      return { type: "handle", handle: decodeURIComponent(parts[0].slice(1)) };
    }
    return null;
  }

  /** 한글 자막 우선 옵션을 포함한 임베드 주소. 핸들은 임베드가 불가능하므로 null. */
  function buildEmbedUrl(source, opts) {
    const o = opts || {};
    const params = new URLSearchParams({
      autoplay: "1",
      mute: o.mute ? "1" : "0",
      playsinline: "1",
      enablejsapi: "1",
      rel: "0",
      hl: "ko",
      cc_lang_pref: "ko",
      cc_load_policy: o.captions === false ? "0" : "1",
    });
    if (o.origin) params.set("origin", o.origin);
    if (source.type === "video") {
      return "https://www.youtube.com/embed/" + source.videoId + "?" + params;
    }
    if (source.type === "channel") {
      params.set("channel", source.channelId);
      return "https://www.youtube.com/embed/live_stream?" + params;
    }
    return null;
  }

  /** 유튜브(앱/사이트)에서 직접 여는 주소. */
  function buildWatchUrl(source) {
    if (source.type === "video") return "https://www.youtube.com/watch?v=" + source.videoId;
    if (source.handle) return "https://www.youtube.com/@" + source.handle + "/live";
    if (source.type === "channel") return "https://www.youtube.com/channel/" + source.channelId + "/live";
    return null;
  }

  /**
   * 미국 정규장 상태(뉴욕 시간 기준). 공휴일은 반영하지 않는다.
   * @returns {{session:"PRE"|"OPEN"|"AFTER"|"CLOSED", label:string, nyTime:string}}
   */
  function usMarketStatus(date) {
    const d = date || new Date();
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    const p = {};
    for (const { type, value } of fmt.formatToParts(d)) p[type] = value;
    const mins = Number(p.hour) * 60 + Number(p.minute);
    const nyTime = p.hour + ":" + p.minute;
    if (p.weekday === "Sat" || p.weekday === "Sun") return { session: "CLOSED", label: "주말 휴장", nyTime };
    if (mins >= 240 && mins < 570) return { session: "PRE", label: "프리마켓", nyTime };
    if (mins >= 570 && mins < 960) return { session: "OPEN", label: "정규장 진행중", nyTime };
    if (mins >= 960 && mins < 1200) return { session: "AFTER", label: "애프터마켓", nyTime };
    return { session: "CLOSED", label: "장 마감", nyTime };
  }

  return { parseYouTubeInput, buildEmbedUrl, buildWatchUrl, usMarketStatus };
});
