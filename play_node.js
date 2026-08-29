// ==============================================================================
// play_node.js — Node.js Pipeline (tanpa k6)
// Pakai 1 captcha token per 2+ menit dari daemon (localhost:9876/refresh)
// Request stagger 0.5s, target 30-40 games/menit via overlapping sessions
// ==============================================================================
// Run: node play_node.js
// ==============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==============================================================================
// Config loader
// ==============================================================================
function loadDotEnv() {
  const envObj = {};
  for (const file of [".env.api", ".env"]) {
    try {
      const raw = fs.readFileSync(path.join(__dirname, file), "utf-8");
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx <= 0) continue;
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        const ci = val.indexOf(" #");
        if (ci > 0) val = val.substring(0, ci).trim();
        val = val.replace(/^["']|["']$/g, "");
        if (!(key in envObj)) envObj[key] = val;
      }
    } catch {}
  }
  return envObj;
}

const ENV = loadDotEnv();
const env = (key, fallback = "") => process.env[key] || ENV[key] || fallback;

const BASE_URL = env("BASE_URL", "https://kemerdekaan.liputan6.com");
const USERNAME = env("MINIGAMES_USERNAME", "zildjiannesta");
const GAME_CHOICE = env("GAME_CHOICE", "tariktambang").toLowerCase();
const TIME_LEFT = parseInt(env("TIME_LEFT", "22"), 10);

// Stagger antar request (detik). 0.5s = ~120 HTTP calls/min (60 open + 60 submit)
// Kalau masih 429, naikkan ke 1.0 atau 1.5
const STAGGER_SEC = parseFloat(env("REQUEST_STAGGER_SEC", "0.5"));

// Durasi gameplay minimum (server enforce >= 7s, tier <10s = 50pts)
const TARGET_DUR = parseFloat(env("TARGET_DURATION_SEC", "7.8"));

// Token valid ~120s, kita pakai 125s biar aman > 2 menit
const TOKEN_LIFE = 125;

const GAMES = ["tariktambang", "panjatpinang", "balapkarung"];

// ==============================================================================
// HTTP helpers
// ==============================================================================
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

function makeHeaders() {
  const game = GAME_CHOICE === "all" ? GAMES[0] : GAME_CHOICE;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": UA,
    Origin: BASE_URL,
    Referer: `${BASE_URL}/games/${game}`,
  };
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
  return { status: res.status, body: await res.text() };
}

function sleep(sec) {
  return new Promise((r) => setTimeout(r, sec * 1000));
}

// ==============================================================================
// Token management — 1 token per 2+ menit dari daemon
// ==============================================================================
let cachedToken = "";
let tokenTime = 0;

async function getToken(force = false) {
  const age = (Date.now() - tokenTime) / 1000;

  if (!force && cachedToken && age < TOKEN_LIFE) {
    return cachedToken;
  }

  // Enforce minimum 2 menit antar refresh
  if (force && tokenTime > 0 && age < TOKEN_LIFE) {
    const wait = TOKEN_LIFE - age + 1;
    console.log(`  ⏳ Tunggu ${wait.toFixed(0)}s sebelum refresh (min 2+ min)...`);
    await sleep(wait);
  }

  const reason = force ? "rejected" : cachedToken ? "expired" : "new";
  console.log(`  🔄 Token (${reason})...`);

  try {
    // Di Windows lokal kita pakai 127.0.0.1, di VPS biarkan pakai captcha-solver
    const url = force
      ? "http://127.0.0.1:9876/refresh?force=true"
      : "http://127.0.0.1:9876/refresh";
    const res = await fetchJson(url);
    if (res.status === 200) {
      const json = JSON.parse(res.body);
      if (json && json.token) {
        cachedToken = json.token;
        tokenTime = Date.now();
        console.log(`  ✅ Token OK (${cachedToken.substring(0, 20)}...)`);
        return cachedToken;
      }
    } else if (res.status === 503) {
      console.warn("  ⛔ Google Cooldown aktif, tunggu...");
      await sleep(30);
    }
  } catch (e) {
    console.warn("  ⚠️ Daemon error:", e.message);
  }
  return "";
}

// ==============================================================================
// Score submit
// ==============================================================================
async function submitScore(sessionToken, openedAt, game, headers) {
  const dur = (Date.now() - openedAt) / 1000;
  const url = `${BASE_URL}/api/games/${game}/scores`;
  try {
    const res = await fetchJson(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ token: sessionToken, is_win: true, time_left: TIME_LEFT }),
    });

    if (res.status === 200 || res.status === 201) {
      try {
        const json = JSON.parse(res.body);
        const pts = json?.score?.points || 0;
        const rank = json?.standing?.rank ? `#${json.standing.rank}` : "-";
        const total = json?.standing?.total_score || "-";
        console.log(`  ✅ +${pts}pts | Dur:${dur.toFixed(1)}s | Rank:${rank} Total:${total}`);
        return pts;
      } catch { return 0; }
    } else if (res.status === 429) {
      console.warn(`  ⛔ 429 Score! Jeda 5s`);
      await sleep(5);
      return -1; // Signal rate limit
    } else if (res.status === 409) {
      // Duplicate, skip
      return -2;
    } else {
      console.warn(`  ❌ Score HTTP ${res.status}: ${res.body.substring(0, 100)}`);
      return -3;
    }
  } catch (e) {
    console.warn(`  ❌ Score error: ${e.message}`);
    return -3;
  }
}

