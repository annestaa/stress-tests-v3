import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
chromium.use(stealth());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, ".env");
const USER_DATA_DIR = path.join(__dirname, "user_data");
const PORT = 9876;

// Anti-Ban & Rate-Limiting State
let activeSolvePromise = null;
let lastSolveTimestamp = 0;
let dosBlockCooldownUntil = 0;
const tokenPool = [];
const MAX_POOL_SIZE = 5;

/**
 * Menemukan file env yang aktif (.env.api, .env.browser, atau .env)
 */
function getActiveEnvPaths() {
  const custom = process.env.ENV_FILE ? [path.join(__dirname, process.env.ENV_FILE)] : [];
  const defaults = [
    path.join(__dirname, ".env.api"),
    path.join(__dirname, ".env.browser"),
    path.join(__dirname, ".env"),
  ];
  return [...new Set([...custom, ...defaults])].filter((p) => fs.existsSync(p));
}

/**
 * Membaca nilai dari file .env secara dinamis
 */
function getEnvValue(key, fallback = "") {
  const envPaths = getActiveEnvPaths();
  for (const envPath of envPaths) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
      if (match && match[1] && match[1].trim()) {
        let val = match[1].trim();
        // Strip inline comments (# ...) tapi hanya jika bukan bagian dari token/key yang panjang.
        // Heuristic: jika ada " # " (spasi-hash-spasi), anggap itu komentar.
        // Jangan strip jika value terlihat seperti token (panjang tanpa spasi sebelum #).
        const commentIdx = val.indexOf(" #");
        if (commentIdx > 0) {
          val = val.substring(0, commentIdx).trim();
        }
        return val;
      }
    } catch (e) { }
  }
  return fallback;
}

/**
 * Update GRECAPTCHA_TOKEN di seluruh file .env aktif (.env.api, .env.browser, .env)
 */
function updateEnvToken(token) {
  if (!token || typeof token !== "string") return false;
  try {
    const envFiles = [".env.api", ".env.browser", ".env"];
    for (const file of envFiles) {
      const p = path.join(__dirname, file);
      if (fs.existsSync(p)) {
        let content = fs.readFileSync(p, "utf8");
        // Regex untuk me-replace token lama
        const regex = /^GRECAPTCHA_TOKEN=.*$/m;
        if (regex.test(content)) {
          content = content.replace(regex, `GRECAPTCHA_TOKEN=${token.trim()}`);
        } else {
          content += `\nGRECAPTCHA_TOKEN=${token.trim()}\n`;
        }
        fs.writeFileSync(p, content, "utf8");
        console.log(`[Token Sync] 💾 GRECAPTCHA_TOKEN berhasil di-rewrite ke ${file}!`);
      }
    }
    return true;
  } catch (err) {
    console.error(`[Token Sync] ❌ Gagal update token di .env:`, err.message);
    return false;
  }
}

/**
 * Tidak dipakai lagi karena token ada di pool
 */
function readEnvToken() {
  return "";
}

/**
 * Cek ketersediaan CDP (Chrome Remote Debugging)
 */
async function isCDPAvailable(cdpUrl) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${cdpUrl}/json/version`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Solves reCAPTCHA via CapSolver API (Anti-Ban: Menggunakan Proxy Pool CapSolver)
 */
async function solveViaCapSolver(apiKey, sitekey, pageUrl) {
  console.log("[Token Sync] 🌐 [CapSolver API] Meminta token reCAPTCHA dari cloud proxy pool...");
  try {
    const createRes = await fetch("https://api.capsolver.com/createTask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: apiKey,
        task: {
          type: "ReCaptchaV2TaskProxyLess",
          websiteURL: pageUrl,
          websiteKey: sitekey,
        },
      }),
    });
    const createJson = await createRes.json();
    if (!createJson || createJson.errorId !== 0 || !createJson.taskId) {
      console.warn(`[Token Sync] CapSolver createTask error:`, createJson?.errorDescription || "Unknown error");
      return "";
    }

    const taskId = createJson.taskId;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch("https://api.capsolver.com/getTaskResult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientKey: apiKey, taskId }),
      });
      const resJson = await res.json();
      if (resJson && resJson.status === "ready" && resJson.solution?.gRecaptchaResponse) {
        console.log("[Token Sync] 🎯 CapSolver token sukses diperoleh tanpa menggunakan IP lokal!");
        return resJson.solution.gRecaptchaResponse;
      }
      if (resJson && resJson.status === "failed") {
        console.warn(`[Token Sync] CapSolver task failed:`, resJson.errorDescription);
        return "";
      }
    }
  } catch (err) {
    console.warn("[Token Sync] CapSolver fetch error:", err.message);
  }
  return "";
}

/**
 * Solves reCAPTCHA via 2Captcha API (Anti-Ban: Menggunakan Worker Pool 2Captcha)
 */
async function solveVia2Captcha(apiKey, sitekey, pageUrl) {
  console.log("[Token Sync] 🌐 [2Captcha API] Meminta token reCAPTCHA dari cloud solver...");
  try {
    const inUrl = `https://2captcha.com/in.php?key=${apiKey}&method=userrecaptcha&googlekey=${sitekey}&pageurl=${encodeURIComponent(pageUrl)}&json=1`;
    const inRes = await fetch(inUrl);
    const inJson = await inRes.json();
    if (!inJson || inJson.status !== 1 || !inJson.request) {
      console.warn(`[Token Sync] 2Captcha in.php error:`, inJson?.request || "Unknown error");
      return "";
    }

    const reqId = inJson.request;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const resUrl = `https://2captcha.com/res.php?key=${apiKey}&action=get&id=${reqId}&json=1`;
      const res = await fetch(resUrl);
      const resJson = await res.json();
      if (resJson && resJson.status === 1 && resJson.request) {
        console.log("[Token Sync] 🎯 2Captcha token sukses diperoleh!");
        return resJson.request;
      }
      if (resJson && resJson.request !== "CAPCHA_NOT_READY") {
        console.warn(`[Token Sync] 2Captcha error:`, resJson.request);
        return "";
      }
    }
  } catch (err) {
    console.warn("[Token Sync] 2Captcha fetch error:", err.message);
  }
  return "";
}

