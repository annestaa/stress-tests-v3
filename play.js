import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ==============================================================================
// Custom Metrics
// ==============================================================================
const gamesPlayed = new Counter("games_played");
const gamesWon = new Counter("games_won");
const totalPoints = new Counter("points_earned");
const sessionSuccessRate = new Rate("session_success_rate");
const scoreSuccessRate = new Rate("score_success_rate");
const sessionDuration = new Trend("session_duration_ms");
const scoreSubmitDuration = new Trend("score_submit_duration_ms");

// ==============================================================================
// Automatic .env Loader & Configuration
// ==============================================================================
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
          const val = line.substring(eqIdx + 1).trim();
          if (envObj[key] === undefined) {
            envObj[key] = val;
          }
        }
      }
    } catch (e) { }
  }
  return envObj;
}

const DOT_ENV = loadDotEnv();
const getEnv = (key, fallback = "") => __ENV[key] || DOT_ENV[key] || fallback;

const BASE_URL = getEnv("BASE_URL", "https://kemerdekaan.liputan6.com");
const USERNAME = getEnv("MINIGAMES_USERNAME", "kbrnugroho");
const GAME_CHOICE = getEnv("GAME_CHOICE", "all").toLowerCase();
const STATIC_GRECAPTCHA = getEnv("GRECAPTCHA_TOKEN", "");
const CAPSOLVER_KEY = getEnv("CAPSOLVER_API_KEY", "");
const TWOCAPTCHA_KEY = getEnv("TWOCAPTCHA_API_KEY", "");
const SITEKEY = getEnv("RECAPTCHA_SITEKEY", "6LfAlHgtAAAAAFVPd3EGbA_FvEUvL6yfI8lKcma5");

const VUS = parseInt(getEnv("VUS", "10"), 10);
const LOOP_COUNT = parseInt(getEnv("LOOP_COUNT", "9999"), 10);
const TIME_LEFT = parseInt(getEnv("TIME_LEFT", "22"), 10);
const BATCH_SIZE = parseInt(getEnv("BATCH_SIZE", "5"), 10);

// Durasi validitas token reCAPTCHA (2 menit = 120 detik)
const TOKEN_LIFETIME_SEC = 120;

// Jeda gameplay antara open session -> submit score (bisa diatur dari .env)
const GAMEPLAY_DELAY = parseFloat(getEnv("GAMEPLAY_DURATION_SEC", "7.5"));
const ROUND_DELAY = parseFloat(getEnv("ROUND_DELAY_SEC", "2.0"));

// Available Mini Games
const AVAILABLE_GAMES = ["tariktambang", "panjatpinang", "balapkarung"];