// ==============================================================================
// Main pipeline loop
// ==============================================================================
async function main() {
  const game = GAME_CHOICE === "all" ? GAMES[0] : GAME_CHOICE;
  const sessionUrl = `${BASE_URL}/api/games/${game}/sessions`;
  const headers = makeHeaders();

  console.log("=============================================================");
  console.log(`  PLAY_NODE.JS — Pipeline Mode`);
  console.log(`  Game: ${game} | User: ${USERNAME}`);
  console.log(`  Stagger: ${STAGGER_SEC}s | Target: ${TARGET_DUR}s | TokenLife: ${TOKEN_LIFE}s`);
  console.log("=============================================================\n");

  let totalWins = 0;
  let totalPts = 0;
  let cycleNum = 0;

  // Loop forever (Ctrl+C to stop)
  while (true) {
    cycleNum++;
    console.log(`\n--- Cycle ${cycleNum} ---`);

    // 1. Ambil token
    const token = await getToken(false);
    if (!token) {
      console.warn("  Token gagal, retry 10s...");
      await sleep(10);
      continue;
    }

    const payload = JSON.stringify({
      username: USERNAME,
      "g-recaptcha-response": token,
    });

    // 2. Pipeline loop selama token valid
    const cycleStart = Date.now();
    const pending = []; // { token, openedAt }
    let cycleWins = 0;
    let cyclePts = 0;
    let consecutive429 = 0;

    while ((Date.now() - cycleStart) < (TOKEN_LIFE - 10) * 1000) {
      // A: Open 1 session
      if (consecutive429 < 3) {
        try {
          const openedAt = Date.now();
          const res = await fetchJson(sessionUrl, {
            method: "POST",
            headers,
            body: payload,
          });

          if (res.status === 200 || res.status === 201) {
            consecutive429 = 0;
            try {
              const json = JSON.parse(res.body);
              if (json && json.token) {
                pending.push({ token: json.token, openedAt });
              }
            } catch {}
          } else if (res.status === 429) {
            consecutive429++;
            const backoff = consecutive429 <= 1 ? 3 : consecutive429 <= 2 ? 5 : 8;
            console.warn(`  ⛔ 429 Session (${consecutive429}x)! Jeda ${backoff}s`);
            await sleep(backoff);
            // Tetap submit yang sudah matang
            await drainReady(pending, game, headers);
            continue;
          } else if (res.status === 422) {
            console.warn("  ⚠️ 422 Token rejected -> flush & refresh");
            await flushAll(pending, game, headers);
            await getToken(true);
            break;
          }
        } catch (e) {
          console.warn(`  Session error: ${e.message}`);
        }
      } else {
        // Terlalu banyak 429, pause buka session, submit saja
        console.warn("  Banyak 429, pause open 10s...");
        await sleep(10);
        consecutive429 = 0;
      }

      // B: Submit semua yang sudah matang
      const result = await drainReady(pending, game, headers);
      cycleWins += result.wins;
      cyclePts += result.pts;

      // C: Dynamic Stagger (Auto-adjust speed based on server lag)
      const expectedQueue = Math.ceil(TARGET_DUR / STAGGER_SEC);
      let currentStagger = STAGGER_SEC;
      
      if (pending.length > expectedQueue * 1.5) {
        currentStagger = STAGGER_SEC * 4; // Server sangat lemot, rem mendadak
        console.warn(`  🐌 Auto-Stagger: Antrean panjang (${pending.length}), melambat ke ${currentStagger}s`);
      } else if (pending.length > expectedQueue * 1.2) {
        currentStagger = STAGGER_SEC * 2; // Server mulai kewalahan, pelankan
      }
      
      await sleep(currentStagger);

      // Cek token expiry
      const tokenAge = (Date.now() - tokenTime) / 1000;
      if (tokenAge >= TOKEN_LIFE - 5) {
        console.log(`  Token expiring (${tokenAge.toFixed(0)}s), flushing...`);
        const flushResult = await flushAll(pending, game, headers);
        cycleWins += flushResult.wins;
        cyclePts += flushResult.pts;
        break;
      }
    }

    // Flush sisa
    if (pending.length > 0) {
      const flushResult = await flushAll(pending, game, headers);
      cycleWins += flushResult.wins;
      cyclePts += flushResult.pts;
    }

    totalWins += cycleWins;
    totalPts += cyclePts;

    const elapsed = (Date.now() - cycleStart) / 1000;
    const gpm = cycleWins > 0 ? (cycleWins / elapsed * 60).toFixed(1) : "0";
    console.log(`  🏁 Cycle ${cycleNum}: ${cycleWins} wins in ${elapsed.toFixed(0)}s (${gpm}/min) +${cyclePts}pts | Total: ${totalWins} wins, ${totalPts}pts`);

    // Minimal gap sebelum cycle berikutnya
    await sleep(0.5);
  }

  // Submit matang dari queue (non-blocking)
  async function drainReady(queue, gameName, hdrs) {
    let wins = 0;
    let pts = 0;
    const now = Date.now();
    let i = 0;
    while (i < queue.length) {
      const age = (now - queue[i].openedAt) / 1000;
      if (age >= TARGET_DUR) {
        const session = queue.splice(i, 1)[0];
        const result = await submitScore(session.token, session.openedAt, gameName, hdrs);
        if (result > 0) { wins++; pts += result; }
        if (result === -1) break; // Rate limited, stop draining
      } else {
        i++;
      }
    }
    return { wins, pts };
  }

  // Flush semua, tunggu masing-masing matang
  async function flushAll(queue, gameName, hdrs) {
    let wins = 0;
    let pts = 0;
    while (queue.length > 0) {
      const session = queue.shift();
      const elapsed = (Date.now() - session.openedAt) / 1000;
      const wait = TARGET_DUR - elapsed;
      if (wait > 0) await sleep(wait);
      const result = await submitScore(session.token, session.openedAt, gameName, hdrs);
      if (result > 0) { wins++; pts += result; }
      // Stagger antar submit saat flush
      if (queue.length > 0) await sleep(STAGGER_SEC);
    }
    return { wins, pts };
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