/**
 * Mendeteksi base directory Chrome sesuai OS (Windows / macOS / Linux)
 */
function getChromeBaseDir() {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const platform = process.platform;

  // Daftar kandidat path Chrome, diurutkan berdasarkan prioritas per OS
  const candidates = [];

  if (platform === "win32") {
    // Windows: Chrome User Data ada di %LOCALAPPDATA%
    const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
    candidates.push(path.join(localAppData, "Google", "Chrome", "User Data"));
    // Fallback: beberapa instalasi menggunakan %APPDATA%
    const appData = process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
    candidates.push(path.join(appData, "Google", "Chrome", "User Data"));
  } else if (platform === "darwin") {
    // macOS
    candidates.push(path.join(homeDir, "Library", "Application Support", "Google", "Chrome"));
  } else {
    // Linux
    candidates.push(path.join(homeDir, ".config", "google-chrome"));
    candidates.push(path.join(homeDir, ".config", "chromium"));
  }

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      console.log(`[Token Sync] 📂 Chrome base dir ditemukan: ${dir}`);
      return dir;
    }
  }

  console.warn(`[Token Sync] ⚠️ Chrome base dir tidak ditemukan. Kandidat yang dicek: ${candidates.join(", ")}`);
  return null;
}

/**
 * Mencari folder profile Google Chrome berdasarkan email atau nama profil (Default, Profile 1, dsb.)
 */
function resolveChromeProfileDir(targetEmailOrProfile = "") {
  const chromeBaseDir = getChromeBaseDir();
  if (!chromeBaseDir) return null;

  const target =
    targetEmailOrProfile ||
    getEnvValue("CHROME_USER_EMAIL", "") ||
    getEnvValue("CHROME_PROFILE", "") ||
    "";

  // 1. Cek jika target langsung berupa nama folder (misal "Profile 1" atau "Default")
  if (target && fs.existsSync(path.join(chromeBaseDir, target))) {
    return { dir: path.join(chromeBaseDir, target), name: target };
  }

  // 2. Baca "Local State" untuk mencocokkan email akun Google
  try {
    const localStatePath = path.join(chromeBaseDir, "Local State");
    if (fs.existsSync(localStatePath)) {
      const localState = JSON.parse(fs.readFileSync(localStatePath, "utf-8"));
      const infoCache = localState?.profile?.info_cache || {};

      for (const [profFolder, profInfo] of Object.entries(infoCache)) {
        const uName = profInfo.user_name || "";
        const uEmail = profInfo.email || "";
        const pName = profInfo.name || "";
        const gaiaName = profInfo.gaia_name || "";

        if (
          target &&
          (
            uName.toLowerCase() === target.toLowerCase() ||
            uEmail.toLowerCase() === target.toLowerCase() ||
            pName.toLowerCase() === target.toLowerCase() ||
            gaiaName.toLowerCase() === target.toLowerCase()
          )
        ) {
          const matchedDir = path.join(chromeBaseDir, profFolder);
          if (fs.existsSync(matchedDir)) {
            console.log(`[Token Sync] 👤 Profil Chrome terdeteksi untuk "${target}": ${profFolder} (${uName || pName})`);
            return { dir: matchedDir, name: profFolder, email: uName || uEmail };
          }
        }
      }

      // Log all profiles for debugging if target not found
      if (target) {
        console.warn(`[Token Sync] ⚠️ Tidak menemukan profil Chrome untuk "${target}". Profil yang tersedia:`);
        for (const [profFolder, profInfo] of Object.entries(infoCache)) {
          console.warn(`  - ${profFolder}: ${profInfo.user_name || profInfo.name || '(tanpa nama)'}`);
        }
      }
    }
  } catch (err) {
    console.warn("[Token Sync] Gagal membaca Local State Chrome:", err.message);
  }

  // 3. Fallback ke Default jika tidak ditemukan
  const defaultDir = path.join(chromeBaseDir, "Default");
  return fs.existsSync(defaultDir) ? { dir: defaultDir, name: "Default" } : null;
}

