"""scoring 모듈 단위 테스트."""
import numpy as np
import pandas as pd
import pytest

from stock_predictor.scoring import (
    _bollinger_score,
    _label_for_score,
    _macd_score,
    _rsi_score,
    _trend_score,
    _volume_score,
    score_symbol,
)


def _row(**kwargs) -> pd.Series:
    return pd.Series(kwargs)


def test_trend_score_golden_cross_is_positive():
    row = _row(sma5=110, sma20=105, sma60=100)
    assert _trend_score(row) == 2.0


def test_trend_score_dead_cross_is_negative():
    row = _row(sma5=90, sma20=95, sma60=100)
    assert _trend_score(row) == -2.0


def test_trend_score_flat_is_zero():
    row = _row(sma5=100, sma20=100, sma60=100)
    assert _trend_score(row) == 0.0


def test_rsi_score_oversold_is_positive():
    assert _rsi_score(_row(rsi14=20)) == 1.0


def test_rsi_score_overbought_is_negative():
    assert _rsi_score(_row(rsi14=80)) == -1.0


def test_rsi_score_neutral_zone_is_zero():
    assert _rsi_score(_row(rsi14=50)) == 0.0


def test_macd_score_above_signal_is_positive():
    assert _macd_score(_row(macd=1.0, macd_signal=0.5)) == 1.0


def test_macd_score_below_signal_is_negative():
    assert _macd_score(_row(macd=0.5, macd_signal=1.0)) == -1.0


def test_bollinger_score_near_lower_band_is_positive():
    row = _row(Close=98, bb_upper=120, bb_lower=100)
    assert _bollinger_score(row) == 1.0


def test_bollinger_score_near_upper_band_is_negative():
    row = _row(Close=122, bb_upper=120, bb_lower=100)
    assert _bollinger_score(row) == -1.0


def test_volume_score_low_volume_is_zero():
    row = _row(volume_ratio=1.1, Close=105)
    assert _volume_score(row, prev_close=100) == 0.0


def test_volume_score_high_volume_up_is_positive():
    row = _row(volume_ratio=2.0, Close=105)
    assert _volume_score(row, prev_close=100) == 1.0


def test_volume_score_high_volume_down_is_negative():
    row = _row(volume_ratio=2.0, Close=95)
    assert _volume_score(row, prev_close=100) == -1.0


@pytest.mark.parametrize(
    "score,expected_label,expected_direction",
    [
        (4, "강한 매수", "up"),
        (2, "매수", "up"),
        (0, "중립", "flat"),
        (-2, "매도", "down"),
        (-4, "강한 매도", "down"),
    ],
)
def test_label_for_score(score, expected_label, expected_direction):
    label, direction = _label_for_score(score)
    assert label == expected_label
    assert direction == expected_direction


def _make_ohlcv(n: int, close_values) -> pd.DataFrame:
    dates = pd.date_range("2024-01-01", periods=n, freq="D")
    close = pd.Series(close_values, index=dates)
    return pd.DataFrame(
        {
            "Open": close,
            "High": close * 1.01,
            "Low": close * 0.99,
            "Close": close,
            "Volume": 1_000_000,
        },
        index=dates,
    )


def test_score_symbol_raises_when_history_too_short():
    df = _make_ohlcv(10, np.linspace(100, 110, 10))
    with pytest.raises(ValueError):
        score_symbol("TEST", df)


def test_score_symbol_returns_consistent_result_for_sufficient_history():
    df = _make_ohlcv(90, np.linspace(100, 150, 90))
    result = score_symbol("TEST", df)

    assert result.symbol == "TEST"
    assert result.total_score == sum(result.breakdown.values())
    assert result.label in {"강한 매수", "매수", "중립", "매도", "강한 매도"}
    assert 0.0 <= result.confidence <= 1.0
    assert set(result.indicators.keys()) == {
        "close", "sma5", "sma20", "sma60", "rsi14", "macd", "macd_signal",
        "bb_upper", "bb_lower", "volume_ratio",
    }
