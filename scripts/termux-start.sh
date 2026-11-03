#!/data/data/com.termux/files/usr/bin/bash
# Termux에서 stock_predictor 서버를 실행한다. (기본 포트 3100)
set -e
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 설치 중..."
  pkg install -y nodejs
fi

if [ ! -d node_modules ]; then
  echo "패키지 설치 중..."
  npm install
fi

# 화면이 꺼져도 서버가 멈추지 않도록 (termux-api 미설치 시 무시)
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock || true

export PORT="${PORT:-3100}"
exec node server.js