/**
 * Sync Google Chrome Profile data ke session solver untuk 1-click reCAPTCHA pass
 */
function syncPrimaryChromeProfile(targetUserDataDir) {
  const profileInfo = resolveChromeProfileDir();
  if (!profileInfo || !profileInfo.dir) {
    console.warn("[Token Sync] ⚠️ Direktori profil Google Chrome tidak ditemukan.");
    return;
  }

  const srcProfileDir = profileInfo.dir;
  const destDefaultDir = path.join(targetUserDataDir, "Default");
  fs.mkdirSync(destDefaultDir, { recursive: true });

  console.log(`[Token Sync] 🔄 Mengklon user_data dari profil "${profileInfo.name}" (${profileInfo.email || "Default Profile"}) ke solver environment...`);

  const itemsToSync = [
    "Cookies",
    "Network",
    "Local Storage",
    "Preferences",
    "Login Data",
    "Web Data",
    "History",
    "Secure Preferences",
    "Session Storage",
    "Extension State",
  ];

  let syncedCount = 0;
  for (const item of itemsToSync) {
    const src = path.join(srcProfileDir, item);
    const dest = path.join(destDefaultDir, item);
    try {
      if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true, force: true });
        syncedCount++;
      }
    } catch (e) {
      console.warn(`[Token Sync] ⚠️ Gagal sync "${item}": ${e.message}`);
    }
  }
  console.log(`[Token Sync] 📋 ${syncedCount}/${itemsToSync.length} item profil berhasil disinkronkan.`);

  // Sinkronkan Local State dari Chrome base dir (cross-platform)
  const chromeBaseDir = getChromeBaseDir();
  if (chromeBaseDir) {
    const srcLocalState = path.join(chromeBaseDir, "Local State");
    const destLocalState = path.join(targetUserDataDir, "Local State");
    if (fs.existsSync(srcLocalState)) {
      try {
        fs.copyFileSync(srcLocalState, destLocalState);
        console.log("[Token Sync] ✅ Local State berhasil disinkronkan.");
      } catch (e) {
        console.warn(`[Token Sync] ⚠️ Gagal sync Local State: ${e.message}`);
      }
    }
  }

  for (const lockFile of ["SingletonLock", "SingletonSocket", "SingletonCookie", "lockfile"]) {
    try { fs.rmSync(path.join(targetUserDataDir, lockFile), { force: true }); } catch { }
    try { fs.rmSync(path.join(destDefaultDir, lockFile), { force: true }); } catch { }
  }
}


/**
 * Solve audio challenge: download audio, kirim ke Wit.ai, return transkrip.
 * Dengan logging detail untuk debugging.
 */
