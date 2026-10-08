# stock_predictor — 주식전망 예측시스템 (2단계)

> 1단계 `kb-trading-bot`(단타공방 실전매매)은 완성 단계이며, 이 저장소는 독립된 **2단계: 주식전망 예측시스템**입니다.
> 두 시스템은 지금은 완전히 분리되어 각자 개발되며, 두 시스템이 모두 완성 단계에 도달하면 사람(운영자)이 연결고리가 되어
> 최종적으로 하나의 "주식시황 예측시스템"으로 통합하는 것을 목표로 합니다.

## 개요

개별 종목의 **단기(일 단위) 상승·하락 방향**을 기술적 지표 기반 규칙/점수화 모델로 예측합니다.

- 대상 종목: 삼성전자(005930) 단일 종목으로 시작 → `config/symbols.json`에 종목을 추가해 점진적으로 확대
- 과거 시세(OHLCV): 무료 공개 데이터(FinanceDataReader)로 수집 (KB증권 Open API는 현재가 조회만 지원하므로 실시간 연동은 추후 단계에서 추가)
- 예측 방식: 이동평균(SMA5/20/60) 정배열·역배열, RSI14, MACD, 볼린저밴드, 거래량 비율을 각각 점수화해 합산 → 강한 매수 / 매수 / 중립 / 매도 / 강한 매도 등급과 신뢰도 산출

## 설치

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m pip install -e .
```

## 실행

```powershell
# config/symbols.json에 등록된 전체 종목 실행
.\.venv\Scripts\python.exe -m stock_predictor.predict

# 특정 종목만 실행, 캐시 무시하고 최신 데이터로 재수집
.\.venv\Scripts\python.exe -m stock_predictor.predict --symbol 005930 --no-cache
```

실행 결과는 콘솔 요약과 함께 `reports/{종목코드}_{날짜}.json` 파일로 저장됩니다.

## 테스트

```powershell
.\.venv\Scripts\python.exe -m pytest tests -v
```

## 프로젝트 구조

```
config/symbols.json        예측 대상 종목 목록 (종목코드/종목명)
src/stock_predictor/
  data_fetch.py             과거 OHLCV 수집 및 일 단위 캐시
  indicators.py              SMA/EMA/RSI/MACD/볼린저밴드/거래량 비율 계산
  scoring.py                 지표별 점수화 및 등급(강한 매수~강한 매도) 산출
  predict.py                 CLI 진입점 (watchlist 순회, 리포트 저장)
tests/                       indicators/scoring 단위 테스트
data/                        과거 시세 캐시(CSV, 커밋 제외)
reports/                     예측 리포트(JSON, 커밋 제외)
```

## 향후 로드맵

1. **지표 고도화**: 백테스트로 임계값/가중치 조정, 추가 지표(이격도, 스토캐스틱 등) 검토
2. **종목 확대**: 코스피200 등으로 대상 확대
3. **실시간 연동**: KB증권 Open API 현재가 조회(`lib/kbApi.js`와 동일 인증 체계)를 Python에서도 재사용해 장중 갱신 지원
4. **두 시스템 통합**: `kb-trading-bot`(매매 실행)과 `stock_predictor`(시황 예측)가 각각 완성되면, 예측 리포트(JSON)를 매매 시스템이 참고할 수 있는 형태로 연결하는 "주식시황 예측시스템" 통합 설계

