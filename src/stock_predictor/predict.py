"""주식전망 예측시스템 CLI 진입점.

`config/symbols.json`에 등록된 종목(현재는 삼성전자 단일 종목)에 대해
과거 시세를 수집하고 기술적 지표 기반 점수화 모델로 방향성(상승/하락)과
신호 등급을 계산한 뒤, 콘솔 요약과 JSON 리포트를 출력한다.

사용 예:
    python -m stock_predictor.predict
    python -m stock_predictor.predict --symbol 005930 --no-cache
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

from .data_fetch import fetch_ohlcv
from .scoring import score_symbol

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SYMBOLS_FILE = BASE_DIR / "config" / "symbols.json"
REPORTS_DIR = BASE_DIR / "reports"


def load_watchlist() -> list[dict]:
    with open(SYMBOLS_FILE, encoding="utf-8") as f:
        return json.load(f)


def predict_one(symbol: str, name: str, use_cache: bool = True) -> dict:
    df = fetch_ohlcv(symbol, use_cache=use_cache)
    result = score_symbol(symbol, df)
    payload = result.to_dict()
    payload["name"] = name
    return payload


def save_report(payload: dict) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    today = dt.date.today().isoformat()
    path = REPORTS_DIR / f"{payload['symbol']}_{today}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return path


def print_summary(payload: dict) -> None:
    print(
        f"[{payload['as_of']}] {payload['name']}({payload['symbol']}) "
        f"종가 {payload['last_close']:,.0f}원 -> {payload['label']} "
        f"(점수 {payload['total_score']:+.1f}, 신뢰도 {payload['confidence']*100:.0f}%)"
    )
    for key, value in payload["breakdown"].items():
        print(f"  - {key}: {value:+.1f}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="주식전망 예측시스템 (기술적 지표 기반)")
    parser.add_argument("--symbol", help="단일 종목코드만 실행 (예: 005930)")
    parser.add_argument("--no-cache", action="store_true", help="캐시를 무시하고 새로 수집")
    args = parser.parse_args(argv)

    watchlist = load_watchlist()
    if args.symbol:
        watchlist = [item for item in watchlist if item["symbol"] == args.symbol]
        if not watchlist:
            print(f"'{args.symbol}' 종목이 config/symbols.json에 없습니다.")
            return 1

    exit_code = 0
    for item in watchlist:
        try:
            payload = predict_one(item["symbol"], item["name"], use_cache=not args.no_cache)
        except ValueError as exc:
            print(f"[오류] {item['name']}({item['symbol']}): {exc}")
            exit_code = 1
            continue

        print_summary(payload)
        report_path = save_report(payload)
        print(f"  -> 리포트 저장: {report_path}")

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
