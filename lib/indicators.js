"use strict";

/**
 * 기술적 지표 계산 모듈.
 * 입력은 날짜순 정렬된 OHLCV 배열 [{date, open, high, low, close, volume}, ...]
 * 모든 함수는 배열 끝(가장 최근) 값을 계산하는 데 사용된다.
 */

function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

function emaSeries(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const series = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  series[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    series[i] = prev;
  }
  return series;
}

function ema(values, period) {
  const series = emaSeries(values, period);
  if (series.length === 0) return null;
  return series[series.length - 1];
}

function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  const recent = closes.slice(-(period + 1));
  for (let i = 1; i < recent.length; i++) {
    const diff = recent[i] - recent[i - 1];
    if (diff >= 0) gains += diff;
    else losses += -diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  if (closes.length < slow + signalPeriod) return null;
  const fastSeries = emaSeries(closes, fast);
  const slowSeries = emaSeries(closes, slow);
  const macdLine = [];
  for (let i = 0; i < closes.length; i++) {
    if (fastSeries[i] !== undefined && slowSeries[i] !== undefined) {
      macdLine[i] = fastSeries[i] - slowSeries[i];
    }
  }
  const macdValues = macdLine.filter((v) => v !== undefined);
  const signalSeries = emaSeries(macdValues, signalPeriod);
  if (signalSeries.length === 0) return null;
  const macdValue = macdValues[macdValues.length - 1];
  const signalValue = signalSeries[signalSeries.length - 1];
  return { macd: macdValue, signal: signalValue, histogram: macdValue - signalValue };
}

function bollinger(closes, period = 20, stdDevMultiplier = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
  const stdDev = Math.sqrt(variance);
  return {
    middle: mean,
    upper: mean + stdDevMultiplier * stdDev,
    lower: mean - stdDevMultiplier * stdDev,
  };
}

/** 최근 거래량이 평균 대비 몇 배인지 (예: 2.4배 폭증 여부 판단용). */
function volumeRatio(volumes, period = 20) {
  if (volumes.length < period + 1) return null;
  const recent = volumes[volumes.length - 1];
  const base = volumes.slice(-(period + 1), -1);
  const avg = base.reduce((a, b) => a + b, 0) / base.length;
  if (avg === 0) return null;
  return recent / avg;
}

/** rows(OHLCV 배열)로부터 현재 시점 기준 전체 지표를 한 번에 계산한다. */
function computeIndicators(rows) {
  const closes = rows.map((r) => r.close);
  const volumes = rows.map((r) => r.volume);

  const sma5 = sma(closes, 5);
  const sma20 = sma(closes, 20);
  const sma60 = sma(closes, 60);

  return {
    lastClose: closes[closes.length - 1] ?? null,
    sma5,
    sma20,
    sma60,
    ema12: ema(closes, 12),
    ema26: ema(closes, 26),
    rsi14: rsi(closes, 14),
    macd: macd(closes),
    bollinger: bollinger(closes, 20),
    volumeRatio: volumeRatio(volumes, 20),
  };
}

module.exports = { sma, ema, rsi, macd, bollinger, volumeRatio, computeIndicators };
