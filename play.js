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

const VUS = parseInt(getEnv("VUS", "3"), 10);
const LOOP_COUNT = parseInt(getEnv("LOOP_COUNT", "100"), 10);
const TIME_LEFT = parseInt(getEnv("TIME_LEFT", "22"), 10);
const SIMULATE_DELAY = getEnv("SIMULATE_GAMEPLAY_DELAY", "true") !== "false";
const GAMEPLAY_DURATION_SEC = parseFloat(getEnv("GAMEPLAY_DURATION_SEC", "7.8"));
const ROUND_DELAY_SEC = parseFloat(getEnv("ROUND_DELAY_SEC", "3"));

// Available Mini Games
const AVAILABLE_GAMES = ["tariktambang", "panjatpinang", "balapkarung"];

export const options = {
  scenarios: {
    minigames_automation: {
      executor: "per-vu-iterations",
      vus: VUS, // 3 VU untuk 3 game serentak bersamaan
      iterations: LOOP_COUNT, // 100 ronde per game
      maxDuration: "12h",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.10"], // kurang dari 10% request gagal
    session_success_rate: ["rate>0.80"], // minimal 80% session berhasil
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
  console.log(`=============================================================\n`);
  return { ip };
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
  // 1. Coba ambil token reCAPTCHA terbaru dari Token Sync Daemon
  try {
    const res = http.get("http://127.0.0.1:9876/token", { timeout: "2s" });
    if (res.status === 200) {
      const json = res.json();
      if (json && json.token) return json.token;
    }
  } catch (e) { }

  if (CAPSOLVER_KEY) {
    const token = solveCaptchaWithCapSolver(CAPSOLVER_KEY, SITEKEY, gameUrl);
    if (token) return token;
  }

  if (TWOCAPTCHA_KEY) {
    const token = solveCaptchaWith2Captcha(TWOCAPTCHA_KEY, SITEKEY, gameUrl);
    if (token) return token;
  }

  return STATIC_GRECAPTCHA;
}

function refreshRecaptchaToken(prefix = "") {
  console.log(`${prefix} 🔄 [Token Sync] Meminta token reCAPTCHA baru via Anti-Ban Daemon...`);
  try {
    const res = http.get("http://127.0.0.1:9876/refresh", { timeout: "120s" });
    if (res.status === 200) {
      const json = res.json();
      if (json && json.token) {
        console.log(`${prefix} 💾 [Token Sync] Token reCAPTCHA baru didapatkan & di-rewrite ke .env!`);
        return json.token;
      }
    } else if (res.status === 503) {
      const json = res.json();
      if (json && json.cooldown) {
        console.warn(`${prefix} ⛔ [Token Sync] Google Cooldown Aktif. Menjeda eksekusi agar limit IP pulih...`);
      }
    }
  } catch (e) {
    console.warn(`${prefix} [Token Sync] Notice refresh:`, e);
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
// Main Scenario Execution per VU Iteration
// ==============================================================================
export default function (data) {
  const vuId = __VU;
  const currentIp = data ? data.ip : "Unknown";
  const iterId = __ITER + 1;

  // Stagger awal antar VU untuk mencegah benturan request di milidetik yang sama
  if (iterId === 1 && vuId > 1) {
    const initialStagger = (vuId - 1) * 2.5;
    console.log(`[VU ${vuId}] ⏳ Staggering start selama ${initialStagger.toFixed(1)}s...`);
    sleep(initialStagger);
  }

  // Setiap VU memegang 1 game unik -> 3 game berjalan serentak bersamaan
  let game = GAME_CHOICE;
  if (game === "all" || !AVAILABLE_GAMES.includes(game)) {
    const gameIdx = (vuId - 1) % AVAILABLE_GAMES.length;
    game = AVAILABLE_GAMES[gameIdx];
  }

  const gameUrl = `${BASE_URL}/games/${game}`;
  const prefix = `[VU ${vuId} | Iter ${iterId}/${LOOP_COUNT} | ${game}]`;

  console.log(`\n-------------------------------------------------------------`);
  console.log(`${prefix} 🚀 Memulai sesi permainan untuk user: "${USERNAME}"`);

  // Tampilkan posisi leaderboard live saat ini
  const initialStanding = fetchLeaderboardStanding(USERNAME);
  printStandingBanner(initialStanding, USERNAME, prefix);

  // 1. Dapatkan Token reCAPTCHA
  let recaptchaToken = getRecaptchaToken(gameUrl);
  if (!recaptchaToken) {
    console.warn(`${prefix} ⚠️ Token reCAPTCHA belum tersedia. Meminta token baru...`);
    recaptchaToken = refreshRecaptchaToken(prefix);
  }

  // 2. Request: Open Session (POST /api/games/{game}/sessions)
  const sessionUrl = `${BASE_URL}/api/games/${game}/sessions`;
  let sessionPayload = JSON.stringify({
    username: USERNAME,
    "g-recaptcha-response": recaptchaToken || "",
  });

  const sessionParams = {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      Origin: BASE_URL,
      Referer: gameUrl,
    },
    tags: { name: "OpenSession" },
  };

  console.log(`${prefix} 📤 [API Request] POST ${sessionUrl} | Body: ${sessionPayload.substring(0, 120)}`);
  recordApiCall({
    vu: vuId,
    iteration: iterId,
    game: game,
    type: "request",
    method: "POST",
    url: sessionUrl,
    body: sessionPayload,
  });

  const sessionStart = new Date().getTime();
  let sessionRes = http.post(sessionUrl, sessionPayload, sessionParams);
  sessionDuration.add(new Date().getTime() - sessionStart);

  console.log(`${prefix} 📥 [API Response] ${sessionUrl} -> HTTP ${sessionRes.status} | Body: ${(sessionRes.body || "").substring(0, 120)}`);
  recordApiCall({
    vu: vuId,
    iteration: iterId,
    game: game,
    type: "response",
    url: sessionUrl,
    status: sessionRes.status,
    body: sessionRes.body || "",
  });

  // Jika token reCAPTCHA expired/invalid (422), lakukan refresh token dengan jeda anti-ban
  if (sessionRes.status === 422) {
    console.warn(`${prefix} ⚠️ Sesi 422 (Token Expired / Invalid). Melakukan refresh token reCAPTCHA...`);
    // Jeda jitter lebih natural 3-6 detik sebelum mencoba ulang refresh
    sleep(3 + Math.random() * 3.5);
    const freshToken = refreshRecaptchaToken(prefix);
    if (freshToken) {
      recaptchaToken = freshToken;
      sessionPayload = JSON.stringify({
        username: USERNAME,
        "g-recaptcha-response": recaptchaToken,
      });
      sessionRes = http.post(sessionUrl, sessionPayload, sessionParams);
      console.log(`${prefix} 📥 [API Response Retry] ${sessionUrl} -> HTTP ${sessionRes.status} | Body: ${(sessionRes.body || "").substring(0, 120)}`);
      recordApiCall({
        vu: vuId,
        iteration: iterId,
        game: game,
        type: "response",
        url: sessionUrl,
        status: sessionRes.status,
        body: sessionRes.body || "",
      });
    } else {
      console.warn(`${prefix} ⏳ Token refresh belum menghasilkan token baru (cooldown aktif). Menjeda 15 detik...`);
      sleep(15);
      return;
    }
  }

  // Tangani status rate limit 429
  if (sessionRes.status === 429) {
    sessionSuccessRate.add(0);
    console.warn(`${prefix} ⛔ Rate limit 429 (Too Many Requests) pada IP: ${currentIp}! Menjeda selama 25 detik...`);
    sleep(25);
    return;
  }

  const sessionCheck = check(sessionRes, {
    "session status is 200 or 201": (r) => r.status === 200 || r.status === 201,
  });

  let sessionJson = {};
  try {
    sessionJson = sessionRes.json() || {};
  } catch (e) {
    console.error(`${prefix} Gagal parse response session:`, sessionRes.body);
  }

  if (!sessionCheck || !sessionJson.token) {
    sessionSuccessRate.add(0);
    const errMessage = sessionJson.message || (sessionJson.errors ? JSON.stringify(sessionJson.errors) : sessionRes.body);
    console.error(`${prefix} ❌ Gagal membuka sesi (HTTP ${sessionRes.status}): ${errMessage}`);
    sleep(ROUND_DELAY_SEC + Math.random() * 2);
    return;
  }

  sessionSuccessRate.add(1);
  const sessionToken = sessionJson.token;
  console.log(`${prefix} ✅ Sesi ONLINE! Session Token: ${sessionToken.substring(0, 16)}...`);

  // 3. Simulasi Gameplay (Durasi tap + Random Jitter agar natural)
  if (SIMULATE_DELAY) {
    // Ambil total durasi game dari response sesi (biasanya 30 detik)
    const gameDuration = sessionJson.duration || 30; 
    // Hitung waktu minimal yang logis masuk akal bagi server (misal 30 - 22 = 8 detik)
    const minRequiredTime = Math.max(0.1, gameDuration - TIME_LEFT);
    
    // Pastikan base duration tidak kurang dari batas minimal, ditambah sedikit jitter
    const gameplayJitter = Math.random() * 0.5;
    const actualGameplayDuration = Math.max(minRequiredTime, GAMEPLAY_DURATION_SEC) + gameplayJitter;
    
    console.log(`${prefix} 🎮 Bermain game (${actualGameplayDuration.toFixed(2)} detik)...`);
    sleep(actualGameplayDuration);
  }

  // Tambahkan jeda setiap VU untuk submit post ke API agar tidak berbarengan
  // Jitter submit dibuat lebih bervariasi
  const submitStagger = ((vuId - 1) % 10) * 0.5 + (Math.random() * 0.5);
  console.log(`${prefix} ⏳ Jeda VU sebelum submit API: ${submitStagger.toFixed(1)} detik...`);
  sleep(submitStagger);
  
  // Pengaman terakhir: pastikan waktu berjalan sejak sesi dimulai benar-benar valid sebelum memanggil API scores
  const elapsedSec = (new Date().getTime() - sessionStart) / 1000;
  const expectedElapsed = (sessionJson.duration || 30) - TIME_LEFT;
  if (elapsedSec < expectedElapsed) {
    const extraWait = expectedElapsed - elapsedSec + 0.1;
    sleep(extraWait);
  }

  // 4. Request: Submit Score (POST /api/games/{game}/scores)
  const scoreUrl = `${BASE_URL}/api/games/${game}/scores`;
  const scorePayload = JSON.stringify({
    token: sessionToken,
    is_win: true,
    time_left: TIME_LEFT,
  });

  const scoreParams = {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      Origin: BASE_URL,
      Referer: gameUrl,
    },
    tags: { name: "SubmitScore" },
  };

  console.log(`${prefix} 📤 [API Request] POST ${scoreUrl} | Body: ${scorePayload}`);
  recordApiCall({
    vu: vuId,
    iteration: iterId,
    game: game,
    type: "request",
    method: "POST",
    url: scoreUrl,
    body: scorePayload,
  });

  const scoreStart = new Date().getTime();
  const scoreRes = http.post(scoreUrl, scorePayload, scoreParams);
  scoreSubmitDuration.add(new Date().getTime() - scoreStart);

  console.log(`${prefix} 📥 [API Response] ${scoreUrl} -> HTTP ${scoreRes.status} | Body: ${(scoreRes.body || "").substring(0, 120)}`);
  recordApiCall({
    vu: vuId,
    iteration: iterId,
    game: game,
    type: "response",
    url: scoreUrl,
    status: scoreRes.status,
    body: scoreRes.body || "",
  });

  let scoreJson = {};
  try {
    scoreJson = scoreRes.json() || {};
  } catch (e) {
    console.error(`${prefix} Gagal parse response score:`, scoreRes.body);
  }

  const scoreCheck = check(scoreRes, {
    "score submit status is 200 or 201": (r) => r.status === 200 || r.status === 201,
    "score recorded ok": () => scoreJson.score !== undefined,
  });

  if (!scoreCheck || !scoreJson.score) {
    scoreSuccessRate.add(0);
    const errText = scoreJson.message || scoreRes.body;
    console.error(`${prefix} ❌ Gagal submit skor (HTTP ${scoreRes.status}): ${errText}`);
    
    // Backoff jika server kepenuhan / error 500+
    if (scoreRes.status >= 500) {
      console.warn(`${prefix} ⛔ Server Error ${scoreRes.status}! Jeda darurat 15 detik agar server pulih...`);
      sleep(15);
    }
  } else {
    scoreSuccessRate.add(1);
    gamesPlayed.add(1);
    gamesWon.add(1);

    const points = scoreJson.score.points || 0;
    totalPoints.add(points);

    const standing = scoreJson.standing || {};
    const rank = standing.rank ? `#${standing.rank}` : "-";
    const totalScore = standing.total_score || "-";
    const totalPlays = standing.total_plays || "-";

    console.log(
      `${prefix} 🎉 Sukses! Poin Ronde: +${points} | Peringkat: ${rank} | Total Skor: ${totalScore} (${totalPlays}x main)`
    );

    // Ambil dan tampilkan posisi ranking terakhir dari leaderboard
    const standingData = fetchLeaderboardStanding(USERNAME);
    printStandingBanner(standingData, USERNAME, prefix);
  }

  // 5. Jeda antar ronde sebelum iterasi berikutnya (dengan jitter anti-bot yang lebih lama agar mirip manusia)
  if (iterId < LOOP_COUNT) {
    // Jitter tambahan + ROUND_DELAY_SEC
    const jitteredDelay = ROUND_DELAY_SEC + Math.random() * 1.0;
    console.log(`${prefix} ⏳ Istirahat antar game ${jitteredDelay.toFixed(1)}s (human-like) sebelum ronde berikutnya...`);
    sleep(jitteredDelay);
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
