import { browser } from "k6/browser";
import http from "k6/http";
import { check, sleep } from "k6";

// ==============================================================================
// Automatic .env Loader & Configuration
// ==============================================================================
function loadDotEnv() {
  const envObj = {};
  const filesToTry = ["./.env.browser", "./.env"];
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
    } catch (e) {}
  }
  return envObj;
}

const DOT_ENV = loadDotEnv();
const getEnv = (key, fallback = "") => __ENV[key] || DOT_ENV[key] || fallback;

const BASE_URL = getEnv("BASE_URL", "https://kemerdekaan.liputan6.com");
const USERNAME = getEnv("MINIGAMES_USERNAME", "kbrnugroho");
const GAME_CHOICE = getEnv("GAME_CHOICE", "all").toLowerCase();
const VUS = parseInt(getEnv("VUS", "3"), 10);
const LOOP_COUNT = parseInt(getEnv("LOOP_COUNT", "100"), 10);
const ROUND_DELAY_SEC = parseFloat(getEnv("ROUND_DELAY_SEC", "3"));

// Headless configuration (default: true)
const IS_HEADLESS = getEnv("HEADLESS", "true").toLowerCase() !== "false";
// Solver Mode ("auto", "audio", "image")
const CAPTCHA_MODE = getEnv("CAPTCHA_MODE", "auto");
const CAPSOLVER_KEY = getEnv("CAPSOLVER_API_KEY", "");
const TWOCAPTCHA_KEY = getEnv("TWOCAPTCHA_API_KEY", "");
const RECAPTCHA_SITEKEY = getEnv("RECAPTCHA_SITEKEY", "6Ld_e78qAAAAAF1Uwh807r9U5E9w1lWbQvE9k7N2");

// Audio STT API Tokens
const WITAI_TOKEN = getEnv("WITAI_ACCESS_TOKEN", "");
const OPENAI_KEY = getEnv("OPENAI_API_KEY", "");
const HF_KEY = getEnv("HF_API_KEY", "");

const AVAILABLE_GAMES = ["tariktambang", "panjatpinang", "balapkarung"];

export const options = {
  scenarios: {
    browser_games_concurrent: {
      executor: "per-vu-iterations",
      vus: VUS, // 3 VU untuk 3 game serentak bersamaan
      iterations: LOOP_COUNT, // 100 ronde per game
      maxDuration: "12h",
      options: {
        browser: {
          type: "chromium",
          headless: IS_HEADLESS,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--disable-infobars",
            "--window-size=1280,800",
          ],
        },
      },
    },
  },
};

