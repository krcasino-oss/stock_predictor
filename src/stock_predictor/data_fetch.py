"""과거 일별 시세(OHLCV) 수집 모듈.

KB증권 Open API는 현재가 조회만 지원하므로, 기술적 지표 계산에 필요한
과거 일봉 데이터는 무료 공개 데이터 소스(FinanceDataReader)로 수집한다.
결과는 로컬 CSV 캐시에 저장해 같은 날 반복 호출 시 네트워크 호출을 줄인다.
"""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DEFAULT_START = "2018-01-01"


def _cache_path(symbol: str) -> Path:
    return DATA_DIR / f"{symbol}.csv"


def _is_cache_fresh(path: Path) -> bool:
    if not path.exists():
        return False
    modified = dt.datetime.fromtimestamp(path.stat().st_mtime).date()
    return modified == dt.date.today()


def fetch_ohlcv(symbol: str, start: str = DEFAULT_START, use_cache: bool = True) -> pd.DataFrame:
    """종목의 과거 일별 OHLCV 데이터프레임을 반환한다.

    Args:
        symbol: 6자리 종목코드 (예: "005930").
        start: 조회 시작일 (YYYY-MM-DD).
        use_cache: 당일 생성된 캐시가 있으면 재사용할지 여부.

    Returns:
        인덱스가 날짜(DatetimeIndex)이고 Open/High/Low/Close/Volume 컬럼을 가진 DataFrame.
    """
    cache_file = _cache_path(symbol)

    if use_cache and _is_cache_fresh(cache_file):
        df = pd.read_csv(cache_file, index_col=0, parse_dates=True)
        return df

    import FinanceDataReader as fdr  # 지연 임포트: 테스트 환경에서 불필요한 의존성 로드 방지

    df = fdr.DataReader(symbol, start)
    if df.empty:
        raise ValueError(f"'{symbol}' 종목의 시세 데이터를 가져오지 못했습니다.")

    df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(cache_file)

    return df
