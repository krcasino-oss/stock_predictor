"""모바일 친화적 HTML 리포트 생성 모듈.

GitHub Pages(`docs/` 폴더)에 게시할 정적 HTML을 만든다.
- 종목별 상세 리포트: docs/reports/{symbol}/{date}.html
- 종목별 이력 목록: docs/reports/{symbol}/index.html
- 전체 홈(최신 현황 한눈에 보기): docs/index.html

외부 CSS/JS 의존성 없이 단일 HTML 파일로 완결되도록 인라인 스타일만 사용한다.
국내 주식 관례에 따라 상승/매수는 빨간색, 하락/매도는 파란색 계열로 표시한다.
"""
from __future__ import annotations

import html

_DIRECTION_COLOR = {
    "up": "#d6336c",
    "down": "#1971c2",
    "flat": "#868e96",
}

_BASE_STYLE = """
  body { font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
         margin: 0; padding: 16px; background: #f5f6f8; color: #212529; }
  .card { background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  h1 { font-size: 1.3rem; margin: 0 0 12px; }
  h2 { font-size: 1.1rem; margin: 0 0 8px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; color: #fff;
           font-weight: 600; font-size: 0.9rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
  td, th { padding: 6px 4px; text-align: left; border-bottom: 1px solid #eee; }
  a { color: #1971c2; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .muted { color: #868e96; font-size: 0.85rem; }
  .score-row td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
  .top-link { display: inline-block; margin-bottom: 12px; }
"""


def _page(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(title)}</title>
<style>{_BASE_STYLE}</style>
</head>
<body>
{body}
<p class="muted">본 리포트는 기술적 지표 기반 참고용 정보이며 투자 조언이 아닙니다.</p>
</body>
</html>
"""


def render_detail_html(payload: dict) -> str:
    """단일 예측 결과(payload)를 상세 리포트 HTML 문자열로 렌더링한다."""
    color = _DIRECTION_COLOR.get(payload["direction"], "#868e96")
    breakdown_rows = "".join(
        f'<tr class="score-row"><td>{html.escape(key)}</td><td>{value:+.1f}</td></tr>'
        for key, value in payload["breakdown"].items()
    )
    indicator_labels = {
        "close": "종가",
        "sma5": "SMA5",
        "sma20": "SMA20",
        "sma60": "SMA60",
        "rsi14": "RSI14",
        "macd": "MACD",
        "macd_signal": "MACD Signal",
        "bb_upper": "볼린저 상단",
        "bb_lower": "볼린저 하단",
        "volume_ratio": "거래량 비율",
    }
    indicator_rows = "".join(
        f'<tr><td>{html.escape(indicator_labels.get(key, key))}</td><td>{value:,.2f}</td></tr>'
        for key, value in payload["indicators"].items()
    )

    body = f"""
<a class="top-link" href="index.html">&larr; {html.escape(payload['name'])} 이력 목록</a>
<div class="card">
  <h1>{html.escape(payload['name'])} ({html.escape(payload['symbol'])})</h1>
  <p class="muted">기준일 {html.escape(payload['as_of'])}</p>
  <p><span class="badge" style="background:{color}">{html.escape(payload['label'])}</span>
     &nbsp;점수 {payload['total_score']:+.1f} / 신뢰도 {payload['confidence']*100:.0f}%</p>
  <p>종가 {payload['last_close']:,.0f}원</p>
</div>
<div class="card">
  <h2>지표별 점수</h2>
  <table>{breakdown_rows}</table>
</div>
<div class="card">
  <h2>지표 스냅샷</h2>
  <table>{indicator_rows}</table>
</div>
"""
    return _page(f"{payload['name']} 예측 {payload['as_of']}", body)


def render_history_index(symbol: str, name: str, entries: list[dict]) -> str:
    """종목별 이력 목록 페이지. entries는 최신순으로 정렬된 {as_of, label, direction, file} 목록."""
    rows = "".join(
        f'<tr><td><a href="{html.escape(e["file"])}">{html.escape(e["as_of"])}</a></td>'
        f'<td><span class="badge" style="background:{_DIRECTION_COLOR.get(e["direction"], "#868e96")}">'
        f'{html.escape(e["label"])}</span></td></tr>'
        for e in entries
    )
    body = f"""
<a class="top-link" href="../../index.html">&larr; 전체 종목 현황</a>
<div class="card">
  <h1>{html.escape(name)} ({html.escape(symbol)}) 예측 이력</h1>
  <table>{rows}</table>
</div>
"""
    return _page(f"{name} 예측 이력", body)


def render_home_index(latest: list[dict]) -> str:
    """전체 종목 최신 현황 홈페이지. latest는 종목별 최신 payload 목록."""
    rows = "".join(
        f'<tr><td>{html.escape(item["name"])} ({html.escape(item["symbol"])})</td>'
        f'<td><span class="badge" style="background:{_DIRECTION_COLOR.get(item["direction"], "#868e96")}">'
        f'{html.escape(item["label"])}</span></td>'
        f'<td>{item["total_score"]:+.1f}</td>'
        f'<td><a href="reports/{html.escape(item["symbol"])}/index.html">이력</a></td></tr>'
        for item in latest
    )
    as_of_values = {item["as_of"] for item in latest}
    as_of_summary = ", ".join(sorted(as_of_values)) if as_of_values else "-"

    body = f"""
<div class="card">
  <h1>주식전망 예측시스템</h1>
  <p class="muted">기준일: {html.escape(as_of_summary)}</p>
  <table>
    <tr><th>종목</th><th>신호</th><th>점수</th><th>이력</th></tr>
    {rows}
  </table>
</div>
"""
    return _page("주식전망 예측시스템", body)
