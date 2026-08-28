#!/usr/bin/env bash

# ==============================================================================
# Script Startup Bot Automation Mini Games Kemerdekaan (k6)
# Updated: Support optimized version
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

MODE="api"
USE_OPTIMIZED="yes"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    browser)
      MODE="browser"
      shift
      ;;
    api)
      MODE="api"
      shift
      ;;
    --original)
      USE_OPTIMIZED="no"
      shift
      ;;
    --optimized)
      USE_OPTIMIZED="yes"
      shift
      ;;
    *)
      break
      ;;
  esac
done

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
VERSION_STR="OPTIMIZED ⚡"
if [ "$USE_OPTIMIZED" = "no" ]; then
  VERSION_STR="ORIGINAL"
fi

echo "======================================================="
echo "🚀 k6 Mini Games Automation Bot (Mode: ${MODE_UPPER} - ${VERSION_STR})"
echo "======================================================="
echo "Konfigurasi File : ${ENV_FILE}"
echo "Target Base URL  : ${API_BASE_URL:-https://minigames.liputan6.com}"
echo "Username         : ${MINIGAMES_USERNAME:-zildjiannesta}"
echo "Pilihan Game     : ${GAME_CHOICE:-tariktambang}"
echo "Virtual Users    : ${VUS:-1}"
echo "Jumlah Ronde     : ${LOOP_COUNT:-9999}"
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
  if [ "$USE_OPTIMIZED" = "yes" ]; then
    echo "⚡ Mode: Simple Optimized (WORKING & SAFE)..."
    k6 run play_optimized_simple.js "$@"
  else
    echo "⚡ Mode: Original (100% WORKING)..."
    k6 run play.js "$@"
  fi
fi
