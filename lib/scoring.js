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

const won = (n) => `${Math.round(n).toLocaleString("ko-KR")}원`;

/**
 * 각 하위 점수가 "어떤 데이터로, 왜 그렇게 계산됐는지"를 사람이 읽을 수 있는 문장으로 설명한다.
 * data: 점수 산출에 사용한 원본 수치와 출처
 * reason: 그 수치로부터 해당 점수를 매긴 판단 근거
 */
function explainTrend(ind, score) {
  const { sma5, sma20, sma60 } = ind;
  if (sma5 == null || sma20 == null || sma60 == null) {
    return {
      data: "네이버 금융 일봉 종가 기준 이동평균 계산에 필요한 60일치 데이터가 부족함",
      reason: "데이터 부족으로 추세 점수를 0점(중립) 처리",
    };
  }
  const data = `일봉 종가로 5일선 ${won(sma5)}, 20일선 ${won(sma20)}, 60일선 ${won(sma60)} 계산 (출처: 네이버 금융 일별시세)`;
  let reason;
  if (score === 2) reason = "5일선>20일선>60일선 정배열 → 단기·중기 추세 모두 상승 우위 (+2)";
  else if (score === 1) reason = "5일선>20일선이나 60일선과는 미확정 → 단기 추세만 상승 우위 (+1)";
  else if (score === -2) reason = "5일선<20일선<60일선 역배열 → 단기·중기 추세 모두 하락 우위 (-2)";
  else if (score === -1) reason = "5일선<20일선 → 단기 추세만 하락 우위 (-1)";
  else reason = "이동평균선이 뚜렷한 방향 없이 얽혀있음 → 추세 중립 (0)";
  return { data, reason };
}

function explainRsi(ind, score) {
  const { rsi14 } = ind;
  if (rsi14 == null) {
    return { data: "14일치 종가 데이터 부족", reason: "데이터 부족으로 RSI 점수 0점(중립) 처리" };
  }
  const data = `최근 14일간 종가 상승폭/하락폭 비율로 RSI(상대강도지수) 계산 → RSI ${rsi14.toFixed(1)} (출처: 네이버 금융 일별시세)`;
  let reason;
  if (score === 2) reason = "RSI 30 미만 → 과매도 구간, 기술적 반등 기대 (+2)";
  else if (score === 1) reason = "RSI 30~45 → 과매도에 가까워 약한 반등 기대 (+1)";
  else if (score === 0) reason = "RSI 45~55 → 매수·매도 힘이 균형, 중립 (0)";
  else if (score === -1) reason = "RSI 55~70 → 과매수에 가까워 약한 하락 압력 (-1)";
  else reason = "RSI 70 초과 → 과매수 구간, 단기 조정 위험 (-2)";
  return { data, reason };
}

function explainMacd(ind, score) {
  const m = ind.macd;
  if (!m) {
    return { data: "26일+9일치 종가 데이터 부족", reason: "데이터 부족으로 MACD 점수 0점(중립) 처리" };
  }
  const data = `종가의 12일/26일 지수이동평균(EMA) 차이(MACD선)와 9일 신호선 비교 → MACD ${m.macd.toFixed(1)}, 신호선 ${m.signal.toFixed(1)}, 히스토그램 ${m.histogram.toFixed(1)} (출처: 네이버 금융 일별시세)`;
  let reason;
  if (score === 2) reason = "MACD선이 0선 위 + 히스토그램도 양(+) → 상승 모멘텀 강화 중 (+2)";
  else if (score === 1) reason = "히스토그램은 양(+)이나 MACD선은 아직 약함 → 상승 모멘텀 초기 전환 (+1)";
  else if (score === -2) reason = "MACD선이 0선 아래 + 히스토그램도 음(-) → 하락 모멘텀 강화 중 (-2)";
  else if (score === -1) reason = "히스토그램은 음(-)이나 MACD선은 아직 약함 → 하락 모멘텀 초기 전환 (-1)";
  else reason = "뚜렷한 모멘텀 전환 신호 없음 → 중립 (0)";
  return { data, reason };
}

function explainBollinger(ind, score) {
  const b = ind.bollinger;
  if (!b || ind.lastClose == null) {
    return { data: "20일치 종가 데이터 부족", reason: "데이터 부족으로 볼린저밴드 점수 0점(중립) 처리" };
  }
  const width = b.upper - b.lower;
  const positionPct = width > 0 ? ((ind.lastClose - b.lower) / width) * 100 : 50;
  const data = `최근 20일 종가 평균과 표준편차(±2배)로 볼린저밴드 계산 → 상단 ${won(b.upper)} / 중심 ${won(b.middle)} / 하단 ${won(b.lower)}, 현재가 ${won(ind.lastClose)}는 밴드 내 위치 ${positionPct.toFixed(0)}% 지점 (출처: 네이버 금융 일별시세)`;
  let reason;
  if (score === 2) reason = "하단밴드 부근(하위 15% 이하) → 단기 과매도, 반등 기대 (+2)";
  else if (score === 1) reason = "하단권(하위 35% 이하) → 약한 반등 기대 (+1)";
  else if (score === -2) reason = "상단밴드 부근(상위 85% 이상) → 단기 과열, 조정 위험 (-2)";
  else if (score === -1) reason = "상단권(상위 65% 이상) → 상승 둔화 가능 신호 (-1)";
  else reason = "밴드 중앙 근처 → 특별한 신호 없음, 중립 (0)";
  return { data, reason };
}

function explainVolume(ind, score) {
  const ratio = ind.volumeRatio;
  if (ratio == null) {
    return { data: "21일치 거래량 데이터 부족", reason: "데이터 부족으로 거래량 점수 0점(중립) 처리" };
  }
  const data = `최근 20일 평균 거래량 대비 당일 거래량 배율 계산 → ${ratio.toFixed(2)}배 (출처: 네이버 금융 일별시세 거래량)`;
  let reason;
  if (score === 2) reason = "평소 대비 2배 이상 거래량 폭증 → 시장의 강한 관심, 추세 신뢰도 상승 (+2)";
  else if (score === 1) reason = "평소 대비 1.5배 이상 거래량 증가 → 관심 증가 신호 (+1)";
  else if (score === -1) reason = "평소 대비 0.7배 미만 거래량 급감 → 관심 저조, 신호 신뢰도 낮음 (-1)";
  else reason = "평소와 비슷한 거래량 → 특별한 신호 없음, 중립 (0)";
  return { data, reason };
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

  const explain = {
    trend: explainTrend(indicators, breakdown.trend),
    rsi: explainRsi(indicators, breakdown.rsi),
    macd: explainMacd(indicators, breakdown.macd),
    bollinger: explainBollinger(indicators, breakdown.bollinger),
    volume: explainVolume(indicators, breakdown.volume),
  };

  return {
    breakdown,
    totalScore,
    label,
    labelKo: LABELS[label],
    confidence,
    explain,
  };
}

module.exports = { scoreIndicators, LABELS, MAX_ABS_SCORE };
