import http from "k6/http";
import { sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const gamesPlayed = new Counter("games_played");
const gamesWon = new Counter("games_won");
const totalPoints = new Counter("points_earned");
const sessionSuccessRate = new Rate("session_success_rate");
const scoreSuccessRate = new Rate("score_success_rate");
const sessionDuration = new Trend("session_duration_ms");
const scoreSubmitDuration = new Trend("score_submit_duration_ms");

function loadDotEnv() {
  const envObj = {};
  const filesToTry = ["./.env.api", "./.env"];
  for (const filePath of filesToTry) {
    try {
      const raw = open(filePath);
      const lines = raw.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx > 0) {
          const key = line.substring(0, eqIdx).trim();
          const val = line.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          envObj[key] = val;
        }
      }
      break;
    } catch (e) {}
  }
  return envObj;
}

const DOT_ENV = loadDotEnv();
const getEnv = (key, fallback = "") => __ENV[key] || DOT_ENV[key] || fallback;

const BASE_URL = getEnv("BASE_URL", getEnv("API_BASE_URL", "https://minigames.liputan6.com"));
const USERNAME = getEnv("MINIGAMES_USERNAME", "zildjiannesta");
const GAME_CHOICE = getEnv("GAME_CHOICE", "tariktambang").toLowerCase();
const TIME_LEFT = parseInt(getEnv("TIME_LEFT", "22"), 10);
const VUS = parseInt(getEnv("VUS", "1"), 10);
const LOOP_COUNT = parseInt(getEnv("LOOP_COUNT", "9999999"), 10);
const ROUND_DELAY = parseFloat(getEnv("ROUND_DELAY_SEC", "2.0"));

// Jeda antar request individual (open session / submit score) agar tidak burst
const REQUEST_STAGGER = parseFloat(getEnv("REQUEST_STAGGER_SEC", "0.5"));

// Target durasi bermain per-sesi (session dibuka -> submit score).
// Syarat server: >= 7.0s. Tier poin: <10s=50pts, 10-20s=30pts, >20s=10pts.
// Default 8.5s = aman di tengah (buffer dari kedua batas + toleransi network jitter).
const TARGET_DURATION = parseFloat(getEnv("TARGET_DURATION_SEC", "8.5"));

// Adaptive batch size
const BATCH_MIN = parseInt(getEnv("BATCH_SIZE_MIN", "3"), 10);
const BATCH_MAX = parseInt(getEnv("BATCH_SIZE_MAX", "10"), 10);
const BATCH_INIT = parseInt(getEnv("BATCH_SIZE", "5"), 10);

const AVAILABLE_GAMES = ["tariktambang", "panjatpinang", "balapkarung"];

export const options = {
  scenarios: {
    minigames_automation: {
      executor: "per-vu-iterations",
      vus: VUS,
      iterations: LOOP_COUNT,
      maxDuration: "48h",
    },
  },
};

// ==============================================================================
// Token management — persis sama dengan play.js original
// Semua VU request ke daemon yang sama → daemon return cached token
// → otomatis semua VU pakai token yang sama selama 115 detik
// ==============================================================================
let _cachedToken = "";
let _tokenObtainedAt = 0;
let _currentTokenLifetime = 110;

function refreshRecaptchaToken(prefix, forceRefresh = false) {
  try {
    const url = forceRefresh
      ? "http://127.0.0.1:9876/refresh?force=true"
      : "http://127.0.0.1:9876/refresh";
    const res = http.get(url, { timeout: "120s" });
    if (res.status === 200) {
      const json = res.json();
      if (json && json.token) return json.token;
    } else if (res.status === 503) {
      console.warn(`${prefix} ⛔ Google Cooldown aktif`);
    }
  } catch (e) {
    console.warn(`${prefix} ⚠️ Token Sync error`);
  }
  return "";
}

function obtainRecaptchaToken(prefix, forceRefresh = false) {
  const now = Date.now();
  const tokenAge = (now - _tokenObtainedAt) / 1000;

  if (!forceRefresh && _cachedToken && _tokenObtainedAt > 0 && tokenAge < _currentTokenLifetime) {
    return _cachedToken;
  }

  const reason = forceRefresh ? "rejected" : (_cachedToken ? "expired" : "new");
  console.log(`${prefix} 🔄 Token (${reason})...`);

  const newToken = refreshRecaptchaToken(prefix, forceRefresh);
  if (newToken) {
    _cachedToken = newToken;
    _tokenObtainedAt = Date.now();
    _currentTokenLifetime = 110 + Math.floor(Math.random() * 5);
    console.log(`${prefix} ✅ Token OK (lifetime ${_currentTokenLifetime}s)`);
  } else {
    console.warn(`${prefix} ❌ Token gagal`);
  }
  return newToken || "";
}