async function solveAudioChallenge(audioUrl, witToken) {
  try {
    console.log(`[Token Sync] 🎧 Mengunduh file audio reCAPTCHA: ${audioUrl.substring(0, 80)}...`);
    const audioRes = await fetch(audioUrl);
    if (!audioRes.ok) {
      console.warn(`[Token Sync] ❌ Gagal download audio: HTTP ${audioRes.status}`);
      return "";
    }
    const audioBuf = await audioRes.arrayBuffer();
    const audioSizeKB = (audioBuf.byteLength / 1024).toFixed(1);
    console.log(`[Token Sync] 📦 Audio diunduh: ${audioSizeKB} KB`);

    if (audioBuf.byteLength < 1000) {
      console.warn(`[Token Sync] ⚠️ Audio file terlalu kecil (${audioBuf.byteLength} bytes). Kemungkinan bukan audio valid.`);
      return "";
    }

    console.log("[Token Sync] 🔊 Mengirim audio ke Wit.ai Speech API...");
    const witRes = await fetch("https://api.wit.ai/speech?v=20230215", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${witToken}`,
        "Content-Type": "audio/mpeg",
      },
      body: Buffer.from(audioBuf),
    });

    if (!witRes.ok) {
      console.warn(`[Token Sync] ❌ Wit.ai API error: HTTP ${witRes.status} ${witRes.statusText}`);
      const errBody = await witRes.text().catch(() => "");
      if (errBody) console.warn(`[Token Sync] Wit.ai error body: ${errBody.substring(0, 300)}`);
      return "";
    }

    const witText = await witRes.text();
    console.log(`[Token Sync] 📝 Wit.ai raw response (${witText.length} chars): ${witText.substring(0, 500)}`);

    let answer = "";
    try {
      // Wit.ai mengembalikan stream JSON chunk per baris. Ambil chunk final terakhir.
      const lines = witText.trim().split("\n");
      console.log(`[Token Sync] 📊 Wit.ai response chunks: ${lines.length} baris`);

      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed && parsed.text && parsed.text.trim()) {
            answer = parsed.text.trim();
            console.log(`[Token Sync] ✅ Wit.ai transkrip final (chunk ${i}): "${answer}"`);
            break;
          }
          if (parsed && !parsed.text) {
            console.log(`[Token Sync] ℹ️ Wit.ai chunk ${i} memiliki data tapi tanpa 'text': ${JSON.stringify(parsed).substring(0, 200)}`);
          }
        } catch (jsonErr) {
          console.log(`[Token Sync] ℹ️ Wit.ai chunk ${i} bukan JSON valid: ${line.substring(0, 100)}`);
        }
      }

      // Fallback regex jika parsing per baris tidak menemukan text
      if (!answer) {
        const matches = [...witText.matchAll(/"text"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g)];
        if (matches.length > 0) {
          const lastMatch = matches[matches.length - 1];
          answer = lastMatch[1].replace(/\\"/g, '"').trim();
          console.log(`[Token Sync] ✅ Wit.ai transkrip (regex fallback): "${answer}"`);
        } else {
          console.warn("[Token Sync] ⚠️ Tidak ada field 'text' ditemukan di seluruh response Wit.ai.");
        }
      }
    } catch (e) {
      console.warn("[Token Sync] ❌ Error parsing Wit.ai response:", e.message);
    }

    return answer;
  } catch (err) {
    console.warn("[Token Sync] ❌ solveAudioChallenge error:", err.message);
    return "";
  }
}


/**
 * Main reCAPTCHA Solver dengan Proteksi Anti-Ban, Mutex Lock, Cooldown, & Stealth
 */
async function solveRecaptchaSafely(bypassCache = false) {
  const now = Date.now();

  // 1. Cek Cooldown DOS Block dari Google
  if (now < dosBlockCooldownUntil) {
    const remainingSec = Math.ceil((dosBlockCooldownUntil - now) / 1000);
    console.warn(`[Token Sync] ⛔ Google DOS Captcha Cooldown aktif! Harap tunggu ${remainingSec}s agar limit IP Google pulih.`);
    return "";
  }

  // Clear cache logic removed since we use Token Pool

  // 3. Batasi frekuensi pemanggilan solver lokal (minimal 6 detik jeda)
  const minInterval = parseInt(getEnvValue("CAPTCHA_MIN_INTERVAL_SEC", "6"), 10) * 1000;
  if (now - lastSolveTimestamp < minInterval) {
    const waitTime = minInterval - (now - lastSolveTimestamp);
    console.log(`[Token Sync] ⏳ Rate-limiting solver lokal: Menunggu ${Math.ceil(waitTime / 1000)}s sebelum request berikutnya...`);
    await new Promise((r) => setTimeout(r, waitTime));
  }

  lastSolveTimestamp = Date.now();

  const sitekey = getEnvValue("RECAPTCHA_SITEKEY", "6LfAlHgtAAAAAFVPd3EGbA_FvEUvL6yfI8lKcma5");
  const targetGame = getEnvValue("GAME_CHOICE", "tariktambang");
  const gameName = targetGame === "all" ? "tariktambang" : targetGame;
  const baseUrl = getEnvValue("BASE_URL", "https://kemerdekaan.liputan6.com");
  const gameUrl = `${baseUrl}/games/${gameName}`;

  // 4. Prioritas 1: Jika CapSolver / 2Captcha API Key tersedia, gunakan Cloud Solver (100% Bebas IP Ban)
  const capsolverKey = getEnvValue("CAPSOLVER_API_KEY", "");
  if (capsolverKey) {
    const capToken = await solveViaCapSolver(capsolverKey, sitekey, gameUrl);
    if (capToken) {
      updateEnvToken(capToken);
      return capToken;
    }
  }

  const twocaptchaKey = getEnvValue("TWOCAPTCHA_API_KEY", "");
  if (twocaptchaKey) {
    const twoToken = await solveVia2Captcha(twocaptchaKey, sitekey, gameUrl);
    if (twoToken) {
      updateEnvToken(twoToken);
      return twoToken;
    }
  }

  // 5. Prioritas 2: Cek CDP hanya jika USE_CDP=true diaktifkan secara eksplisit
  const useCdp = getEnvValue("USE_CDP", "false").toLowerCase() === "true";
  const cdpUrl = getEnvValue("CDP_URL", "http://127.0.0.1:9222");
  const cdpAvailable = useCdp && (await isCDPAvailable(cdpUrl));

  let browserOrContext = null;
  let page = null;
  let isCDP = false;

  try {
    if (cdpAvailable) {
      console.log(`[Token Sync] 🌐 Terhubung ke Google Chrome via CDP (${cdpUrl})...`);
      const browser = await chromium.connectOverCDP(cdpUrl);
      const contexts = browser.contexts();
      const context = contexts[0] || (await browser.newContext());
      const pages = context.pages();
      page = pages.find((p) => p.url().includes("liputan6.com")) || (await context.newPage());
      browserOrContext = browser;
      isCDP = true;
    } else {
      // 6. Prioritas 3: Playwright Persistent Context (Bisa tanpa Profil Chrome)
      const useChromeProfile = getEnvValue("USE_CHROME_PROFILE", "false").toLowerCase() === "true";

      if (useChromeProfile) {
        console.log("[Token Sync] 🔄 Sinkronisasi profil Chrome asli untuk reputasi tinggi (1-Click Pass)...");
        if (!fs.existsSync(USER_DATA_DIR)) {
          fs.mkdirSync(USER_DATA_DIR, { recursive: true });
        }
        syncPrimaryChromeProfile(USER_DATA_DIR);
      } else {
        console.log("[Token Sync] 🕵️ Menggunakan profil browser kosong (Tanpa Chrome Profile)...");
        // Hapus folder user_data HANYA jika clearCookieEnv true
        const clearCookieEnv = getEnvValue("CLEAR_COOKIE", "false").toLowerCase() === "true";
        if (clearCookieEnv && fs.existsSync(USER_DATA_DIR)) {
          try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (e) { }
        }
        if (!fs.existsSync(USER_DATA_DIR)) {
          fs.mkdirSync(USER_DATA_DIR, { recursive: true });
        }
      }

      const proxyServer = getEnvValue("PROXY_SERVER", getEnvValue("HTTP_PROXY", ""));
      const headlessSetting = getEnvValue("HEADLESS", "true").toLowerCase();
      const isHeadless = headlessSetting !== "false";
      const launchOptions = {
        channel: "chrome",
        headless: isHeadless,
        viewport: { width: 1280, height: 800 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-infobars",
          "--disable-dev-shm-usage",
          "--no-first-run",
          "--no-default-browser-check",
          "--window-size=1280,800",
        ],
      };

      if (proxyServer) {
        console.log(`[Token Sync] 🛡 Menggunakan Proxy: ${proxyServer}`);
        launchOptions.proxy = { server: proxyServer };
      }

      let context;
      try {
        context = await chromium.launchPersistentContext(USER_DATA_DIR, launchOptions);
      } catch (launchErr) {
        // Fallback jika channel "chrome" tidak ditemukan, gunakan default chromium
        delete launchOptions.channel;
        context = await chromium.launchPersistentContext(USER_DATA_DIR, launchOptions);
      }
      browserOrContext = context;
      page = (await context.pages())[0] || (await context.newPage());
    }

    // Stealth Script Injection (dihapus agar solver lebih cepat)

    // Clear Cookie jika diminta (Otomatis aktif jika USE_CHROME_PROFILE=false, atau jika CLEAR_COOKIE=true)
    const clearCookieEnv = getEnvValue("CLEAR_COOKIE", "false").toLowerCase() === "true";

    if (clearCookieEnv) {
      console.log("[Token Sync] 🧹 Membersihkan cookies browser...");
      await page.context().clearCookies();
    }

    console.log(`[Token Sync] Mengunjungi halaman game: ${gameUrl}`);
    const response = await page.goto(gameUrl, { waitUntil: "networkidle", timeout: 30000 });

    // Pengecekan Status Server & Indikasi IP Block
    if (response) {
      const status = response.status();
      if (status === 403) {
        console.warn(`[Token Sync] 🚨 PERINGATAN: Akses ditolak (HTTP 403). IP mungkin diblokir oleh WAF/Cloudflare!`);
      } else if (status === 429) {
        console.warn(`[Token Sync] 🚨 PERINGATAN: Terlalu banyak request (HTTP 429). IP terkena rate-limit!`);
      } else if (status >= 500) {
        console.warn(`[Token Sync] 🚨 PERINGATAN: Server error (HTTP ${status}). Server target sedang down atau bermasalah!`);
      } else if (status !== 200) {
        console.warn(`[Token Sync] ⚠️ Notice: HTTP Status ${status} saat mengakses halaman.`);
      }
    }

    // Cek konten halaman untuk error spesifik (Quota reCAPTCHA atau Cloudflare Challenge)
    const pageText = await page.evaluate(() => document.body ? document.body.innerText : "").catch(() => "");
    if (pageText.includes("exceeding reCAPTCHA Enterprise free quota")) {
      console.error(`[Token Sync] 🚨 FATAL: Kuota reCAPTCHA Enterprise di situs target telah habis! Widget tidak akan muncul.`);
    } else if (pageText.toLowerCase().includes("cloudflare") && pageText.toLowerCase().includes("attention required")) {
      console.error(`[Token Sync] 🚨 FATAL: Terkena halaman blokir Cloudflare. IP Anda di-flag!`);
    } else if (pageText.includes("Access denied")) {
      console.error(`[Token Sync] 🚨 FATAL: Akses ditolak secara eksplisit oleh server target.`);
    }

    // Tunggu reCAPTCHA API script selesai dimuat dan widget ter-render
    await page.waitForFunction(() => {
      return typeof window.grecaptcha !== 'undefined' &&
        document.querySelector('iframe[src*="recaptcha"]') !== null;
    }, { timeout: 20000 }).catch(() => {
      console.warn("[Token Sync] ⚠️ reCAPTCHA widget gagal ter-render.");
    });

    // Reset grecaptcha state & hapus token lama di DOM/localStorage agar tidak terbaca token kadaluarsa
    await page.evaluate(() => {
      try {
        if (typeof window.grecaptcha !== "undefined" && typeof window.grecaptcha.reset === "function") {
          window.grecaptcha.reset();
        }
        localStorage.removeItem("_grecaptcha");
        const el = document.getElementById("g-recaptcha-response");
        if (el) el.value = "";
      } catch (e) { }
    }).catch(() => { });

    // Jeda human-like sebelum berinteraksi
    await page.waitForTimeout(2500 + Math.floor(Math.random() * 2000));

    // Cari iframe checkbox reCAPTCHA
    const anchorFrame = page.frameLocator('iframe[src*="recaptcha/api2/anchor"]');
    const checkbox = anchorFrame.locator("#recaptcha-anchor");

    try {
      await checkbox.waitFor({ state: "visible", timeout: 15000 });
      // Simulasi pergerakan mouse natural lebih lambat
      await page.mouse.move(150 + Math.random() * 50, 200 + Math.random() * 50, { steps: 5 });
      await page.waitForTimeout(800 + Math.random() * 1200);
      await checkbox.click({ delay: 50 + Math.random() * 50, timeout: 4000 });
    } catch (clickErr) {
      console.warn("[Token Sync] Notice klik checkbox:", clickErr.message);
    }

    // Tunggu respon setelah klik (cek apakah langsung centang hijau / 1-click pass)
    await page.waitForTimeout(2500);

    let token = await page.evaluate(() => {
      return typeof window.grecaptcha !== "undefined" && typeof window.grecaptcha.getResponse === "function"
        ? window.grecaptcha.getResponse()
        : document.getElementById("g-recaptcha-response")?.value || "";
    }).catch(() => "");

    if (token && token.length > 30) {
      console.log("[Token Sync] 🎯 1-Click Bypass Berhasil! Mendapatkan token fresh baru.");
      updateEnvToken(token);
      return token;
    }

    // Jika muncul tantangan popup bframe
    const bframe = page.frameLocator('iframe[src*="recaptcha/api2/bframe"]');
    const dosBlock = bframe.locator(".rc-doscaptcha-header, #recaptcha-dos-message");

    // DETEKSI DOS BLOCK / IP RATE LIMIT GOOGLE
    if (await dosBlock.isVisible({ timeout: 3000 }).catch(() => false)) {
      const cooldownDuration = parseInt(getEnvValue("CAPTCHA_DOS_COOLDOWN_SEC", "90"), 10);
      dosBlockCooldownUntil = Date.now() + cooldownDuration * 1000;
      console.error(`\n[Token Sync] ⚠️⚠️ PERINGATAN: GOOGLE MEMBATASI IP (DOS Block / Automated Queries)!`);
      console.error(`[Token Sync] Mengaktifkan cooldown selama ${cooldownDuration} detik untuk memulihkan IP limit.`);
      console.error(`[Token Sync] 💡 TIPS: Gunakan PROXY_SERVER di .env atau jalankan Google Chrome asli dengan flag --remote-debugging-port=9222.\n`);
      return "";
    }

    // Tangani Audio Challenge
    const audioBtn = bframe.locator("#recaptcha-audio-button");
    const witToken = getEnvValue("WITAI_ACCESS_TOKEN", "YP37OWAPEEWGZDIKUZS6SKS2H3IDOPB5");

    if (await audioBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log("[Token Sync] 🎧 Memilih Audio Challenge...");
      await page.waitForTimeout(1500 + Math.random() * 1500); // Jeda diam lebih lama seperti mikir
      await audioBtn.click({ delay: 50 + Math.random() * 100 });
      await page.waitForTimeout(3000 + Math.random() * 1000);

      // Cek apakah setelah klik audio tombol diblokir
      if (await dosBlock.isVisible({ timeout: 2000 }).catch(() => false)) {
        dosBlockCooldownUntil = Date.now() + 90000;
        console.error("[Token Sync] ⚠️ Google memblokir request audio challenge untuk IP ini (DOS limit). Cooldown 90s.");
        return "";
      }

      const downloadLink = bframe.locator(".rc-audiochallenge-tdownload-link");
      const audioSource = bframe.locator("#audio-source");
      let audioUrl = "";

      if (await downloadLink.isVisible().catch(() => false)) {
        audioUrl = await downloadLink.getAttribute("href").catch(() => "");
      } else if (await audioSource.isVisible().catch(() => false)) {
        audioUrl = await audioSource.getAttribute("src").catch(() => "");
      }

      if (audioUrl && witToken) {
        const solvedAnswer = await solveAudioChallenge(audioUrl, witToken);
        if (solvedAnswer) {
          console.log(`[Token Sync] 🎯 Wit.ai audio solved: "${solvedAnswer}"`);
          const inputField = bframe.locator("#audio-response");
          await inputField.focus();
          await page.waitForTimeout(500 + Math.random() * 500);

          // Ketik satu-satu seperti manusia (pressSequentially atau type)
          if (typeof inputField.pressSequentially === "function") {
            await inputField.pressSequentially(solvedAnswer, { delay: 100 + Math.random() * 150 });
          } else {
            await inputField.type(solvedAnswer, { delay: 100 + Math.random() * 150 });
          }
          await page.waitForTimeout(1000 + Math.floor(Math.random() * 1500));

          console.log("[Token Sync] Mengeklik tombol VERIFY...");
          const verifyBtn = bframe.locator("#recaptcha-verify-button");
          await verifyBtn.click({ delay: 50 + Math.random() * 100, force: true }).catch(() => { });
          // Fallback: Tekan Enter di dalam input field jika klik gagal
          await page.waitForTimeout(500);
          await inputField.press("Enter").catch(() => { });

          await page.waitForTimeout(3000);

          let retryCount = 0;
          let currentAudioUrl = audioUrl;

          while (retryCount < 5) {
            const errorMsg = await bframe.locator(".rc-audiochallenge-error-message").textContent().catch(() => "");
            // Jika pesan tidak ada atau kosong, berarti sukses (atau popup berubah)
            if (!errorMsg || !errorMsg.trim()) {
              break;
            }

            console.warn(`[Token Sync] ⚠️ Audio challenge error setelah submit: "${errorMsg.trim()}"`);
            console.log(`[Token Sync] 🔁 Mencoba audio challenge ulang dengan clip baru (Retry ${retryCount + 1}/5)...`);
            await page.waitForTimeout(1500);

            const retryAudioSource = bframe.locator("#audio-source");
            const retryDownloadLink = bframe.locator(".rc-audiochallenge-tdownload-link");
            let retryAudioUrl = "";
            
            if (await retryDownloadLink.isVisible().catch(() => false)) {
              retryAudioUrl = await retryDownloadLink.getAttribute("href").catch(() => "");
            } else if (await retryAudioSource.isVisible().catch(() => false)) {
              retryAudioUrl = await retryAudioSource.getAttribute("src").catch(() => "");
            }

            if (retryAudioUrl && retryAudioUrl !== currentAudioUrl) {
              currentAudioUrl = retryAudioUrl;
              const retryAnswer = await solveAudioChallenge(retryAudioUrl, witToken);
              if (retryAnswer) {
                console.log(`[Token Sync] 🎯 Retry Wit.ai audio solved: "${retryAnswer}"`);
                const retryInput = bframe.locator("#audio-response");
                await retryInput.focus();
                await page.waitForTimeout(500 + Math.random() * 500);
                if (typeof retryInput.pressSequentially === "function") {
                  await retryInput.pressSequentially(retryAnswer, { delay: 100 + Math.random() * 150 });
                } else {
                  await retryInput.type(retryAnswer, { delay: 100 + Math.random() * 150 });
                }
                await page.waitForTimeout(1000 + Math.floor(Math.random() * 1500));

                console.log("[Token Sync] Mengeklik tombol VERIFY (Retry)...");
                const retryVerifyBtn = bframe.locator("#recaptcha-verify-button");
                await retryVerifyBtn.click({ delay: 50 + Math.random() * 100, force: true }).catch(() => { });
                await page.waitForTimeout(500);
                await retryInput.press("Enter").catch(() => { });

                await page.waitForTimeout(3500);
              } else {
                console.warn("[Token Sync] ❌ Wit.ai gagal pada retry.");
                break;
              }
            } else {
              // Jika audio URL tidak berubah atau tidak ada, tidak bisa retry
              break;
            }
            retryCount++;
          }
        } else {
          console.warn("[Token Sync] ❌ Wit.ai tidak menghasilkan transkrip yang valid. Audio challenge gagal.");
        }
      }
    }

    token = await page.evaluate(() => {
      return typeof window.grecaptcha !== "undefined" && typeof window.grecaptcha.getResponse === "function"
        ? window.grecaptcha.getResponse()
        : document.getElementById("g-recaptcha-response")?.value || localStorage.getItem("_grecaptcha") || "";
    }).catch(() => "");

    if (token && token.length > 30) {
      console.log(`[Token Sync] ✅ reCAPTCHA terverifikasi! Token didapatkan.`);
      updateEnvToken(token);
      return token;
    }
  } catch (err) {
    console.error("[Token Sync] Error solveRecaptchaSafely:", err.message);
  } finally {
    if (browserOrContext && !isCDP) {
      await browserOrContext.close().catch(() => { });
    }
  }

  return "";
}

/**
 * Single-Flight Wrapper: Memastikan hanya 1 solver yang berjalan pada satu waktu
 */
function requestTokenWithMutex(bypassCache = false) {
  if (activeSolvePromise) {
    console.log("[Token Sync] 🔒 Solver sedang berjalan untuk request lain. Menunggu hasil...");
    return activeSolvePromise;
  }

  activeSolvePromise = solveRecaptchaSafely(bypassCache).finally(() => {
    activeSolvePromise = null;
  });

  return activeSolvePromise;
}

// ==============================================================================
// HTTP Server Daemon
// ==============================================================================

let globalCachedToken = "";
let globalCachedTokenTime = 0;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  // Endpoint 1: POST /token (bisa diabaikan, tapi untuk kompatibilitas kita buat push ke pool)
  if (req.method === "POST" && url.pathname === "/token") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const data = JSON.parse(body || "{}");
        const token = data.token || "";
        if (token) {
          updateEnvToken(token);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, message: "Token saved to pool" }));
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing token parameter" }));
        }
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  // Endpoint 2: GET /token -> Mengambil dan menghapus (POP) token dari antrean
  if (req.method === "GET" && url.pathname === "/token") {
    const tokenObj = tokenPool.shift(); // Ambil token paling atas
    
    if (tokenObj && tokenObj.token) {
      console.log(`[Token Sync] 📤 k6 mengambil token dari antrean. Sisa stok: ${tokenPool.length}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ token: tokenObj.token }));
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Pool empty" }));
    }
    return;
  }

  // Endpoint 3: GET /refresh -> Mengambil reCAPTCHA baru (dengan cache Daemon)
  if (req.method === "GET" && url.pathname.startsWith("/refresh")) {
    try {
      const now = Date.now();
      const urlParams = new URL(req.url, `http://${req.headers.host}`);
      const force = urlParams.searchParams.get("force") === "true";

      // Cache valid selama 115 detik
      const cacheAgeMs = now - globalCachedTokenTime;

      if (force) {
        // PENTING: Jika cache baru saja diperbarui (misal < 15 detik lalu), kemungkinan
        // besar itu adalah karena VU lain SUDAH force-refresh lebih dulu (semua VU
        // berbagi token yang sama sehingga mereka kena 422 di waktu yang hampir bersamaan).
        // Jangan invalidate & solve captcha LAGI — cukup reuse token fresh yang sudah ada.
        // Tanpa guard ini, 3 VU yang force=true dalam beberapa detik akan memicu
        // 3x solve captcha berturut-turut → memicu Google DOS cooldown.
        if (globalCachedToken && cacheAgeMs < 30000) {
          console.log(`[Token Sync Server] ℹ️ Force refresh diminta, tapi cache baru berumur ${(cacheAgeMs / 1000).toFixed(1)}s (kemungkinan VU lain sudah refresh, atau proses solve masih berlangsung saat 422 diterima). Reuse token fresh ini...`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ token: globalCachedToken }));
          return;
        }
        console.log("[Token Sync Server] ⚠️ Token ditolak server (422). Force refresh requested, invalidating cache...");
        globalCachedToken = "";
        globalCachedTokenTime = 0;
      } else if (globalCachedToken && cacheAgeMs < 115000) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token: globalCachedToken }));
        return;
      }

      if (now < dosBlockCooldownUntil) {
        const remaining = Math.ceil((dosBlockCooldownUntil - now) / 1000);
        console.log(`[Token Sync Server] ⏳ Menunggu Cooldown IP dari Google... (${remaining}s tersisa)`);
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Google DOS Cooldown Active", cooldown: true, remaining }));
        return;
      }

      console.log("[Token Sync Server] 🔄 Menerima request REFRESH token baru (Membuka Browser)...");
      const newToken = await requestTokenWithMutex(true);
      if (newToken) {
        globalCachedToken = newToken;
        globalCachedTokenTime = Date.now();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token: newToken }));
      } else {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Failed to solve CAPTCHA", cooldown: true }));
      }
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Endpoint 4: Record API Request & Response audit log
  if (req.method === "POST" && url.pathname === "/record") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const record = JSON.parse(body || "{}");
        record.recorded_at = new Date().toISOString();

        const jsonlPath = path.join(__dirname, "api_records.jsonl");
        fs.appendFileSync(jsonlPath, JSON.stringify(record) + "\n", "utf-8");

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

