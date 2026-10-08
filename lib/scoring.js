"use strict";

/**
 * 지표를 점수로 변환해 5단계 라벨(STRONG_BUY~STRONG_SELL)을 매긴다.
 * 각 하위 점수는 -2~+2, 5개 지표를 합산하면 -10~+10 범위가 된다.
 */

const LABELS = {
  STRONG_BUY: "적극매수",
  BUY: "매수",
  HOLD: "관망",
  SELL: "매도",
  STRONG_SELL: "적극매도",
};

const MAX_ABS_SCORE = 10;

function trendScore(ind) {
  const { sma5, sma20, sma60 } = ind;
  if (sma5 == null || sma20 == null || sma60 == null) return 0;
  if (sma5 > sma20 && sma20 > sma60) return 2;
  if (sma5 > sma20) return 1;
  if (sma5 < sma20 && sma20 < sma60) return -2;
  if (sma5 < sma20) return -1;
  return 0;
}

function rsiScore(ind) {
  const { rsi14 } = ind;
  if (rsi14 == null) return 0;
  if (rsi14 < 30) return 2;
  if (rsi14 < 45) return 1;
  if (rsi14 <= 55) return 0;
  if (rsi14 <= 70) return -1;
  return -2;
}

function macdScore(ind) {
  const m = ind.macd;
  if (!m) return 0;
  if (m.macd > 0 && m.histogram > 0) return 2;
  if (m.histogram > 0) return 1;
  if (m.macd < 0 && m.histogram < 0) return -2;
  if (m.histogram < 0) return -1;
  return 0;
}

function bollingerScore(ind) {
  const b = ind.bollinger;
  if (!b || ind.lastClose == null) return 0;
  const width = b.upper - b.lower;
  if (width <= 0) return 0;
  const position = (ind.lastClose - b.lower) / width; // 0=하단, 1=상단
  if (position <= 0.15) return 2;
  if (position <= 0.35) return 1;
  if (position >= 0.85) return -2;
  if (position >= 0.65) return -1;
  return 0;
}

function volumeScore(ind) {
  const ratio = ind.volumeRatio;
  if (ratio == null) return 0;
  if (ratio >= 2.0) return 2;
  if (ratio >= 1.5) return 1;
  if (ratio < 0.7) return -1;
  return 0;
}

function labelFor(score) {
  if (score >= 6) return "STRONG_BUY";
  if (score >= 2) return "BUY";
  if (score <= -6) return "STRONG_SELL";
  if (score <= -2) return "SELL";
  return "HOLD";
}

/** 지표 객체(computeIndicators 결과)로부터 점수·라벨·신뢰도를 계산한다. */
function scoreIndicators(indicators) {
  const breakdown = {
    trend: trendScore(indicators),
    rsi: rsiScore(indicators),
    macd: macdScore(indicators),
    bollinger: bollingerScore(indicators),
    volume: volumeScore(indicators),
  };
  const totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const label = labelFor(totalScore);
  const confidence = Math.min(100, Math.round((Math.abs(totalScore) / MAX_ABS_SCORE) * 100));

  return {
    breakdown,
    totalScore,
    label,
    labelKo: LABELS[label],
    confidence,
  };
}

module.exports = { scoreIndicators, LABELS, MAX_ABS_SCORE };
