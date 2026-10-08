"use strict";

/**
 * 거래량 기반 수급 이상징후 탐지 모듈.
 *
 * 네이버 금융 무료 API는 OHLCV(가격·거래량)만 제공하고 외국인/기관 등
 * 투자자별 순매수(진짜 "수급") 데이터는 제공하지 않는다(KRX·증권사 API 필요).
 * 그래서 이 모듈은 거래량 패턴을 수급 유입/이탈의 대리 신호로 삼아
 * "후보 축소"에 쓸 이상징후를 탐지한다. 투자자별 순매수 연동은 추후 과제다.
 */

const { volumeRatio } = require("./indicators");

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** 거래량이 연속으로 증가한 일수(최근 기준, 최대 lookback일까지만 집계). */
function volumeStreak(volumes, lookback = 10) {
  let streak = 0;
  for (let i = volumes.length - 1; i > 0 && streak < lookback; i--) {
    if (volumes[i] > volumes[i - 1]) streak++;
    else break;
  }
  return streak;
}

/** 최근 period일 가격 변화율(%)과 거래량 변화율(%)을 비교해 다이버전스를 판정한다. */
function detectDivergence(closes, volumes, period = 5) {
  if (closes.length < period * 2 + 1) return null;
  const lastClose = closes[closes.length - 1];
  const baseClose = closes[closes.length - 1 - period];
  if (!baseClose) return null;
  const priceChangePct = ((lastClose - baseClose) / baseClose) * 100;

  const recentVolAvg = average(volumes.slice(-period));
  const priorVolAvg = average(volumes.slice(-(period * 2), -period));
  if (!priorVolAvg) return null;
  const volumeChangePct = ((recentVolAvg - priorVolAvg) / priorVolAvg) * 100;

  let type = "NONE";
  // 가격은 오르는데 거래량이 줄면 상승 동력이 약하다는 경계 신호
  if (priceChangePct > 1 && volumeChangePct < -10) type = "BEARISH_DIVERGENCE";
  // 가격은 내리는데 거래량이 급증하면 투매/변동성 확대 경계 신호
  else if (priceChangePct < -1 && volumeChangePct > 50) type = "CAPITULATION_RISK";

  return { priceChangePct, volumeChangePct, type };
}

/** 최근 lookback일 구간에서 신고가/신저가 갱신 여부를 판정한다. */
function detectBreakout(closes, lookback = 60) {
  const window = closes.slice(-lookback);
  const lastClose = closes[closes.length - 1];
  return {
    isNewHigh: lastClose >= Math.max(...window),
    isNewLow: lastClose <= Math.min(...window),
  };
}

/**
 * rows(OHLCV 배열, 날짜 오름차순)로부터 거래량 기반 이상징후를 탐지한다.
 * level: "HIGH"(강한 신호) | "MEDIUM"(주목할 신호) | "NONE"(특이사항 없음)
 */
function detectVolumeAnomaly(rows, options = {}) {
  const { volumePeriod = 20, breakoutLookback = 60, divergencePeriod = 5 } = options;
  const signals = [];

  if (!rows || rows.length < volumePeriod + 1) {
    return { level: "NONE", signals, ratio: null, streak: 0, divergence: null, breakout: null };
  }

  const closes = rows.map((r) => r.close);
  const volumes = rows.map((r) => r.volume);

  const ratio = volumeRatio(volumes, volumePeriod);
  if (ratio != null) {
    if (ratio >= 3) {
      signals.push({ type: "VOLUME_SURGE", level: "HIGH", message: `평균 대비 거래량 ${ratio.toFixed(1)}배 폭증` });
    } else if (ratio >= 2) {
      signals.push({ type: "VOLUME_SURGE", level: "MEDIUM", message: `평균 대비 거래량 ${ratio.toFixed(1)}배 증가` });
    } else if (ratio < 0.4) {
      signals.push({ type: "VOLUME_COLLAPSE", level: "MEDIUM", message: `평균 대비 거래량 ${ratio.toFixed(2)}배로 급감(관심 저조)` });
    }
  }

  const streak = volumeStreak(volumes);
  if (streak >= 3) {
    signals.push({
      type: "VOLUME_STREAK",
      level: streak >= 5 ? "HIGH" : "MEDIUM",
      message: `거래량 ${streak}일 연속 증가(수급 유입 지속 가능성)`,
    });
  }

  const divergence = detectDivergence(closes, volumes, divergencePeriod);
  if (divergence && divergence.type !== "NONE") {
    const message =
      divergence.type === "BEARISH_DIVERGENCE"
        ? `최근 ${divergencePeriod}일 가격은 ${divergence.priceChangePct.toFixed(1)}% 상승했지만 거래량은 ${divergence.volumeChangePct.toFixed(1)}% 감소 → 상승 동력 약화 경계`
        : `최근 ${divergencePeriod}일 가격은 ${divergence.priceChangePct.toFixed(1)}% 하락했는데 거래량은 ${divergence.volumeChangePct.toFixed(1)}% 급증 → 투매/변동성 확대 경계`;
    signals.push({ type: divergence.type, level: "MEDIUM", message });
  }

  const breakout = detectBreakout(closes, breakoutLookback);
  if (breakout.isNewHigh && ratio != null && ratio >= 1.5) {
    signals.push({
      type: "BREAKOUT_HIGH",
      level: "HIGH",
      message: `최근 ${breakoutLookback}일 신고가 경신 + 거래량 동반(${ratio.toFixed(1)}배) → 돌파 신뢰도 높음`,
    });
  } else if (breakout.isNewLow && ratio != null && ratio >= 1.5) {
    signals.push({
      type: "BREAKOUT_LOW",
      level: "HIGH",
      message: `최근 ${breakoutLookback}일 신저가 경신 + 거래량 동반(${ratio.toFixed(1)}배) → 이탈 경계`,
    });
  }

  const level = signals.some((s) => s.level === "HIGH")
    ? "HIGH"
    : signals.some((s) => s.level === "MEDIUM")
    ? "MEDIUM"
    : "NONE";

  return { level, signals, ratio, streak, divergence, breakout };
}

/** 특별히 주목할 이상징후가 있는 종목인지("후보") 판정한다. */
function isCandidate(anomaly) {
  return !!anomaly && anomaly.level !== "NONE";
}

module.exports = { detectVolumeAnomaly, isCandidate, volumeStreak, detectDivergence, detectBreakout };