async function startTokenProductionLoop() {
  console.log("[Token Sync] 🏭 Memulai Background Token Producer Loop...");
  while (true) {
    try {
      // 1. Garbage Collection: Bersihkan token yang kedaluwarsa (> 105 detik)
      const now = Date.now();
      let expiredCount = 0;
      while (tokenPool.length > 0 && (now - tokenPool[0].timestamp > 105000)) {
        tokenPool.shift();
        expiredCount++;
      }
      if (expiredCount > 0) {
        console.log(`[Token Sync] 🗑️ Membuang ${expiredCount} token basi dari antrean.`);
      }

      // 2. Jika antrean belum penuh, produksi token baru
      if (tokenPool.length < MAX_POOL_SIZE) {
        if (now < dosBlockCooldownUntil) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }
        
        console.log(`[Token Sync] ⚙️ Memproduksi token baru... (Stok: ${tokenPool.length}/${MAX_POOL_SIZE})`);
        // Bypass cache true
        await requestTokenWithMutex(true);
        
        // Pacing: Jeda aman antar produksi (8-10 detik) untuk 1 IP
        const delayMs = 8000 + Math.random() * 2000;
        console.log(`[Token Sync] ⏳ Pacing: Jeda produksi selama ${(delayMs/1000).toFixed(1)} detik...`);
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        // Pool penuh, istirahat sejenak
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (e) {
      console.error("[Token Sync] Producer Loop Error:", e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Mulai Producer Loop (Nonaktif - diganti ke On-Demand lagi)
// startTokenProductionLoop();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Token Sync Server] 🚀 Berjalan di http://0.0.0.0:${PORT} (Single-Flight On-Demand Mode Active)`);
});