// ==============================================================================
// Adaptive batch size — naik jika sukses, turun jika 429
// ==============================================================================
let _batchSize = BATCH_INIT;
let _consecutiveSuccess = 0;
let _consecutiveError = 0;

function adaptBatch(success) {
  if (success) {
    _consecutiveSuccess++;
    _consecutiveError = 0;
    if (_consecutiveSuccess >= 2) {
      _batchSize = Math.min(_batchSize + 1, BATCH_MAX);
      _consecutiveSuccess = 0;
    }
  } else {
    _consecutiveError++;
    _consecutiveSuccess = 0;
    if (_consecutiveError >= 2) {
      _batchSize = Math.max(Math.floor(_batchSize * 0.7), BATCH_MIN);
      _consecutiveError = 0;
    }
  }
}

// ==============================================================================
// Main
// ==============================================================================
export default function () {
  const vuId = __VU;
  const iterId = __ITER + 1;
  const prefix = `[VU${vuId}|#${iterId}]`;

  // Stagger start SETIAP iterasi (bukan cuma yang pertama) berdasarkan vuId,
  // supaya antar-VU tidak mengirim request di waktu yang sama persis.
  // Ini penting karena tiap VU jalan paralel independen — tanpa stagger,
  // total request rate gabungan ke server bisa jauh melebihi rate limit.
  const vuStaggerOffset = (vuId - 1) * REQUEST_STAGGER;
  sleep(vuStaggerOffset + Math.random() * REQUEST_STAGGER);

  let game = GAME_CHOICE;
  if (game === "all" || !AVAILABLE_GAMES.includes(game)) {
    game = AVAILABLE_GAMES[(vuId - 1) % AVAILABLE_GAMES.length];
  }

  const gameUrl = `${BASE_URL}/games/${game}`;
  const sessionUrl = `${BASE_URL}/api/games/${game}/sessions`;
  const scoreUrl = `${BASE_URL}/api/games/${game}/scores`;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    Origin: BASE_URL,
    Referer: gameUrl,
  };

  // 1. Ambil token (cached dari daemon, semua VU share token yang sama)
  const recaptchaToken = obtainRecaptchaToken(prefix, false);
  if (!recaptchaToken) {
    sleep(5);
    return;
  }

  // Jitter kecil setelah dapat token: mencegah SEMUA VU langsung mulai
  // open-session di detik yang SAMA persis begitu mereka bersama-sama
  // dapat token baru (baik dari solve baru maupun natural cache refresh).
  // Tanpa ini, beberapa VU akan collide di window sempit, menyebabkan
  // kontensi sesaat di server (durasi melonjak untuk beberapa round pertama).
  sleep((vuId - 1) * 0.4 + Math.random() * 1.5);

  const sessionPayload = JSON.stringify({
    username: USERNAME,
    "g-recaptcha-response": recaptchaToken,
  });

  // 2. Exploit token selama ~105 detik (token valid 2 menit)
  const cycleStart = Date.now();

  while (Date.now() - cycleStart < 105000) {
    // Open sessions — batch size adaptif, dikirim SATU-SATU dengan jeda REQUEST_STAGGER
    // agar tidak burst ke server (mencegah timeout & 429).
    // Setiap sesi dicatat waktu buka individualnya (openedAt) supaya durasi
    // main per-sesi bisa dihitung presisi saat submit nanti.
    const t0 = Date.now();
    const sessions = []; // { token, openedAt }
    let rateLimited = false;
    let allExpired = true;

    for (let i = 0; i < _batchSize; i++) {
      const openedAt = Date.now();
      const res = http.post(sessionUrl, sessionPayload, { headers });

      if (res.status === 200 || res.status === 201) {
        allExpired = false;
        sessionSuccessRate.add(1);
        try {
          const json = res.json();
          if (json && json.token) sessions.push({ token: json.token, openedAt });
        } catch (e) {}
      } else if (res.status === 429) {
        rateLimited = true;
        allExpired = false;
        sessionSuccessRate.add(0);
      } else if (res.status !== 422) {
        allExpired = false;
        sessionSuccessRate.add(0);
      }

      if (i < _batchSize - 1) sleep(REQUEST_STAGGER);
    }
    sessionDuration.add(Date.now() - t0);

    if (sessions.length === 0) {
      if (rateLimited) {
        adaptBatch(false);
        const backoff = 10 + Math.random() * 10;
        console.warn(`${prefix} ⛔ 429 Session! Batch→${_batchSize} Jeda ${backoff.toFixed(1)}s`);
        sleep(backoff);
      } else if (allExpired) {
        console.warn(`${prefix} ⚠️ 422 Token expired → refresh`);
        obtainRecaptchaToken(prefix, true);
        break;
      } else {
        sleep(3);
      }
      continue;
    }

    // Submit scores — setiap sesi menunggu SISA WAKTU INDIVIDUALNYA sendiri
    // sampai tepat mencapai TARGET_DURATION_SEC, BUKAN jeda flat REQUEST_STAGGER.
    // Ini penting: kalau submit sesi sebelumnya kena 429/lambat, sesi berikutnya
    // TIDAK ikut molor — dia tetap kejar ke deadline durasinya sendiri (atau submit
    // segera kalau deadline sudah lewat). Tanpa ini, satu 429 di tengah batch bisa
    // bikin SEMUA sesi setelahnya durasinya membengkak (efek domino/cascading delay).
    const t1 = Date.now();
    let successCount = 0;
    let scoreRateLimited = false;
    let lastScoreJson = null;
    let durationSumMs = 0;

    for (let i = 0; i < sessions.length; i++) {
      const elapsedNow = (Date.now() - sessions[i].openedAt) / 1000;
      const remainingWait = TARGET_DURATION - elapsedNow;
      if (remainingWait > 0) sleep(remainingWait);

      const durationMs = Date.now() - sessions[i].openedAt;
      const res = http.post(
        scoreUrl,
        JSON.stringify({ token: sessions[i].token, is_win: true, time_left: TIME_LEFT }),
        { headers }
      );

      if (res.status === 200 || res.status === 201) {
        scoreSuccessRate.add(1);
        successCount++;
        durationSumMs += durationMs;
        gamesPlayed.add(1);
        gamesWon.add(1);
        try {
          const json = res.json();
          if (json && json.score) {
            totalPoints.add(json.score.points || 0);
            lastScoreJson = json;
          }
        } catch (e) {}
      } else if (res.status === 429) {
        scoreRateLimited = true;
        scoreSuccessRate.add(0);
      } else if (res.status === 409) {
        scoreSuccessRate.add(0);
      } else if (res.status !== 422) {
        scoreSuccessRate.add(0);
      }
    }
    scoreSubmitDuration.add(Date.now() - t1);

    if (successCount > 0 && lastScoreJson) {
      adaptBatch(true);
      const pts = (lastScoreJson.score?.points || 0) * successCount;
      const rank = lastScoreJson.standing?.rank ? `#${lastScoreJson.standing.rank}` : "-";
      const total = lastScoreJson.standing?.total_score || "-";
      const avgDuration = (durationSumMs / successCount / 1000).toFixed(1);
      console.log(`${prefix} ✅ +${pts}pts (${successCount}/${sessions.length}) Batch:${_batchSize} | Durasi:~${avgDuration}s | Rank:${rank} Total:${total}`);
    } else if (successCount === 0) {
      adaptBatch(false);
    }

    if (scoreRateLimited) {
      const backoff = 10 + Math.random() * 10;
      console.warn(`${prefix} ⛔ 429 Score! Jeda ${backoff.toFixed(1)}s`);
      sleep(backoff);
    } else {
      sleep(ROUND_DELAY + Math.random() * 2);
    }
  }
}

export function setup() {
  console.log(`🚀 Optimized | VUs: ${VUS} | Batch: ${BATCH_MIN}-${BATCH_MAX} (init: ${BATCH_INIT}) | Game: ${GAME_CHOICE}`);
  return {};
}

export function handleSummary(data) {
  const games = data.metrics.games_played?.values?.count || 0;
  const pts = data.metrics.points_earned?.values?.count || 0;
  const ssr = ((data.metrics.session_success_rate?.values?.rate || 0) * 100).toFixed(1);
  const scr = ((data.metrics.score_success_rate?.values?.rate || 0) * 100).toFixed(1);
  console.log(`\n🏆 Games: ${games} | Points: ${pts} | Session SR: ${ssr}% | Score SR: ${scr}%\n`);
  return { stdout: "" };
}
