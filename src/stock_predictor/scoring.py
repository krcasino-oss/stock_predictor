"""규칙 기반 점수화 모델.

`indicators.compute_indicators`로 계산한 지표의 최신값을 바탕으로 각 지표별
점수를 매기고 합산해 상승/하락 방향과 신호 등급(강한 매수~강한 매도)을 산출한다.
가중치나 임계값은 추후 백테스트 결과에 따라 조정할 수 있도록 상수로 분리한다.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from .indicators import compute_indicators

# 점수 -> 등급 임계값
STRONG_BUY_THRESHOLD = 3
BUY_THRESHOLD = 1
SELL_THRESHOLD = -1
STRONG_SELL_THRESHOLD = -3

MAX_ABS_SCORE = 6.0  # 지표별 최대 점수 합(신뢰도 계산용)


@dataclass
class SignalResult:
    symbol: str
    as_of: str
    last_close: float
    total_score: float
    label: str
    direction: str
    confidence: float
    breakdown: dict = field(default_factory=dict)
    indicators: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "as_of": self.as_of,
            "last_close": self.last_close,
            "total_score": self.total_score,
            "label": self.label,
            "direction": self.direction,
            "confidence": round(self.confidence, 3),
            "breakdown": self.breakdown,
            "indicators": self.indicators,
        }


def _trend_score(row: pd.Series) -> float:
    sma5, sma20, sma60 = row["sma5"], row["sma20"], row["sma60"]
    if sma5 > sma20 > sma60:
        return 2.0
    if sma5 < sma20 < sma60:
        return -2.0
    if sma5 > sma20:
        return 1.0
    if sma5 < sma20:
        return -1.0
    return 0.0


def _rsi_score(row: pd.Series) -> float:
    rsi = row["rsi14"]
    if rsi < 30:
        return 1.0
    if rsi > 70:
        return -1.0
    return 0.0


def _macd_score(row: pd.Series) -> float:
    score = 1.0 if row["macd"] > row["macd_signal"] else -1.0
    return score


def _bollinger_score(row: pd.Series) -> float:
    close, upper, lower = row["Close"], row["bb_upper"], row["bb_lower"]
    if close <= lower * 1.01:
        return 1.0
    if close >= upper * 0.99:
        return -1.0
    return 0.0


def _volume_score(row: pd.Series, prev_close: float) -> float:
    if row["volume_ratio"] <= 1.5:
        return 0.0
    return 1.0 if row["Close"] > prev_close else -1.0


def _label_for_score(score: float) -> tuple[str, str]:
    if score >= STRONG_BUY_THRESHOLD:
        return "강한 매수", "up"
    if score >= BUY_THRESHOLD:
        return "매수", "up"
    if score <= STRONG_SELL_THRESHOLD:
        return "강한 매도", "down"
    if score <= SELL_THRESHOLD:
        return "매도", "down"
    return "중립", "flat"


def score_symbol(symbol: str, df: pd.DataFrame) -> SignalResult:
    """OHLCV DataFrame으로부터 최신 시점의 예측 신호를 계산한다.

    Args:
        symbol: 종목코드.
        df: `data_fetch.fetch_ohlcv`가 반환한 Open/High/Low/Close/Volume DataFrame.

    Raises:
        ValueError: 지표 계산에 필요한 최소 기간(60거래일 이상)이 확보되지 않은 경우.
    """
    enriched = compute_indicators(df)
    latest = enriched.iloc[-1]

    required_cols = ["sma60", "rsi14", "macd", "macd_signal", "bb_upper", "bb_lower", "volume_ratio"]
    if latest[required_cols].isna().any():
        raise ValueError(
            f"'{symbol}' 지표 계산에 필요한 과거 데이터가 부족합니다 (최소 60거래일 필요)."
        )

    prev_close = enriched.iloc[-2]["Close"]

    breakdown = {
        "trend": _trend_score(latest),
        "rsi": _rsi_score(latest),
        "macd": _macd_score(latest),
        "bollinger": _bollinger_score(latest),
        "volume": _volume_score(latest, prev_close),
    }
    total_score = sum(breakdown.values())
    label, direction = _label_for_score(total_score)
    confidence = min(abs(total_score) / MAX_ABS_SCORE, 1.0)

    indicator_snapshot = {
        "close": round(float(latest["Close"]), 2),
        "sma5": round(float(latest["sma5"]), 2),
        "sma20": round(float(latest["sma20"]), 2),
        "sma60": round(float(latest["sma60"]), 2),
        "rsi14": round(float(latest["rsi14"]), 2),
        "macd": round(float(latest["macd"]), 2),
        "macd_signal": round(float(latest["macd_signal"]), 2),
        "bb_upper": round(float(latest["bb_upper"]), 2),
        "bb_lower": round(float(latest["bb_lower"]), 2),
        "volume_ratio": round(float(latest["volume_ratio"]), 2),
    }

    as_of = enriched.index[-1]
    as_of_str = as_of.strftime("%Y-%m-%d") if hasattr(as_of, "strftime") else str(as_of)

    return SignalResult(
        symbol=symbol,
        as_of=as_of_str,
        last_close=float(latest["Close"]),
        total_score=total_score,
        label=label,
        direction=direction,
        confidence=confidence,
        breakdown=breakdown,
        indicators=indicator_snapshot,
    )
