// ==============================================================================
// 🚀 Optimized Mini Games Automation - Advanced Rate Limiting & Token Utilization
// ==============================================================================
import http from "k6/http";
import { sleep } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

// Custom metrics
const gamesPlayed = new Counter("games_played");
const gamesWon = new Counter("games_won");
const totalPoints = new Counter("total_points");
const sessionSuccessRate = new Rate("session_success_rate");
const scoreSuccessRate = new Rate("score_success_rate");
const sessionDuration = new Trend("session_duration");
const scoreSubmitDuration = new Trend("score_submit_duration");
const adaptiveBatchSize = new Trend("adaptive_batch_size");
const tokenUtilization = new Rate("token_utilization_rate");

// Environment variables loader
function loadDotEnv() {
  const envObj = {};
  const filesToTry = [".env", "../.env"];
  for (const envPath of filesToTry) {
    try {
      const raw = open(envPath);
      const lines = raw.split("\n");
      for (const line of lines) {
        if (!line || line.trim().startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx < 0) continue;
        const key = line.substring(0, eqIdx).trim();
        const val = line.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        envObj[key] = val;
      }
      break;
    } catch { }
  }
  return envObj;
}

const DOT_ENV = loadDotEnv();
const getEnv = (key, fallback = "") => DOT_ENV[key] || __ENV[key] || fallback;

const BASE_URL = getEnv("API_BASE_URL", "https://minigames.liputan6.com");
const USERNAME = getEnv("MINIGAMES_USERNAME", "zildjiannesta");
const GAME_CHOICE = getEnv("GAME_CHOICE", "tariktambang");
const TIME_LEFT = parseInt(getEnv("TIME_LEFT", "22"), 10);

// 🔥 ADAPTIVE CONFIGURATION
const INITIAL_BATCH_SIZE = parseInt(getEnv("INITIAL_BATCH_SIZE", "8"), 10); // Start aggressively
const MIN_BATCH_SIZE = parseInt(getEnv("MIN_BATCH_SIZE", "2"), 10);
const MAX_BATCH_SIZE = parseInt(getEnv("MAX_BATCH_SIZE", "12"), 10);
const TARGET_SUCCESS_RATE = parseFloat(getEnv("TARGET_SUCCESS_RATE", "0.75")); // 75% success target
const AGGRESSIVE_MODE = getEnv("AGGRESSIVE_MODE", "true").toLowerCase() === "true";

const VUS = parseInt(getEnv("VUS", "1"), 10);
const LOOP_COUNT = parseInt(getEnv("LOOP_COUNT", "9999"), 10);
const TOKEN_LIFETIME_SEC = 115; // Use 115s to be safe (token valid 120s)

const GAMEPLAY_DELAY = parseFloat(getEnv("GAMEPLAY_DURATION_SEC", "7.5"));
const MIN_ROUND_DELAY = parseFloat(getEnv("MIN_ROUND_DELAY_SEC", "1.0"));
const MAX_ROUND_DELAY = parseFloat(getEnv("MAX_ROUND_DELAY_SEC", "3.0"));

const AVAILABLE_GAMES = ["tariktambang", "panjatpinang", "balapkarung"];

