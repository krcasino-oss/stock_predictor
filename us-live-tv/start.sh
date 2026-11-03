#!/data/data/com.termux/files/usr/bin/bash
# Termux에서 미국 증시 라이브 방송 서버를 실행한다. (npm install 불필요)
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 설치 중..."
  pkg install -y nodejs || exit 1
fi

# 화면이 꺼져도 서버가 멈추지 않도록 (Termux:API 미설치 시 무시)
command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock

# 서버가 뜬 뒤 브라우저 자동 열기 (termux-open-url 있을 때만)
if command -v termux-open-url >/dev/null 2>&1; then
  ( sleep 2
    for p in "${PORT:-330}" 3300; do
      if curl -s -o /dev/null "http://127.0.0.1:$p/"; then termux-open-url "http://127.0.0.1:$p/"; break; fi
    done ) &
fi

exec node server.js