// ==============================================================================
// Helper: Transcribe Audio URL to Text (Speech-to-Text)
// ==============================================================================
function transcribeAudioUrl(audioUrl, prefix = "") {
  console.log(`${prefix} [Audio Solver] Mengunduh file audio reCAPTCHA...`);

  // 1. Download file audio (mp3/wav)
  const audioRes = http.get(audioUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    },
    responseType: "binary",
  });

  if (audioRes.status !== 200 || !audioRes.body) {
    console.error(`${prefix} [Audio Solver] Gagal mengunduh audio: HTTP ${audioRes.status}`);
    return "";
  }

  const audioBytes = audioRes.body;

  // 2. Transcribe via OpenAI Whisper jika API key tersedia
  if (OPENAI_KEY) {
    try {
      console.log(`${prefix} [Audio Solver] Melakukan transkripsi via OpenAI Whisper...`);
      const whisperRes = http.post(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          file: http.file(audioBytes, "audio.mp3", "audio/mpeg"),
          model: "whisper-1",
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
          },
        }
      );

      if (whisperRes.status === 200) {
        const json = whisperRes.json();
        if (json && json.text) {
          console.log(`${prefix} [Audio Solver] Hasil transkripsi (OpenAI): "${json.text}"`);
          return json.text.trim();
        }
      }
    } catch (err) {
      console.warn(`${prefix} [Audio Solver] OpenAI Whisper error:`, err);
    }
  }

  // 3. Transcribe via HuggingFace Whisper jika API key tersedia
  if (HF_KEY) {
    try {
      console.log(`${prefix} [Audio Solver] Melakukan transkripsi via HuggingFace Whisper...`);
      const hfRes = http.post(
        "https://api-inference.huggingface.co/models/openai/whisper-base",
        audioBytes,
        {
          headers: {
            Authorization: `Bearer ${HF_KEY}`,
            "Content-Type": "audio/mpeg",
          },
        }
      );

      if (hfRes.status === 200) {
        const json = hfRes.json();
        if (json && json.text) {
          console.log(`${prefix} [Audio Solver] Hasil transkripsi (HF): "${json.text}"`);
          return json.text.trim();
        }
      }
    } catch (err) {
      console.warn(`${prefix} [Audio Solver] HuggingFace Whisper error:`, err);
    }
  }

  // 4. Transcribe via Wit.ai Speech API
  if (WITAI_TOKEN) {
    try {
      console.log(`${prefix} [Audio Solver] Melakukan transkripsi via Wit.ai (Token: ${WITAI_TOKEN.substring(0, 6)}...)...`);
      const witRes = http.post(
        "https://api.wit.ai/speech?v=20230215",
        audioBytes,
        {
          headers: {
            Authorization: `Bearer ${WITAI_TOKEN}`,
            "Content-Type": "audio/mpeg",
          },
        }
      );

      if (witRes.status === 200) {
        const bodyStr = witRes.body || "";
        let recognizedText = "";

        // Ekstrak nilai text menggunakan regex dari response JSON stream Wit.ai
        const textMatches = bodyStr.match(/"text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g);
        if (textMatches && textMatches.length > 0) {
          for (let i = textMatches.length - 1; i >= 0; i--) {
            const m = textMatches[i].match(/"text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
            if (m && m[1] && m[1].trim()) {
              recognizedText = m[1].trim();
              break;
            }
          }
        }

        if (recognizedText && recognizedText.trim()) {
          console.log(`${prefix} [Audio Solver] 🎯 Hasil transkripsi (Wit.ai): "${recognizedText.trim()}"`);
          return recognizedText.trim();
        } else {
          console.log(`${prefix} [Audio Solver] Wit.ai respon 200 OK (body: ${bodyStr.substring(0, 150)}...)`);
        }
      } else {
        console.warn(`${prefix} [Audio Solver] Wit.ai status: ${witRes.status} body: ${witRes.body ? witRes.body.substring(0, 100) : ''}`);
      }
    } catch (err) {
      console.warn(`${prefix} [Audio Solver] Wit.ai error:`, err);
    }
  }

  if (!WITAI_TOKEN && !OPENAI_KEY && !HF_KEY) {
    console.warn(`${prefix} [Audio Solver] ⚠️ Tidak ada WITAI_ACCESS_TOKEN atau OPENAI_API_KEY terdeteksi di .env!`);
  }

  return "";
}

// ==============================================================================
// Helper: Solve Image Challenge / Cloud Resolver via CapSolver / 2Captcha API
// ==============================================================================
function solveImageCaptchaViaApi(sitekey, pageUrl, prefix = "") {
  if (CAPSOLVER_KEY) {
    console.log(`${prefix} [Image Solver] Meminta solusi reCAPTCHA via CapSolver API...`);
    try {
      const createRes = http.post(
        "https://api.capsolver.com/createTask",
        JSON.stringify({
          clientKey: CAPSOLVER_KEY,
          task: {
            type: "ReCaptchaV2TaskProxyless",
            websiteURL: pageUrl,
            websiteKey: sitekey,
          },
        }),
        { headers: { "Content-Type": "application/json" } }
      );
      if (createRes.status === 200) {
        const json = createRes.json();
        const taskId = json.taskId;
        if (taskId) {
          for (let i = 0; i < 20; i++) {
            sleep(3);
            const res = http.post(
              "https://api.capsolver.com/getTaskResult",
              JSON.stringify({ clientKey: CAPSOLVER_KEY, taskId }),
              { headers: { "Content-Type": "application/json" } }
            );
            if (res.status === 200) {
              const resJson = res.json();
              if (resJson.status === "ready" && resJson.solution && resJson.solution.gRecaptchaResponse) {
                console.log(`${prefix} [Image Solver] 🎯 CapSolver berhasil menyelesaikan reCAPTCHA!`);
                return resJson.solution.gRecaptchaResponse;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`${prefix} [Image Solver] CapSolver error:`, e.message || e);
    }
  }

  if (TWOCAPTCHA_KEY) {
    console.log(`${prefix} [Image Solver] Meminta solusi reCAPTCHA via 2Captcha API...`);
    try {
      const inRes = http.get(`https://2captcha.com/in.php?key=${TWOCAPTCHA_KEY}&method=userrecaptcha&googlekey=${sitekey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`);
      if (inRes.status === 200) {
        const inJson = inRes.json();
        if (inJson.status === 1 && inJson.request) {
          const reqId = inJson.request;
          for (let i = 0; i < 20; i++) {
            sleep(4);
            const res = http.get(`https://2captcha.com/res.php?key=${TWOCAPTCHA_KEY}&action=get&id=${reqId}&json=1`);
            if (res.status === 200) {
              const resJson = res.json();
              if (resJson.status === 1 && resJson.request) {
                console.log(`${prefix} [Image Solver] 🎯 2Captcha berhasil menyelesaikan reCAPTCHA!`);
                return resJson.request;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn(`${prefix} [Image Solver] 2Captcha error:`, e.message || e);
    }
  }
  return "";
}

// ==============================================================================
// Helper: Handle reCAPTCHA (Dual Mode: Audio Challenge & Image/Cloud Solver)
// ==============================================================================
async function handleRecaptchaWithAudioChallenge(page, prefix = "") {
  // Mode Image / Cloud Solver Langsung (Jika dipilih atau API key tersedia)
  if (CAPTCHA_MODE === "image" || ((CAPSOLVER_KEY || TWOCAPTCHA_KEY) && CAPTCHA_MODE === "auto")) {
    console.log(`${prefix} [reCAPTCHA Mode: Image/Cloud API] Mengambil solusi token captcha...`);
    const apiToken = solveImageCaptchaViaApi(RECAPTCHA_SITEKEY, page.url(), prefix);
    if (apiToken) {
      await page.evaluate((tok) => {
        try {
          const el = document.getElementById("g-recaptcha-response") || document.querySelector('[name="g-recaptcha-response"]');
          if (el) {
            el.value = tok;
            el.innerHTML = tok;
          }
          if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {
            for (const key in window.___grecaptcha_cfg.clients) {
              const client = window.___grecaptcha_cfg.clients[key];
              for (const k in client) {
                if (client[k] && typeof client[k].callback === "function") {
                  client[k].callback(tok);
                }
              }
            }
          }
        } catch (e) {}
      }, apiToken);
      console.log(`${prefix} ✅ Token Image Solver berhasil diinjeksikan!`);
      return true;
    }
  }

  console.log(`${prefix} [reCAPTCHA Mode: Audio Solver] Menunggu iframe reCAPTCHA checkbox dimuat...`);

  const anchorFrame = page.frameLocator('iframe[src*="recaptcha/api2/anchor"]');
  const anchorCheckbox = anchorFrame.locator("#recaptcha-anchor");

  try {
    await anchorCheckbox.waitFor({ state: "visible", timeout: 6000 }).catch(() => {});
  } catch (e) {}

  for (let attempt = 1; attempt <= 3; attempt++) {
    const attemptPrefix = `${prefix} [reCAPTCHA Percobaan ${attempt}/3]`;

    try {
      if (await anchorCheckbox.isVisible()) {
        const isChecked = (await anchorCheckbox.getAttribute("aria-checked")) === "true";
        if (isChecked) {
          console.log(`${attemptPrefix} ✅ reCAPTCHA tercentang hijau.`);
          return true;
        }

        if (attempt === 1) {
          // Human-like mouse movement
          try {
            await page.mouse.move(180, 260);
            sleep(0.4);
            await page.mouse.move(260, 340);
            sleep(0.4);
          } catch (e) {}

          console.log(`${attemptPrefix} Mengklik checkbox reCAPTCHA...`);
          await anchorCheckbox.click({ timeout: 4000 }).catch(() => {});
          sleep(2);

          const checkedAfterClick = (await anchorCheckbox.getAttribute("aria-checked")) === "true";
          if (checkedAfterClick) {
            console.log(`${attemptPrefix} ✅ Langsung terverifikasi tanpa tantangan!`);
            return true;
          }
        }
      }
    } catch (e) {}

    // Tangani popup bframe audio challenge
    try {
      const bframe = page.frameLocator('iframe[src*="recaptcha/api2/bframe"]');
      const audioBtn = bframe.locator("#recaptcha-audio-button");
      const audioInput = bframe.locator("#audio-response");
      const reloadBtn = bframe.locator("#recaptcha-reload-button");

      // Cek apakah terkena blok bot Google (DOS block)
      const dosBlock = bframe.locator(".rc-doscaptcha-header, #recaptcha-dos-message");
      if (await dosBlock.isVisible().catch(() => false)) {
        console.error(`\n${attemptPrefix} ⚠️⚠️ GOOGLE DOS BLOK TERDETEKSI (Automated Queries / IP Rate Limit)!`);
        console.warn(`${attemptPrefix} Menghentikan percobaan audio agar IP tidak diban permanen. Cooldown 60s...`);
        sleep(60);
        return false;
      }

      // Jika tombol audio masih ada (belum dipilih), klik tombol audio
      if (await audioBtn.isVisible().catch(() => false)) {
        console.log(`${attemptPrefix} 🎧 Memilih tantangan AUDIO...`);
        await audioBtn.click({ timeout: 3000 }).catch(() => {});
        sleep(2);
      }

      // Ambil link audio
      const downloadLink = bframe.locator(".rc-audiochallenge-tdownload-link");
      const audioSource = bframe.locator("#audio-source");
      let audioUrl = "";

      if (await downloadLink.isVisible().catch(() => false)) {
        audioUrl = await downloadLink.getAttribute("href");
      } else if (await audioSource.isVisible().catch(() => false)) {
        audioUrl = await audioSource.getAttribute("src");
      }

      if (audioUrl) {
        console.log(`${attemptPrefix} Transkripsi audio dari Wit.ai...`);
        const textSolution = transcribeAudioUrl(audioUrl, attemptPrefix);

        if (textSolution) {
          console.log(`${attemptPrefix} Mengisi transkripsi: "${textSolution}"`);
          if (await audioInput.isVisible().catch(() => false)) {
            await audioInput.fill(textSolution);
            sleep(0.5);

            const verifyBtn = bframe.locator("#recaptcha-verify-button");
            if (await verifyBtn.isVisible().catch(() => false)) {
              console.log(`${attemptPrefix} Menekan tombol Verifikasi...`);
              await verifyBtn.click({ timeout: 3000 }).catch(() => {});
              sleep(2.5);
            }
          }
        } else {
          console.warn(`${attemptPrefix} Transkripsi audio kosong, mereload audio...`);
          await reloadBtn.click({ timeout: 2000 }).catch(() => {});
          sleep(2);
        }
      } else if (attempt > 1) {
        // Jika link audio belum muncul di attempt berikutnya, klik reload
        await reloadBtn.click({ timeout: 2000 }).catch(() => {});
        sleep(2);
      }
    } catch (e) {
      console.warn(`${attemptPrefix} Notice bframe:`, e.message || e);
    }

    // Cek apakah sudah verified
    try {
      const isChecked = (await anchorCheckbox.getAttribute("aria-checked")) === "true";
      if (isChecked) {
        console.log(`${attemptPrefix} ✅ reCAPTCHA berhasil diverifikasi!`);
        return true;
      }
    } catch (e) {}

    sleep(1);
  }

  // Final check
  try {
    const isChecked = (await anchorCheckbox.getAttribute("aria-checked")) === "true";
    return isChecked;
  } catch (e) {
    return false;
  }
}

// ==============================================================================
// Helper: Preserve and Dump Storage (localStorage, sessionStorage, cookies)
// ==============================================================================
async function dumpAndPreserveStorage(page, prefix = "") {
  try {
    const data = await page.evaluate(() => {
      const ls = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          ls[k] = localStorage.getItem(k);
        }
      } catch (e) {}

      const ss = {};
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          ss[k] = sessionStorage.getItem(k);
        }
      } catch (e) {}

      return {
        localStorage: ls,
        sessionStorage: ss,
        cookie: document.cookie || "",
      };
    });

    const lsKeys = Object.keys(data.localStorage || {});
    console.log(`${prefix} [Preserve Storage] localStorage (${lsKeys.length} keys):`, JSON.stringify(data.localStorage));
    if (data.cookie) {
      console.log(`${prefix} [Preserve Storage] Cookie:`, data.cookie);
    }

    // Rewrite .env jika ada token _grecaptcha baru
    if (data.localStorage && data.localStorage._grecaptcha) {
      syncTokenToEnv(data.localStorage._grecaptcha, prefix);
    }

    return data;
  } catch (err) {
    console.warn(`${prefix} [Preserve Storage Notice]:`, err.message || err);
    return null;
  }
}

// ==============================================================================
// Helper: Sync reCAPTCHA Token to .env via local daemon
// ==============================================================================
function syncTokenToEnv(token, prefix = "") {
  if (!token) return;
  try {
    const res = http.post("http://127.0.0.1:9876/token", JSON.stringify({ token }), {
      headers: { "Content-Type": "application/json" },
      timeout: "2s",
    });
    if (res.status === 200) {
      console.log(`${prefix} 💾 [Token Sync] GRECAPTCHA_TOKEN berhasil di-rewrite ke file .env!`);
    }
  } catch (e) {}
}

function recordApiCall(record) {
  try {
    http.post("http://127.0.0.1:9876/record", JSON.stringify(record), {
      headers: { "Content-Type": "application/json" },
      timeout: "2s",
    });
  } catch (e) {}
}

// ==============================================================================
// Main Scenario Execution
// ==============================================================================
export default async function () {
  const vuId = __VU;
  const iterId = __ITER + 1;

  let game = GAME_CHOICE;
  if (game === "all" || !AVAILABLE_GAMES.includes(game)) {
    // Setiap VU memegang 1 game unik secara permanen -> 3 game berjalan serentak bersamaan
    const gameIdx = (vuId - 1) % AVAILABLE_GAMES.length;
    game = AVAILABLE_GAMES[gameIdx];
  }

  const gameUrl = `${BASE_URL}/games/${game}`;
  const prefix = `[VU ${vuId} | Iter ${iterId}/${LOOP_COUNT} | ${game}]`;

  // Stagger delay antar-VU agar worker tidak membuka captcha di detik yang persis sama (menghindari Google rate limit)
  if (iterId === 1 && vuId > 1) {
    const initialStagger = ((vuId - 1) * 1.5) % 9;
    sleep(initialStagger);
  }

  console.log(`\n=============================================================`);
  console.log(`${prefix} 🚀 Membuka browser menuju ${gameUrl}`);
  console.log(`=============================================================`);

  // Tampilkan posisi leaderboard live saat ini
  const initialStanding = fetchLeaderboardStanding(USERNAME);
  printStandingBanner(initialStanding, USERNAME, prefix);

  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  ];
  const selectedUa = userAgents[(vuId - 1) % userAgents.length];

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    userAgent: selectedUa,
  });

  // Stealth properties injection
  try {
    await page.evaluate(() => {
      try {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.navigator.chrome = { runtime: {} };
      } catch (e) {}
    });
  } catch (e) {}

  // Preserve Browser Console Logs
  try {
    page.on("console", (msg) => {
      const text = msg.text ? msg.text() : String(msg);
      const type = msg.type ? msg.type() : "log";
      if (!text.includes("downloadable font") && !text.includes("favicon")) {
        console.log(`${prefix} [Browser Console ${type.toUpperCase()}] ${text}`);
      }
    });
  } catch (e) {}

  // Preserve Uncaught Browser Errors
  try {
    page.on("pageerror", (err) => {
      console.warn(`${prefix} [Browser Page Error]`, err.message || err);
    });
  } catch (e) {}

  // Preserve & Record Network API Requests
  try {
    page.on("request", (req) => {
      const url = req.url ? req.url() : "";
      if (url.includes("/api/games/") || url.includes("/sessions") || url.includes("/scores")) {
        const method = req.method ? req.method() : "GET";
        const postData = req.postData ? req.postData() : "";
        console.log(`${prefix} 📤 [API Request] ${method} ${url} ${postData ? `| Body: ${postData.substring(0, 120)}` : ""}`);
        recordApiCall({
          vu: vuId,
          iteration: iterId,
          game: game,
          type: "request",
          method: method,
          url: url,
          body: postData,
        });
      }
    });
  } catch (e) {}

  // Preserve & Record Network API Responses
  try {
    page.on("response", async (response) => {
      const url = response.url ? response.url() : "";
      if (url.includes("/api/games/") || url.includes("/sessions") || url.includes("/scores")) {
        const status = response.status ? response.status() : 200;
        let bodySnippet = "";
        let bodyFull = "";
        try {
          bodyFull = await response.text();
          if (bodyFull) bodySnippet = ` - Body: ${bodyFull.substring(0, 120)}`;
        } catch (e) {}
        console.log(`${prefix} 📥 [API Response] ${url} -> HTTP ${status}${bodySnippet}`);
        recordApiCall({
          vu: vuId,
          iteration: iterId,
          game: game,
          type: "response",
          url: url,
          status: status,
          body: bodyFull,
        });
      }
    });
  } catch (e) {}

  try {
    // 1. Kunjungi halaman game
    await page.goto(gameUrl, { waitUntil: "domcontentloaded" });
    sleep(1);

    // Ambil initial preserve log storage
    await dumpAndPreserveStorage(page, prefix);

    // 2. Isi username jika field input muncul
    const input = page.locator("#usernameInput, input[name='username']");
    if (await input.isVisible()) {
      await input.fill(USERNAME);
      console.log(`${prefix} Username diisi: "${USERNAME}"`);
    }

    // 3. Tangani reCAPTCHA dengan memilih tantangan Audio
    const captchaSolved = await handleRecaptchaWithAudioChallenge(page, prefix);
    if (!captchaSolved) {
      console.warn(`${prefix} ⚠️ reCAPTCHA belum terverifikasi. Melewati ronde ini...`);
      await dumpAndPreserveStorage(page, prefix);
      sleep(ROUND_DELAY_SEC);
      return;
    }

    // Preserve storage setelah captcha diselesaikan
    await dumpAndPreserveStorage(page, prefix);

    // 4. Klik tombol "Ayo Main"
    console.log(`${prefix} Menekan tombol "Ayo Main"...`);
    try {
      await page.evaluate(() => {
        const btn = document.getElementById("submitBtn") || document.querySelector("button[type='submit']");
        if (btn) {
          btn.removeAttribute("disabled");
          btn.click();
        }
      });
    } catch (clickErr) {
      console.warn(`${prefix} Notice submit button:`, clickErr.message || clickErr);
    }

    // 5. Cek apakah form ditolak (misal captcha belum solved)
    sleep(1.5);
    const errorBox = page.locator("#usernameError");
    if (await errorBox.isVisible()) {
      const errText = await errorBox.innerText();
      if (errText) {
        console.warn(`${prefix} ⚠️ Form error: "${errText}"`);
        console.log(`${prefix} Mengulang ronde berikutnya...`);
        sleep(ROUND_DELAY_SEC);
        return;
      }
    }

    // 6. Tunggu countdown selesai dan tap button muncul
    console.log(`${prefix} Menunggu countdown selesai...`);
    const tapBtn = page.locator("#tapBtn");
    try {
      await tapBtn.waitFor({ state: "visible", timeout: 10000 });
    } catch (btnErr) {
      console.warn(`${prefix} ⚠️ Tombol tap tidak muncul. Modal belum tertutup atau sesi ditolak.`);
      sleep(ROUND_DELAY_SEC);
      return;
    }

    console.log(`${prefix} 🚀 GO! Menjalankan strategi 7.8s via DOM evaluation (Win & Skor Maksimal)...`);

    // 7. Rapid tapping via DOM evaluation (Strategi 7.8s: Jaga progress di 85-90% sampai detik 7.5, lalu burst finish di 7.8s)
    try {
      await page.evaluate(async () => {
        const btn = document.getElementById("tapBtn") || document.querySelector("#tapBtn");
        if (!btn) throw new Error("Element #tapBtn tidak ditemukan di DOM");

        const startTime = Date.now();
        const TARGET_DURATION_MS = 7800;

        function doTap() {
          btn.click();
          btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
          btn.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          btn.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true }));
          btn.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        }

        // Phase 1: Rapid burst untuk menaikkan progress ke 80%
        for (let i = 0; i < 14; i++) {
          doTap();
          await new Promise((resolve) => setTimeout(resolve, 40));
        }

        // Phase 2: Menjaga progress di 80-85% sampai detik 7.8 (220ms per tap mengimbangi gravitasi)
        while (Date.now() - startTime < 7800) {
          doTap();
          await new Promise((resolve) => setTimeout(resolve, 220));
        }

        // Phase 3: Final finish burst di detik ke-8.0 untuk memicu win() dengan durasi aman (>= 8 detik)
        while (Date.now() - startTime < TARGET_DURATION_MS + 2500) {
          doTap();
          await new Promise((resolve) => setTimeout(resolve, 30));
          const popup = document.getElementById("popup");
          if (popup && !popup.classList.contains("hidden")) break;
        }
      });
    } catch (tapErr) {
      if (!String(tapErr).includes("destroyed") && !String(tapErr).includes("closed")) {
        console.warn(`${prefix} Tap notice:`, tapErr.message || tapErr);
      }
    }

    // 8. Tunggu popup hasil
    const popup = page.locator("#popup");
    await popup.waitFor({ state: "visible", timeout: 15000 });

    const pointsElem = page.locator("#popupProgress");
    const pointsText = await pointsElem.innerText();
    console.log(`${prefix} 🎉 Selesai! Poin yang diperoleh: +${pointsText}`);

    // 9. Ambil dan tampilkan posisi ranking terakhir dari leaderboard
    const standingData = fetchLeaderboardStanding(USERNAME);
    printStandingBanner(standingData, USERNAME, prefix);

    const jitteredDelay = ROUND_DELAY_SEC + Math.random() * 2.5;
    console.log(`${prefix} ⏳ Jeda ${jitteredDelay.toFixed(1)}s (jitter anti-bot) sebelum ronde berikutnya...`);
    sleep(jitteredDelay);
  } catch (err) {
    console.error(`${prefix} Error selama eksekusi browser:`, err.message || err);
  } finally {
    await page.close();
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
  } catch (e) {}
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
// Summary Handler: Menampilkan Ringkasan & Ranking Final
// ==============================================================================
export function handleSummary(data) {
  const standingData = fetchLeaderboardStanding(USERNAME);
  printStandingBanner(standingData, USERNAME, "");

  return {
    stdout: "",
  };
}