export const options = {
  scenarios: {
    minigames_automation: {
      executor: "per-vu-iterations",
      vus: VUS, // Multi-VU sharing 1 reCAPTCHA token
      iterations: LOOP_COUNT,
      maxDuration: "12h",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.10"],
    session_success_rate: ["rate>0.80"],
  },
};

export function setup() {
  let ip = "Tidak diketahui";
  try {
    const res = http.get("https://api64.ipify.org?format=json", { timeout: "5s" });
    if (res.status === 200) {
      ip = res.json().ip;
    }
  } catch (e) { }

  console.log(`\n=============================================================`);
  console.log(`🌐 INFO: Public IP Kamu Saat Ini adalah [ ${ip} ]`);
  console.log(`=============================================================`);
  console.log(`⚙️ MODE: ${VUS} VU (shared token) | 1 Token per ${TOKEN_LIFETIME_SEC}s | Gameplay ${GAMEPLAY_DELAY}s | ${ROUND_DELAY}s jeda antar ronde`);
  console.log(`=============================================================\n`);
  return { ip, cachedToken: "", tokenObtainedAt: 0 };
}

// ==============================================================================
// Helper: 3rd-party Captcha Solvers (CapSolver & 2Captcha)
// ==============================================================================
function solveCaptchaWithCapSolver(apiKey, sitekey, pageUrl) {
  console.log(`[Captcha] Meminta penyelesaian reCAPTCHA via CapSolver...`);
  const createRes = http.post(
    "https://api.capsolver.com/createTask",
    JSON.stringify({
      clientKey: apiKey,
      task: {
        type: "ReCaptchaV2TaskProxyLess",
        websiteURL: pageUrl,
        websiteKey: sitekey,
      },
    }),
    { headers: { "Content-Type": "application/json" } }
  );

  const createJson = createRes.json();
  if (!createJson || createJson.errorId !== 0) {
    console.error(`[Captcha] CapSolver createTask error: ${createJson ? createJson.errorDescription : createRes.status}`);
    return null;
  }

  const taskId = createJson.taskId;
  for (let i = 0; i < 30; i++) {
    sleep(3);
    const resultRes = http.post(
      "https://api.capsolver.com/getTaskResult",
      JSON.stringify({ clientKey: apiKey, taskId }),
      { headers: { "Content-Type": "application/json" } }
    );

    const resultJson = resultRes.json();
    if (resultJson && resultJson.status === "ready") {
      console.log(`[Captcha] CapSolver token berhasil didapatkan!`);
      return resultJson.solution.gRecaptchaResponse;
    }
    if (resultJson && resultJson.status === "failed") {
      console.error(`[Captcha] CapSolver gagal: ${resultJson.errorDescription}`);
      return null;
    }
  }
  console.error(`[Captcha] CapSolver timeout setelah 90 detik.`);
  return null;
}

function solveCaptchaWith2Captcha(apiKey, sitekey, pageUrl) {
  console.log(`[Captcha] Meminta penyelesaian reCAPTCHA via 2Captcha...`);
  const inUrl = `https://2captcha.com/in.php?key=${apiKey}&method=userrecaptcha&googlekey=${sitekey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`;
  const inRes = http.get(inUrl);
  const inJson = inRes.json();

  if (!inJson || inJson.status !== 1) {
    console.error(`[Captcha] 2Captcha in.php error: ${inJson ? inJson.request : inRes.status}`);
    return null;
  }

  const requestId = inJson.request;
  for (let i = 0; i < 30; i++) {
    sleep(4);
    const resUrl = `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${requestId}&json=1`;
    const resRes = http.get(resUrl);
    const resJson = resRes.json();

    if (resJson && resJson.status === 1) {
      console.log(`[Captcha] 2Captcha token berhasil didapatkan!`);
      return resJson.request;
    }
    if (resJson && resJson.request !== "CAPCHA_NOT_READY") {
      console.error(`[Captcha] 2Captcha error: ${resJson.request}`);
      return null;
    }
  }
  console.error(`[Captcha] 2Captcha timeout setelah 120 detik.`);
  return null;
}

function getRecaptchaToken(gameUrl) {
  if (CAPSOLVER_KEY) {
    const token = solveCaptchaWithCapSolver(CAPSOLVER_KEY, SITEKEY, gameUrl);
    if (token) return token;
  }

  if (TWOCAPTCHA_KEY) {
    const token = solveCaptchaWith2Captcha(TWOCAPTCHA_KEY, SITEKEY, gameUrl);
    if (token) return token;
  }

  // Return null agar selalu memanggil refreshRecaptchaToken (On-Demand) setiap kali butuh token baru
  return null;
}

function refreshRecaptchaToken(prefix = "", forceRefresh = false) {
  try {
    const url = forceRefresh ? "http://127.0.0.1:9876/refresh?force=true" : "http://127.0.0.1:9876/refresh";
    const res = http.get(url, { timeout: "120s" });
    if (res.status === 200) {
      const json = res.json();
      if (json && json.token) {
        return json.token;
      }
    } else if (res.status === 503) {
      console.warn(`${prefix} ⛔ Google Cooldown aktif`);
    }
  } catch (e) {
    console.warn(`${prefix} ⚠️ Token Sync error`);
  }
  return "";
}

function recordApiCall(record) {
  try {
    http.post("http://127.0.0.1:9876/record", JSON.stringify(record), {
      headers: { "Content-Type": "application/json" },
      timeout: "2s",
    });
  } catch (e) { }
}

// ==============================================================================
// Token Cache State (VU-level, persisten antar iterasi via global variable)
// ==============================================================================
let _cachedToken = "";
let _tokenObtainedAt = 0;
let _currentTokenLifetime = 115;
let _vuGamesWon = 0; // Hitung kemenangan per VU

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
    _currentTokenLifetime = 110 + Math.floor(Math.random() * 5); // 110-115s
    console.log(`${prefix} ✅ Token OK (Lifetime ${_currentTokenLifetime}s)`);
  } else {
    console.warn(`${prefix} ❌ Token gagal`);
  }
  return newToken || "";
}