const options = {
  scenarios: {
    minigames_automation: {
      executor: "per-vu-iterations",
      vus: VUS,
      iterations: LOOP_COUNT,
      maxDuration: "24h",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.3"],
    session_success_rate: ["rate>0.6"],
  },
};

// ==============================================================================
// Token Management
// ==============================================================================
let _cachedToken = "";
let _tokenObtainedAt = 0;
let _tokenUsageCount = 0;
let _tokenSuccessCount = 0;

function refreshRecaptchaToken(prefix = "", forceRefresh = false) {
  try {
    const url = forceRefresh 
      ? "http://127.0.0.1:9876/refresh?force=true" 
      : "http://127.0.0.1:9876/refresh";
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
    console.warn(`${prefix} ⚠️ Token Sync error: ${e.message}`);
  }
  return "";
}

function obtainRecaptchaToken(prefix, forceRefresh = false) {
  const now = Date.now();
  const tokenAge = (now - _tokenObtainedAt) / 1000;

  if (!forceRefresh && _cachedToken && _tokenObtainedAt > 0 && tokenAge < TOKEN_LIFETIME_SEC) {
    return _cachedToken;
  }

  // Log token stats before refreshing
  if (_tokenUsageCount > 0) {
    const tokenSuccessRate = (_tokenSuccessCount / _tokenUsageCount * 100).toFixed(1);
    console.log(`${prefix} 📊 Token stats: ${_tokenSuccessCount}/${_tokenUsageCount} sukses (${tokenSuccessRate}%), usia: ${tokenAge.toFixed(0)}s`);
  }

  const reason = forceRefresh ? "rejected" : (_cachedToken ? "expired" : "new");
  console.log(`${prefix} 🔄 Refreshing token (${reason})...`);

  const newToken = refreshRecaptchaToken(prefix, forceRefresh);
  if (newToken) {
    _cachedToken = newToken;
    _tokenObtainedAt = Date.now();
    _tokenUsageCount = 0;
    _tokenSuccessCount = 0;
    console.log(`${prefix} ✅ Token OK (Lifetime: ${TOKEN_LIFETIME_SEC}s)`);
  } else {
    console.warn(`${prefix} ❌ Token gagal`);
  }
  return newToken || "";
}

// ==============================================================================
// Adaptive Rate Controller
// ==============================================================================
class AdaptiveRateController {
  constructor(initialBatchSize, minBatch, maxBatch, targetSuccessRate) {
    this.batchSize = initialBatchSize;
    this.minBatch = minBatch;
    this.maxBatch = maxBatch;
    this.targetSuccessRate = targetSuccessRate;
    
    // Success tracking with sliding window
    this.recentResults = [];
    this.maxHistorySize = 20;
    
    // Rate limiting state
    this.consecutiveErrors = 0;
    this.consecutiveSuccess = 0;
    this.lastErrorTime = 0;
    this.errorCooldown = 0;
    
    // Performance metrics
    this.totalRequests = 0;
    this.totalSuccess = 0;
  }

  recordResult(success, statusCode) {
    this.recentResults.push({ success, statusCode, timestamp: Date.now() });
    if (this.recentResults.length > this.maxHistorySize) {
      this.recentResults.shift();
    }

    this.totalRequests++;
    if (success) {
      this.totalSuccess++;
      this.consecutiveSuccess++;
      this.consecutiveErrors = 0;
    } else {
      this.consecutiveErrors++;
      this.consecutiveSuccess = 0;
      
      if (statusCode === 429 || statusCode === 500) {
        this.lastErrorTime = Date.now();
        this.errorCooldown = Math.min(this.errorCooldown + 2, 15); // Max 15s cooldown
      }
    }
  }

  getSuccessRate() {
    if (this.recentResults.length === 0) return 1.0;
    const successCount = this.recentResults.filter(r => r.success).length;
    return successCount / this.recentResults.length;
  }

  shouldThrottle() {
    const now = Date.now();
    if (this.errorCooldown > 0 && now - this.lastErrorTime < this.errorCooldown * 1000) {
      return true;
    }
    return false;
  }

  getRecommendedDelay() {
    if (this.shouldThrottle()) {
      const elapsed = (Date.now() - this.lastErrorTime) / 1000;
      const remaining = this.errorCooldown - elapsed;
      return Math.max(0, remaining);
    }
    
    const successRate = this.getSuccessRate();
    
    // Dynamic delay based on success rate
    if (successRate >= 0.9) {
      return MIN_ROUND_DELAY + Math.random() * 0.5; // Very short delay when doing great
    } else if (successRate >= 0.75) {
      return MIN_ROUND_DELAY + Math.random() * 1.0; // Normal delay
    } else if (successRate >= 0.5) {
      return MIN_ROUND_DELAY + Math.random() * 2.0; // Slightly longer
    } else {
      return MIN_ROUND_DELAY + Math.random() * 3.0; // Much longer when struggling
    }
  }

  adjustBatchSize() {
    const successRate = this.getSuccessRate();
    
    // Aggressive increase when performing well
    if (this.consecutiveSuccess >= 3 && successRate >= this.targetSuccessRate) {
      this.batchSize = Math.min(this.batchSize + 2, this.maxBatch);
      this.consecutiveSuccess = 0; // Reset to prevent runaway growth
      this.errorCooldown = Math.max(0, this.errorCooldown - 1); // Reduce cooldown
      return;
    }

    // Moderate increase
    if (this.consecutiveSuccess >= 2 && successRate >= this.targetSuccessRate * 0.9) {
      this.batchSize = Math.min(this.batchSize + 1, this.maxBatch);
      this.errorCooldown = Math.max(0, this.errorCooldown - 0.5);
      return;
    }

    // Aggressive decrease on errors
    if (this.consecutiveErrors >= 2) {
      this.batchSize = Math.max(Math.floor(this.batchSize * 0.6), this.minBatch);
      return;
    }

    // Gentle decrease if success rate is below target
    if (successRate < this.targetSuccessRate && this.recentResults.length >= 10) {
      this.batchSize = Math.max(this.batchSize - 1, this.minBatch);
    }
  }

  getBatchSize() {
    return Math.max(this.minBatch, Math.min(this.batchSize, this.maxBatch));
  }

  getStats() {
    const successRate = this.totalRequests > 0 
      ? (this.totalSuccess / this.totalRequests * 100).toFixed(1) 
      : "0.0";
    const recentRate = (this.getSuccessRate() * 100).toFixed(1);
    
    return {
      batchSize: this.batchSize,
      successRate,
      recentRate,
      cooldown: this.errorCooldown,
      totalRequests: this.totalRequests,
      totalSuccess: this.totalSuccess,
    };
  }

  reset() {
    this.consecutiveErrors = 0;
    this.consecutiveSuccess = 0;
  }
}

// ==============================================================================
// Main Scenario with Adaptive Rate Control
// ==============================================================================

// Global rate controllers per VU (persists across iterations)
const vuControllers = {};

export default function (data) {
  const vuId = __VU;
  const iterId = __ITER + 1;

  // Stagger VU start times
  if (iterId === 1 && vuId > 1) {
    sleep(vuId * 2);
  }

  // Initialize rate controller (per VU) - use global object
  if (!vuControllers[vuId]) {
    vuControllers[vuId] = new AdaptiveRateController(
      INITIAL_BATCH_SIZE,
      MIN_BATCH_SIZE,
      MAX_BATCH_SIZE,
      TARGET_SUCCESS_RATE
    );
  }
  const controller = vuControllers[vuId];

  let game = GAME_CHOICE;
  if (game === "all" || !AVAILABLE_GAMES.includes(game)) {
    game = AVAILABLE_GAMES[(vuId - 1) % AVAILABLE_GAMES.length];
  }
  
  const gameUrl = `${BASE_URL}/games/${game}`;
  const prefix = `[VU${vuId}|#${iterId}]`;

  // 1. Obtain reCAPTCHA token (cached)
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
  let roundsThisCycle = 0;
  let successThisCycle = 0;

  // 2. Maximize token utilization within its lifetime
  while (Date.now() - cycleStart < TOKEN_LIFETIME_SEC * 1000) {
    // Check if we should throttle
    if (controller.shouldThrottle()) {
      const throttleDelay = controller.getRecommendedDelay();
      if (throttleDelay > 0) {
        console.warn(`${prefix} 🛑 Throttling for ${throttleDelay.toFixed(1)}s...`);
        sleep(throttleDelay);
        continue;
      }
    }

    // Adjust batch size based on recent performance
    controller.adjustBatchSize();
    const currentBatchSize = controller.getBatchSize();
    adaptiveBatchSize.add(currentBatchSize);

    // 3. Open Session (Adaptive Batch)
    const sessionReqs = [];
    for (let i = 0; i < currentBatchSize; i++) {
      sessionReqs.push([
        "POST",
        sessionUrl,
        sessionPayload,
        { headers, tags: { name: "OpenSession" } },
      ]);
    }

    const sessionStartTime = Date.now();
    const sessionResponses = http.batch(sessionReqs);
    sessionDuration.add(Date.now() - sessionStartTime);

    const validSessionTokens = [];
    let has429 = false;
    let has500 = false;
    let allExpired = true;
    let batchSuccess = 0;

    for (const res of sessionResponses) {
      _tokenUsageCount++;
      
      if (res.status === 200 || res.status === 201) {
        allExpired = false;
        sessionSuccessRate.add(1);
        controller.recordResult(true, res.status);
        batchSuccess++;
        _tokenSuccessCount++;
        
        try {
          const json = res.json();
          if (json && json.token) {
            validSessionTokens.push(json.token);
          }
        } catch (e) {
          console.error(`${prefix} ⚠️ Failed to parse session response: ${e.message}`);
        }
      } else if (res.status === 429) {
        has429 = true;
        allExpired = false;
        sessionSuccessRate.add(0);
        controller.recordResult(false, 429);
      } else if (res.status === 500) {
        has500 = true;
        allExpired = false;
        sessionSuccessRate.add(0);
        controller.recordResult(false, 500);
      } else if (res.status !== 422) {
        allExpired = false;
        sessionSuccessRate.add(0);
        controller.recordResult(false, res.status);
      }
    }

    // 4. Handle errors intelligently
    if (validSessionTokens.length === 0) {
      if (has429) {
        console.warn(`${prefix} ⛔ 429 Rate Limit! Batch: ${currentBatchSize} → Reducing...`);
        const backoff = 8 + Math.random() * 7; // 8-15s backoff
        sleep(backoff);
        continue;
      } else if (has500) {
        console.warn(`${prefix} ⚠️ 500 Server Error! Batch: ${currentBatchSize} → Pausing...`);
        const backoff = 5 + Math.random() * 5; // 5-10s backoff
        sleep(backoff);
        continue;
      } else if (allExpired) {
        console.warn(`${prefix} ⚠️ 422 Token expired → Force refresh...`);
        obtainRecaptchaToken(prefix, true);
        break; // Exit cycle to get new token
      } else {
        sleep(3);
        continue;
      }
    }

    // Log success rate for this batch
    const batchSuccessRate = (batchSuccess / currentBatchSize * 100).toFixed(0);
    tokenUtilization.add(batchSuccess > 0 ? 1 : 0);

    // 5. Gameplay Delay
    sleep(GAMEPLAY_DELAY);

    // 6. Submit Score (Batch)
    const scoreReqs = validSessionTokens.map(sessionToken => {
      return [
        "POST",
        scoreUrl,
        JSON.stringify({
          token: sessionToken,
          is_win: true,
          time_left: TIME_LEFT,
        }),
        { headers, tags: { name: "SubmitScore" } },
      ];
    });

    const scoreStartTime = Date.now();
    const scoreResponses = http.batch(scoreReqs);
    scoreSubmitDuration.add(Date.now() - scoreStartTime);

    let scoreSuccess = 0;
    let scoreRateLimited = false;
    let lastScoreJson = null;

    for (const res of scoreResponses) {
      if (res.status === 200 || res.status === 201) {
        scoreSuccessRate.add(1);
        scoreSuccess++;
        gamesPlayed.add(1);
        gamesWon.add(1);
        successThisCycle++;
        
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
        // Race condition - not an error, just duplicate
        scoreSuccessRate.add(0);
      } else if (res.status === 500) {
        scoreSuccessRate.add(0);
      } else if (res.status !== 422) {
        scoreSuccessRate.add(0);
      }
    }

    roundsThisCycle++;

    // 7. Display results
    if (scoreSuccess > 0 && lastScoreJson) {
      const totalBatchPoints = (lastScoreJson.score?.points || 0) * scoreSuccess;
      const standing = lastScoreJson.standing || {};
      const rank = standing.rank ? `#${standing.rank}` : "-";
      const totalScore = standing.total_score || "-";
      const stats = controller.getStats();
      
      console.log(
        `${prefix} ✅ +${totalBatchPoints}pts | ` +
        `Batch: ${scoreSuccess}/${validSessionTokens.length} (${batchSuccessRate}%) | ` +
        `Size: ${currentBatchSize} | ` +
        `SR: ${stats.recentRate}% | ` +
        `Rank: ${rank} | Total: ${totalScore}`
      );
    } else if (scoreSuccess === 0) {
      const stats = controller.getStats();
      console.warn(
        `${prefix} ❌ No scores | ` +
        `Batch: ${currentBatchSize} | ` +
        `SR: ${stats.recentRate}% | ` +
        `Cooldown: ${stats.cooldown}s`
      );
    }

    // 8. Handle rate limiting on score submission
    if (scoreRateLimited) {
      const backoff = 8 + Math.random() * 7;
      console.warn(`${prefix} ⛔ 429 Rate limit on scores! Pausing ${backoff.toFixed(1)}s`);
      sleep(backoff);
    } else {
      // Adaptive delay based on performance
      const delay = controller.getRecommendedDelay();
      sleep(delay);
    }

    // 9. Check if we're running out of time
    const elapsed = (Date.now() - cycleStart) / 1000;
    const remaining = TOKEN_LIFETIME_SEC - elapsed;
    if (remaining < 15) {
      // Less than 15s remaining, prepare for next token
      console.log(`${prefix} ⏱️ Token expiring soon (${remaining.toFixed(0)}s left), completing cycle...`);
      break;
    }
  }

  // Cycle summary
  const cycleElapsed = (Date.now() - cycleStart) / 1000;
  const stats = controller.getStats();
  console.log(
    `${prefix} 🏁 Cycle complete: ${successThisCycle} wins in ${roundsThisCycle} rounds (${cycleElapsed.toFixed(0)}s) | ` +
    `Overall SR: ${stats.successRate}% | ` +
    `Requests: ${stats.totalSuccess}/${stats.totalRequests}`
  );

  // Small delay before next iteration
  sleep(1 + Math.random());
}

export function setup() {
  console.log("🚀 Starting Optimized Mini Games Automation with Adaptive Rate Control");
  console.log(`📊 Config: Initial Batch=${INITIAL_BATCH_SIZE}, Min=${MIN_BATCH_SIZE}, Max=${MAX_BATCH_SIZE}`);
  console.log(`🎯 Target Success Rate: ${(TARGET_SUCCESS_RATE * 100).toFixed(0)}%`);
  console.log(`⚡ Aggressive Mode: ${AGGRESSIVE_MODE ? "ON" : "OFF"}`);
  
  // No need to return data, controllers are stored globally per VU
  return {};
}

export function handleSummary(data) {
  const totalRounds = data.metrics.games_played?.values?.count || 0;
  const totalPts = data.metrics.total_points?.values?.count || 0;
  const sessSuccess = ((data.metrics.session_success_rate?.values?.rate || 0) * 100).toFixed(1);
  const scoreSuccess = ((data.metrics.score_success_rate?.values?.rate || 0) * 100).toFixed(1);
  const avgBatch = data.metrics.adaptive_batch_size?.values?.avg?.toFixed(1) || "N/A";
  const tokenUtil = ((data.metrics.token_utilization_rate?.values?.rate || 0) * 100).toFixed(1);

  console.log("\n" + "=".repeat(80));
  console.log("🏆 OPTIMIZED AUTOMATION - FINAL SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total Games Played: ${totalRounds}`);
  console.log(`Total Points Earned: ${totalPts}`);
  console.log(`Session Success Rate: ${sessSuccess}%`);
  console.log(`Score Submit Success Rate: ${scoreSuccess}%`);
  console.log(`Average Batch Size: ${avgBatch}`);
  console.log(`Token Utilization: ${tokenUtil}%`);
  console.log("=".repeat(80) + "\n");

  return {
    stdout: "",
  };
}
