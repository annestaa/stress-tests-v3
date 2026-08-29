import http from "k6/http";
import { sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

// ==============================================================================
// Custom Metrics
// ==============================================================================
const gamesPlayed = new Counter("games_played");
const gamesWon = new Counter("games_won");
const totalPoints = new Counter("points_earned");
const sessionSuccessRate = new Rate("session_success_rate");
const scoreSuccessRate = new Rate("score_success_rate");

// ==============================================================================
// Config Loader
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
          let val = line.substring(eqIdx + 1).trim();
          const commentIdx = val.indexOf(" #");
          if (commentIdx > 0) val = val.substring(0, commentIdx).trim();
          val = val.replace(/^["']|["']$/g, "");
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
const USERNAME = getEnv("MINIGAMES_USERNAME", "zildjiannesta");
const GAME_CHOICE = getEnv("GAME_CHOICE", "all").toLowerCase();

const LOOP_COUNT = parseInt(getEnv("LOOP_COUNT", "9999999"), 10);
const TIME_LEFT = parseInt(getEnv("TIME_LEFT", "22"), 10);

// Token: generate 1x tiap 2+ menit, reuse terus
const TOKEN_LIFETIME_SEC = 125;
const TOKEN_REGEN_MIN_SEC = 125;

// Stagger: jeda antar SETIAP request (open session / submit score)
// 0.5s = ~120 request/menit (60 open + 60 submit)
// Tapi karena overlap hanya mulai setelah pipeline penuh (~7.8s),
// effective game rate = ~30-60/menit tergantung kondisi network
const REQUEST_STAGGER = parseFloat(getEnv("REQUEST_STAGGER_SEC", "0.5"));

// Durasi gameplay minimum agar server terima. <10s = 50pts tier
const TARGET_DURATION = parseFloat(getEnv("TARGET_DURATION_SEC", "7.8"));

const AVAILABLE_GAMES = ["tariktambang", "panjatpinang", "balapkarung"];

export const options = {
  scenarios: {
    pipeline: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: LOOP_COUNT,
      maxDuration: "48h",
    },
  },
};

export function setup() {
  let ip = "?";
  try {
    const res = http.get("https://api64.ipify.org?format=json", { timeout: "5s" });
    if (res.status === 200) ip = res.json().ip;
  } catch (e) { }

  console.log("\n=============================================================");
  console.log("  PIPELINE MODE");
  console.log("  IP: " + ip);
  console.log("  Stagger: " + REQUEST_STAGGER + "s | Target Duration: " + TARGET_DURATION + "s");
  console.log("  Token regen: 1x tiap " + TOKEN_REGEN_MIN_SEC + "s (2+ menit)");
  console.log("  Game: " + GAME_CHOICE + " | Username: " + USERNAME);
  console.log("=============================================================\n");
  return {};
}

// ==============================================================================
// Token Management - 1 token per 2+ menit
// ==============================================================================
let _cachedToken = "";
let _tokenObtainedAt = 0;

function getToken(force = false) {
  const reason = force ? "rejected" : _cachedToken ? "expired" : "new";
  console.log(`  🔄 Minta token (${reason})...`);
  
  try {
    const url = force
      ? "http://captcha-solver:9876/refresh?force=true"
      : "http://captcha-solver:9876/refresh";
    const res = http.get(url, { timeout: "120s" });
    if (res.status === 200) {
      const json = res.json();
      if (json && json.token) return json.token;
    } else if (res.status === 503) {
      console.warn(prefix + " Google Cooldown aktif");
    }
  } catch (e) {
    console.warn(prefix + " Token Sync error");
  }
  return "";
}

function obtainRecaptchaToken(prefix, forceRefresh) {
  const now = Date.now();
  const tokenAge = (now - _tokenObtainedAt) / 1000;

  // Masih valid -> reuse
  if (!forceRefresh && _cachedToken && _tokenObtainedAt > 0 && tokenAge < TOKEN_LIFETIME_SEC) {
    return _cachedToken;
  }

  // Force tapi belum 2 menit -> tunggu
  if (forceRefresh && _tokenObtainedAt > 0 && tokenAge < TOKEN_REGEN_MIN_SEC) {
    const waitTime = TOKEN_REGEN_MIN_SEC - tokenAge;
    console.log(prefix + " Tunggu " + waitTime.toFixed(0) + "s (min interval 2+ min)...");
    sleep(waitTime + 1);
  }

  const reason = forceRefresh ? "rejected" : (_cachedToken ? "expired" : "new");
  console.log(prefix + " Token (" + reason + ")...");

  const newToken = refreshRecaptchaToken(prefix, forceRefresh);
  if (newToken) {
    _cachedToken = newToken;
    _tokenObtainedAt = Date.now();
    console.log(prefix + " Token OK");
  } else {
    console.warn(prefix + " Token gagal!");
  }
  return newToken || "";
}

// ==============================================================================
// Score Submit Helper
// ==============================================================================
function submitScore(session, url, hdrs, pfx) {
  const durSec = (Date.now() - session.openedAt) / 1000;
  const res = http.post(
    url,
    JSON.stringify({ token: session.token, is_win: true, time_left: TIME_LEFT }),
    { headers: hdrs, tags: { name: "SubmitScore" } }
  );

  if (res.status === 200 || res.status === 201) {
    scoreSuccessRate.add(1);
    gamesPlayed.add(1);
    gamesWon.add(1);
    try {
      const json = res.json();
      const pts = (json && json.score) ? (json.score.points || 0) : 0;
      totalPoints.add(pts);
      const rank = (json && json.standing && json.standing.rank) ? ("#" + json.standing.rank) : "-";
      const total = (json && json.standing) ? (json.standing.total_score || "-") : "-";
      console.log(pfx + " +" + pts + "pts | Dur:" + durSec.toFixed(1) + "s | Rank:" + rank + " Total:" + total);
    } catch (e) { }
    return true;
  } else if (res.status === 429) {
    scoreSuccessRate.add(0);
    console.warn(pfx + " 429 Score! Jeda 3s");
    sleep(3);
    return false;
  } else if (res.status === 409) {
    // Duplicate session - skip
    scoreSuccessRate.add(0);
    return false;
  } else {
    scoreSuccessRate.add(0);
    if (res.status !== 422) {
      console.warn(pfx + " Score fail HTTP " + res.status);
    }
    return false;
  }
}

// Flush semua pending session (tunggu masing-masing sampai matang)
function flushQueue(queue, url, hdrs, pfx) {
  while (queue.length > 0) {
    const session = queue.shift();
    const elapsed = (Date.now() - session.openedAt) / 1000;
    const wait = TARGET_DURATION - elapsed;
    if (wait > 0) sleep(wait);
    submitScore(session, url, hdrs, pfx);
    // Jeda kecil antar submit saat flush agar tidak burst
    if (queue.length > 0) sleep(REQUEST_STAGGER);
  }
}

// ==============================================================================
// Main: Pipeline Overlapping Sessions
// ==============================================================================
// Cara kerja:
//   Loop setiap 0.5s:
//     1. Buka 1 session baru (masuk antrean)
//     2. Cek antrean: submit semua yang usianya >= 7.8s
//     3. Sleep 0.5s
//
//   Setelah pipeline penuh (~16 session di antrean), setiap 0.5s:
//     - 1 session baru dibuka
//     - 1 session lama di-submit
//   = steady state ~2 games/detik = ~30-60 games/menit
//
//   Semua pakai 1 token reCAPTCHA yang sama selama ~2 menit.
// ==============================================================================
export default function () {
  const iterId = __ITER + 1;
  const pfx = "[P|#" + iterId + "]";

  let game = GAME_CHOICE;
  if (game === "all" || !AVAILABLE_GAMES.includes(game)) {
    game = AVAILABLE_GAMES[0];
  }

  const gameUrl = BASE_URL + "/games/" + game;
  const sessionUrl = BASE_URL + "/api/games/" + game + "/sessions";
  const scoreUrl = BASE_URL + "/api/games/" + game + "/scores";

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    Origin: BASE_URL,
    Referer: gameUrl,
  };

  // 1. Ambil token (cached, reuse 2+ menit)
  const recaptchaToken = obtainRecaptchaToken(pfx, false);
  if (!recaptchaToken) {
    sleep(5);
    return;
  }

  const sessionPayload = JSON.stringify({
    username: USERNAME,
    "g-recaptcha-response": recaptchaToken,
  });

  // 2. Pipeline loop selama token valid (~115s)
  const cycleStart = Date.now();
  const pendingSessions = [];
  let cycleWins = 0;
  let cycleTotal = 0;
  let cyclePoints = 0;
  let consecutive429 = 0;

  while (Date.now() - cycleStart < (TOKEN_LIFETIME_SEC - 10) * 1000) {

    // === A: BUKA 1 SESSION BARU ===
    if (consecutive429 < 3) {
      const openedAt = Date.now();
      const sessionRes = http.post(sessionUrl, sessionPayload, {
        headers: headers,
        tags: { name: "OpenSession" },
      });

      if (sessionRes.status === 200 || sessionRes.status === 201) {
        sessionSuccessRate.add(1);
        consecutive429 = 0;
        try {
          const json = sessionRes.json();
          if (json && json.token) {
            pendingSessions.push({ token: json.token, openedAt: openedAt });
          }
        } catch (e) { }
      } else if (sessionRes.status === 429) {
        sessionSuccessRate.add(0);
        consecutive429++;
        // Backoff progresif: 3s, 5s, 8s
        const backoff = consecutive429 <= 1 ? 3 : (consecutive429 <= 2 ? 5 : 8);
        console.warn(pfx + " 429 Session! (" + consecutive429 + "x) Jeda " + backoff + "s");
        sleep(backoff);
        // Tetap submit yang sudah matang
        drainReady(pendingSessions, scoreUrl, headers, pfx);
        continue;
      } else if (sessionRes.status === 422) {
        console.warn(pfx + " 422 Token expired -> flush & refresh");
        flushQueue(pendingSessions, scoreUrl, headers, pfx);
        obtainRecaptchaToken(pfx, true);
        break;
      } else {
        sessionSuccessRate.add(0);
      }
    } else {
      // Terlalu banyak 429 berturut - tunggu lebih lama, tapi tetap submit
      console.warn(pfx + " Banyak 429, pause open 10s, submit saja...");
      sleep(10);
      consecutive429 = 0;
    }

    // === B: SUBMIT SEMUA SESSION YANG SUDAH MATANG (>= 7.8s) ===
    drainReady(pendingSessions, scoreUrl, headers, pfx);

    // === C: JEDA STAGGER 0.5s ===
    sleep(REQUEST_STAGGER);

    // Cek token masih hidup
    const tokenAge = (Date.now() - _tokenObtainedAt) / 1000;
    if (tokenAge >= TOKEN_LIFETIME_SEC - 5) {
      console.log(pfx + " Token expiring (" + tokenAge.toFixed(0) + "s), flushing...");
      flushQueue(pendingSessions, scoreUrl, headers, pfx);
      break;
    }
  }

  // Flush sisa
  if (pendingSessions.length > 0) {
    flushQueue(pendingSessions, scoreUrl, headers, pfx);
  }

  // Cycle summary
  const elapsed = (Date.now() - cycleStart) / 1000;
  const gpm = cycleWins > 0 ? (cycleWins / elapsed * 60).toFixed(1) : "0";
  console.log(pfx + " Cycle done: " + cycleWins + " wins in " + elapsed.toFixed(0) + "s (" + gpm + " games/min) +" + cyclePoints + "pts");

  // Minimal gap sebelum next iteration
  sleep(0.3);

  // Helper: submit matang tanpa blocking
  function drainReady(queue, url, hdrs, px) {
    const now = Date.now();
    let idx = 0;
    while (idx < queue.length) {
      const age = (now - queue[idx].openedAt) / 1000;
      if (age >= TARGET_DURATION) {
        const session = queue.splice(idx, 1)[0];
        const ok = submitScore(session, url, hdrs, px);
        cycleTotal++;
        if (ok) {
          cycleWins++;
          // Ambil poin dari log terakhir (sudah di-add di submitScore)
        }
        // Jeda 0.5s antar submit juga
        if (queue.length > 0 && idx < queue.length) {
          const nextAge = (Date.now() - queue[idx].openedAt) / 1000;
          if (nextAge >= TARGET_DURATION) {
            sleep(REQUEST_STAGGER);
          }
        }
      } else {
        idx++;
      }
    }
  }
}

// ==============================================================================
// Leaderboard
// ==============================================================================
export function fetchLeaderboardStanding(username) {
  try {
    const res = http.get("https://kemerdekaan.liputan6.com/api/games/leaderboard", {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (res.status === 200) {
      const data = res.json();
      const board = data.board || [];
      const userRank = board.find(
        function(r) { return r.username && r.username.toLowerCase() === username.toLowerCase(); }
      );
      return {
        periodLabel: (data.period || {}).label || "Periode Aktif",
        userStanding: userRank || null,
        top3: board.slice(0, 3),
      };
    }
  } catch (e) { }
  return null;
}

export function handleSummary(data) {
  const games = data.metrics.games_played ? data.metrics.games_played.values.count : 0;
  const pts = data.metrics.points_earned ? data.metrics.points_earned.values.count : 0;
  const ssr = data.metrics.session_success_rate ? (data.metrics.session_success_rate.values.rate * 100).toFixed(1) : 0;
  const scr = data.metrics.score_success_rate ? (data.metrics.score_success_rate.values.rate * 100).toFixed(1) : 0;

  const standing = fetchLeaderboardStanding(USERNAME);
  if (standing && standing.userStanding) {
    const u = standing.userStanding;
    console.log("\nRank: #" + u.rank + " | Total: " + u.total_score + " | Plays: " + u.total_plays);
  }

  console.log("\n=============================================================");
  console.log("  HASIL AKHIR");
  console.log("  Games: " + games + " | Points: " + pts);
  console.log("  Session SR: " + ssr + "% | Score SR: " + scr + "%");
  console.log("=============================================================\n");

  return { stdout: "" };
}
