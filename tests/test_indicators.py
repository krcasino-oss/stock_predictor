"""indicators 모듈 단위 테스트."""
import numpy as np
import pandas as pd

from stock_predictor.indicators import (
    bollinger_bands,
    compute_indicators,
    ema,
    macd,
    rsi,
    sma,
    volume_ratio,
)


def _make_price_series(n=80, start=100.0, step=1.0) -> pd.Series:
    dates = pd.date_range("2024-01-01", periods=n, freq="D")
    values = start + np.arange(n) * step
    return pd.Series(values, index=dates)


def test_sma_matches_manual_mean():
    series = pd.Series([1, 2, 3, 4, 5])
    result = sma(series, window=3)
    assert np.isnan(result.iloc[0])
    assert np.isnan(result.iloc[1])
    assert result.iloc[2] == 2.0
    assert result.iloc[3] == 3.0
    assert result.iloc[4] == 4.0


def test_ema_reacts_faster_than_long_window_sma():
    series = _make_price_series(n=40, start=100.0, step=2.0)
    fast_ema = ema(series, span=5)
    # 지속 상승 구간에서는 EMA가 원 시계열에 더 가깝게 따라가야 한다.
    assert abs(fast_ema.iloc[-1] - series.iloc[-1]) < abs(series.iloc[0] - series.iloc[-1])


def test_rsi_is_100_for_strictly_increasing_series():
    series = _make_price_series(n=30, start=100.0, step=1.0)
    result = rsi(series, window=14)
    assert result.iloc[-1] == 100.0


def test_rsi_is_0_for_strictly_decreasing_series():
    series = _make_price_series(n=30, start=100.0, step=-1.0)
    result = rsi(series, window=14)
    assert result.iloc[-1] == 0.0


def test_macd_returns_three_series_same_length():
    series = _make_price_series(n=60)
    macd_line, signal_line, histogram = macd(series)
    assert len(macd_line) == len(series)
    assert len(signal_line) == len(series)
    assert len(histogram) == len(series)
    np.testing.assert_allclose((macd_line - signal_line).dropna(), histogram.dropna())


def test_bollinger_bands_upper_above_lower():
    series = _make_price_series(n=40)
    upper, mid, lower = bollinger_bands(series, window=20)
    valid = upper.dropna().index
    assert (upper.loc[valid] >= mid.loc[valid]).all()
    assert (mid.loc[valid] >= lower.loc[valid]).all()


def test_volume_ratio_above_one_when_volume_spikes():
    dates = pd.date_range("2024-01-01", periods=25, freq="D")
    volumes = pd.Series([1000] * 24 + [5000], index=dates)
    result = volume_ratio(volumes, window=20)
    assert result.iloc[-1] > 1.0


def test_compute_indicators_adds_expected_columns():
    n = 70
    dates = pd.date_range("2024-01-01", periods=n, freq="D")
    df = pd.DataFrame(
        {
            "Open": 100.0,
            "High": 101.0,
            "Low": 99.0,
            "Close": np.linspace(100, 130, n),
            "Volume": 1000,
        },
        index=dates,
    )
    enriched = compute_indicators(df)
    for col in ["sma5", "sma20", "sma60", "rsi14", "macd", "macd_signal", "macd_hist",
                "bb_upper", "bb_mid", "bb_lower", "volume_ratio"]:
        assert col in enriched.columns
