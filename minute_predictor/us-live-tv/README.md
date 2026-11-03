# 📺 미국 증시 라이브 방송 (Termux 독립 실행)

CNBC·블룸버그·야후파이낸스 등 미국 주식 유튜브 생방송을 골라 보는 프로그램입니다.
**이 폴더 하나만 있으면 동작**하며 npm 패키지 설치가 필요 없습니다(Node.js 기본 모듈만 사용).

## Termux에서 설치 (`~/minute_predictor/us-live-tv`)

```bash
pkg install -y nodejs git
cd ~
git clone --depth 1 --filter=blob:none --sparse \
  -b claude/us-stock-live-broadcast-n4zxoo \
  https://github.com/krcasino-oss/stock_predictor _live_tmp
git -C _live_tmp sparse-checkout set minute_predictor/us-live-tv
mkdir -p ~/minute_predictor
cp -r _live_tmp/minute_predictor/us-live-tv ~/minute_predictor/
rm -rf _live_tmp
```

## 실행

```bash
cd ~/minute_predictor/us-live-tv
bash start.sh                    # 또는: node server.js
```

크롬에서 `http://127.0.0.1:3200` 으로 접속합니다.
다른 포트를 쓰려면 `PORT=8080 node server.js`.

`Termux:API` 앱과 `pkg install termux-api`가 설치되어 있으면 `start.sh`가
화면 꺼짐 방지(wake-lock)와 브라우저 자동 열기까지 해줍니다.

## 기능

- 채널 버튼으로 생방송 바로 재생 (CNBC Television, CNBC, Bloomberg TV, Yahoo Finance, Fox Business, Reuters, WSJ)
- 🇰🇷 한글 자막: 한국어 자막 우선, 없으면 영어 자막 → 유튜브 자동번역(한국어) 요청, 크기 조절
- 멀티뷰(최대 4개 동시, 소리는 하나만)
- 뉴욕/한국 시간, 미국 장 상태(프리·정규·애프터) 표시
- 유튜브 주소·채널ID·@핸들 직접 추가(브라우저에 저장)

## 참고

- 라이브 자동번역 자막은 유튜브/방송사에 따라 제공되지 않을 수 있습니다.
  안 나오면 플레이어 ⚙ → 자막 → 자동 번역 → 한국어를 직접 선택하세요.
- 오류 150/101은 방송사가 외부 재생을 막은 것입니다. **‘유튜브에서 열기’** 로 앱에서 보세요.
- 기본 채널은 `channels.json`에서 수정합니다.

## 파일 구성

```
minute_predictor/us-live-tv/
├── server.js        # 서버 (의존성 없음)
├── start.sh         # Termux 실행 스크립트
├── channels.json    # 기본 채널 목록
└── public/
    ├── index.html   # 화면
    └── live-utils.js
```