// ==============================================================================
// Main Scenario: BATCH MODE (Exploit Concurrent Race Condition)
// ==============================================================================
export default function (data) {
  const vuId = __VU;
  const iterId = __ITER + 1;

  if (iterId === 1 && vuId > 1) {
    sleep(vuId * 2);
  } else {
    sleep(Math.random() * 2);
  }

  let game = GAME_CHOICE;
  if (game === "all" || !AVAILABLE_GAMES.includes(game)) {
    game = AVAILABLE_GAMES[(vuId - 1) % AVAILABLE_GAMES.length];
  }
  const gameUrl = `${BASE_URL}/games/${game}`;
  const prefix = `[VU${vuId}|#${iterId}]`;

  if (vuId === 1 && (iterId === 1 || iterId % 50 === 0)) {
    const standing = fetchLeaderboardStanding(USERNAME);
    printStandingBanner(standing, USERNAME, prefix);
  }

  // 1. Ambil Token (cached, karena 1 token bisa dipakai banyak sesi selama 2 menit)
  const recaptchaToken = obtainRecaptchaToken(prefix, false);
  if (!recaptchaToken) {
    sleep(5);
    return;
  }

  const sessionUrl = `${BASE_URL}/api/games/${game}/sessions`;
  const scoreUrl = `${BASE_URL}/api/games/${game}/scores`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    Origin: BASE_URL,
    Referer: gameUrl,
  };

  const sessionPayload = JSON.stringify({
    username: USERNAME,
    "g-recaptcha-response": recaptchaToken,
  });

  const cycleStart = Date.now();
  
  // Mainkan secara terus-menerus selama token reCAPTCHA ini masih berlaku (~105 detik)
  while (Date.now() - cycleStart < 105000) {
    // 2. Open Session (BATCH)
    const sessionReqs = [];
    const batchSize = typeof BATCH_SIZE !== 'undefined' ? BATCH_SIZE : 5;
    for (let i = 0; i < batchSize; i++) {
      sessionReqs.push(["POST", sessionUrl, sessionPayload, { headers, tags: { name: "OpenSession" } }]);
    }

    const sessionResponses = http.batch(sessionReqs);
    const validSessionTokens = [];
    let rateLimited = false;
    let allExpired = true;

    for (const res of sessionResponses) {
      if (res.status === 200 || res.status === 201) {
        allExpired = false;
        sessionSuccessRate.add(1);
        try {
          const json = res.json();
          if (json && json.token) validSessionTokens.push(json.token);
        } catch (e) { }
      } else if (res.status === 429) {
        rateLimited = true;
        allExpired = false;
        sessionSuccessRate.add(0);
      } else if (res.status !== 422) {
        allExpired = false;
        sessionSuccessRate.add(0);
      }
    }

    if (validSessionTokens.length === 0) {
      if (rateLimited) {
        const backoff = 10 + Math.random() * 10;
        console.warn(`${prefix} ⛔ 429 Rate limit (Session)! Jeda ${backoff.toFixed(1)}s`);
        sleep(backoff);
      } else if (allExpired) {
        console.warn(`${prefix} ⚠️ 422 Token rejected/expired → Force refreshing reCAPTCHA...`);
        obtainRecaptchaToken(prefix, true);
        break; // Keluar dari loop siklus agar k6 iteration mengulang dari awal dan mengambil token baru
      } else {
        sleep(3);
      }
      continue;
    }

    // 3. Gameplay Delay (Penting agar server mengira kita bermain)
    sleep(GAMEPLAY_DELAY);

    // 4. Submit Score (BATCH) - menggunakan FRESH session tokens
    const scoreReqs = validSessionTokens.map(sessionToken => {
      return ["POST", scoreUrl, JSON.stringify({
        token: sessionToken,
        is_win: true,
        time_left: TIME_LEFT,
      }), { headers, tags: { name: "SubmitScore" } }];
    });

    const scoreResponses = http.batch(scoreReqs);
    let successCount = 0;
    let scoreRateLimited = false;
    let lastScoreJson = null;

    for (const res of scoreResponses) {
      if (res.status === 200 || res.status === 201) {
        scoreSuccessRate.add(1);
        successCount++;
        gamesPlayed.add(1);
        gamesWon.add(1);
        _vuGamesWon++;
        try {
          const json = res.json();
          if (json && json.score) {
            totalPoints.add(json.score.points || 0);
            lastScoreJson = json;
          }
        } catch (e) { }
      } else if (res.status === 429) {
        scoreRateLimited = true;
        scoreSuccessRate.add(0);
      } else if (res.status === 409) {
        console.warn(`${prefix} ⚠️ 409 Conflict: Sesi sudah digunakan (Race condition backend)`);
      } else if (res.status !== 422) {
        scoreSuccessRate.add(0);
        console.error(`${prefix} ❌ Submit gagal (${res.status})`);
      }
    }

    if (successCount > 0 && lastScoreJson) {
      const totalBatchPoints = (lastScoreJson.score?.points || 0) * successCount;
      const standing = lastScoreJson.standing || {};
      const rank = standing.rank ? `#${standing.rank}` : "-";
      const totalScore = standing.total_score || "-";
      console.log(`${prefix} ✅ +${totalBatchPoints}pts (Batch: ${successCount}/${validSessionTokens.length}) | Rank ${rank} | Total: ${totalScore}`);
    }

    if (scoreRateLimited) {
      const backoff = 10 + Math.random() * 10;
      console.warn(`${prefix} ⛔ 429 Rate limit (Score)! Jeda ${backoff.toFixed(1)}s`);
      sleep(backoff);
    } else {
      const jitter = Math.random() * 4;
      sleep(ROUND_DELAY + jitter);
    }
  }
}

