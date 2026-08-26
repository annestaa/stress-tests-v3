#!/usr/bin/env bash

# ==============================================================================
# Script Startup Bot Automation Mini Games Kemerdekaan (k6)
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

MODE="api"
if [ "$1" = "browser" ] || [ "$1" = "api" ]; then
  MODE="$1"
  shift
fi

# 1. Load environment variables spesifik mode (.env.api atau .env.browser)
ENV_FILE=".env.${MODE}"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE=".env"
fi

if [ -f "$ENV_FILE" ]; then
  echo "📄 Memuat konfigurasi dari $ENV_FILE..."
  set -a
  source "$ENV_FILE"
  set +a
  export ENV_FILE="$ENV_FILE"
fi

MODE_UPPER=$(echo "$MODE" | tr '[:lower:]' '[:upper:]')
echo "======================================================="
echo "🚀 k6 Mini Games Automation & Load Bot (Mode: ${MODE_UPPER})"
echo "======================================================="
echo "Konfigurasi File : ${ENV_FILE}"
echo "Target Base URL  : ${BASE_URL:-https://kemerdekaan.liputan6.com}"
echo "Username         : ${MINIGAMES_USERNAME:-kbrnugroho}"
echo "Pilihan Game     : ${GAME_CHOICE:-tariktambang}"
echo "Virtual Users    : ${VUS:-1}"
echo "Jumlah Ronde     : ${LOOP_COUNT:-100}"
echo "======================================================="

# 2. Jalankan Token Sync Daemon di background jika belum aktif
if ! nc -z 127.0.0.1 9876 2>/dev/null; then
  echo "🔄 Menjalankan Anti-Ban Token Sync Daemon (background)..."
  node token_sync.js >> token_sync.log 2>&1 &
  
  # Tunggu daemon siap menerima koneksi
  for i in {1..10}; do
    if nc -z 127.0.0.1 9876 2>/dev/null; then
      echo "✅ Anti-Ban Daemon ONLINE di http://127.0.0.1:9876"
      break
    fi
    sleep 0.3
  done
else
  echo "✅ Anti-Ban Daemon sudah aktif di http://127.0.0.1:9876"
fi

if [ "$MODE" = "browser" ]; then
  echo "🌐 Mode: Browser Automation (k6/browser)..."
  export K6_BROWSER_ENABLED=true
  k6 run browser_play.js "$@"
else
  echo "⚡ Mode: Direct HTTP API Automation (play.js)..."
  k6 run play.js "$@"
fi
