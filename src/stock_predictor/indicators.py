"""기술적 지표 계산 모듈.

이동평균(SMA), RSI, MACD, 볼린저밴드, 거래량 비율 등 규칙 기반 점수화 모델에
필요한 지표를 계산한다. 모든 함수는 pandas Series/DataFrame을 입력받아
벡터화된 연산으로 전체 구간 지표를 반환하며, 최신값은 호출 측에서 `.iloc[-1]`로
꺼내 사용한다.
"""
from __future__ import annotations

import pandas as pd


def sma(series: pd.Series, window: int) -> pd.Series:
    """단순이동평균."""
    return series.rolling(window=window, min_periods=window).mean()


def ema(series: pd.Series, span: int) -> pd.Series:
    """지수이동평균."""
    return series.ewm(span=span, adjust=False).mean()


def rsi(series: pd.Series, window: int = 14) -> pd.Series:
    """상대강도지수(RSI). 평균 상승폭/하락폭의 비율로 0~100 사이 값을 가진다."""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.rolling(window=window, min_periods=window).mean()
    avg_loss = loss.rolling(window=window, min_periods=window).mean()

    rs = avg_gain / avg_loss.replace(0, pd.NA)
    result = 100 - (100 / (1 + rs))
    # 평균 하락폭이 0인 구간(계속 상승)은 RSI 100으로 처리
    result = result.where(avg_loss != 0, 100.0)
    return result


def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    """MACD선, 시그널선, 히스토그램을 (macd_line, signal_line, histogram) 튜플로 반환."""
    ema_fast = ema(series, fast)
    ema_slow = ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def bollinger_bands(series: pd.Series, window: int = 20, num_std: float = 2.0):
    """볼린저밴드를 (상단, 중단, 하단) 튜플로 반환."""
    mid = sma(series, window)
    std = series.rolling(window=window, min_periods=window).std()
    upper = mid + num_std * std
    lower = mid - num_std * std
    return upper, mid, lower


def volume_ratio(volume: pd.Series, window: int = 20) -> pd.Series:
    """최근 거래량 대비 이동평균 거래량의 비율. 1.0이면 평균 수준."""
    avg_volume = volume.rolling(window=window, min_periods=window).mean()
    return volume / avg_volume


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """OHLCV DataFrame에 지표 컬럼을 추가한 새 DataFrame을 반환한다."""
    out = df.copy()
    close = out["Close"]

    out["sma5"] = sma(close, 5)
    out["sma20"] = sma(close, 20)
    out["sma60"] = sma(close, 60)
    out["rsi14"] = rsi(close, 14)

    macd_line, signal_line, histogram = macd(close)
    out["macd"] = macd_line
    out["macd_signal"] = signal_line
    out["macd_hist"] = histogram

    upper, mid, lower = bollinger_bands(close)
    out["bb_upper"] = upper
    out["bb_mid"] = mid
    out["bb_lower"] = lower

    out["volume_ratio"] = volume_ratio(out["Volume"])

    return out