// ==============================================================================
// Helper: Fetch Leaderboard Standing from Server API
// ==============================================================================
export function fetchLeaderboardStanding(username) {
  try {
    const res = http.get("https://kemerdekaan.liputan6.com/api/games/leaderboard", {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      },
    });

    if (res.status === 200) {
      const data = res.json();
      const period = data.period || {};
      const board = data.board || [];
      const userRank = board.find(
        (r) => r.username && r.username.toLowerCase() === username.toLowerCase()
      );

      return {
        periodLabel: period.label || period.key || "Periode Aktif",
        board: board,
        userStanding: userRank || null,
        top3: board.slice(0, 3),
      };
    }
  } catch (e) { }
  return null;
}

export function printStandingBanner(standingData, username, prefix = "") {
  if (!standingData) return;

  const { periodLabel, userStanding, top3 } = standingData;

  console.log(`\n${prefix} =============================================================`);
  console.log(`${prefix} 🏆 KLASEMEN & PERINGKAT TERAKHIR: "${username}"`);
  console.log(`${prefix} Periode: ${periodLabel}`);
  console.log(`${prefix} -------------------------------------------------------------`);

  if (userStanding) {
    console.log(`${prefix} 📍 Peringkat Kamu    : #${userStanding.rank} (dari seluruh peserta)`);
    console.log(`${prefix} ⭐️ Total Poin       : ${Number(userStanding.total_score).toLocaleString()} Poin`);
    console.log(`${prefix} 🎮 Total Bermain    : ${userStanding.total_plays}x main`);
    if (userStanding.already_won) {
      console.log(`${prefix} 🎖 Status Hadiah    : Sudah pernah menang di periode sebelumnya`);
    }
  } else {
    console.log(`${prefix} 📍 Peringkat Kamu    : Belum masuk 20 besar papan peringkat`);
  }

  if (top3 && top3.length > 0) {
    console.log(`${prefix} -------------------------------------------------------------`);
    console.log(`${prefix} 🥇 #1: ${top3[0].username} (${Number(top3[0].total_score).toLocaleString()} Poin - ${top3[0].total_plays}x main)`);
    if (top3[1]) {
      console.log(`${prefix} 🥈 #2: ${top3[1].username} (${Number(top3[1].total_score).toLocaleString()} Poin - ${top3[1].total_plays}x main)`);
    }
    if (top3[2]) {
      console.log(`${prefix} 🥉 #3: ${top3[2].username} (${Number(top3[2].total_score).toLocaleString()} Poin - ${top3[2].total_plays}x main)`);
    }
  }
  console.log(`${prefix} =============================================================\n`);
}

// ==============================================================================
// Custom Summary Handler
// ==============================================================================
export function handleSummary(data) {
  const totalRounds = data.metrics.games_played ? data.metrics.games_played.values.count : 0;
  const totalPts = data.metrics.points_earned ? data.metrics.points_earned.values.count : 0;
  const sessSuccess = data.metrics.session_success_rate ? (data.metrics.session_success_rate.values.rate * 100).toFixed(1) : 0;
  const scoreSuccess = data.metrics.score_success_rate ? (data.metrics.score_success_rate.values.rate * 100).toFixed(1) : 0;

  console.log(`\n=============================================================`);
  console.log(`📊 RINGKASAN HASIL OTOMASI K6 MINI GAMES`);
  console.log(`=============================================================`);
  console.log(`Total Game Sukses Dimainkan : ${totalRounds}`);
  console.log(`Total Poin Diperoleh        : ${totalPts}`);
  console.log(`Session Success Rate        : ${sessSuccess}%`);
  console.log(`Score Submit Success Rate   : ${scoreSuccess}%`);

  const standingData = fetchLeaderboardStanding(USERNAME);
  printStandingBanner(standingData, USERNAME, "");

  return {
    stdout: "", // Default output
  };
}
