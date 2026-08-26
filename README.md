# 🚀 Mini Games Kemerdekaan Automation with k6 (Anti-Ban Optimized)

Script automation dan load testing untuk game kemerdekaan Liputan6 (`tariktambang`, `panjatpinang`, `balapkarung`) menggunakan **k6** yang dilengkapi dengan **Anti-Ban Guard, Single-Flight Solver Daemon, Persistent Context, dan Multi-Strategy reCAPTCHA Resolver**.

---

## 📂 Struktur File

- [token_sync.js]: Daemon lokal anti-ban dengan **Single-Flight Mutex Lock**, **Token Caching**, **Deteksi DOS Captcha**, **CDP Chrome Attachment**, **Persistent Profile**, dan **Proxy Routing**.
- [play.js]: Script otomasi protokol **Direct HTTP API** dengan **Jitter Delay Anti-Bot**, exponential backoff, dan penanganan rate limit 422/429.
- [browser_play.js]: Script otomasi **Browser UI Headless** (`k6/browser`) dengan humanized mouse movement, storage preservation, dan audio solver.
- [.env.api]: Konfigurasi khusus untuk **Direct HTTP API** (`play.js`).
- [.env.browser]: Konfigurasi khusus untuk **Browser UI Automation** (`browser_play.js`).
- [.env]: Konfigurasi shared/fallback.
- [.env.api.example] & [.env.browser.example]: Template konfigurasi masing-masing mode.

---

## 🛡️ Strategi Anti-Ban & Pencegahan Blokir IP Google

Google reCAPTCHA v2 membatasi request audio challenge per IP jika mendeteksi spamming atau browser otomatis tanpa reputasi. Script ini menerapkan 5 lapis proteksi:

1. **Single-Flight Solver Mutex**:
   - Jika beberapa worker k6 membutuhkan token reCAPTCHA secara bersamaan, daemon **hanya meluncurkan 1 solver**. Worker lain akan mengantre dan menunggu hasil token yang sama, mencegah serangan multi-browser serentak ke Google.
2. **Persistent Context & CDP Connect (1-Click Pass)**:
   - Daemon dapat terhubung langsung ke browser Google Chrome utama yang sedang aktif via Chrome DevTools Protocol (`CDP_URL=http://127.0.0.1:9222`). Browser dengan cookies & login Google aktif akan mendapatkan **centang hijau 1-klik** tanpa memicu audio challenge sama sekali.
3. **Deteksi DOS Captcha & Cooldown Otomatis**:
   - Jika Google menampilkan pesan *"Your computer or network may be sending automated queries"*, script secara otomatis mengaktifkan **cooldown (90 detik)** agar limit IP pulih dan tidak diblokir permanen.
4. **Cloud Solver Prioritization (100% Bebas IP Ban)**:
   - Jika Anda mengisi `CAPSOLVER_API_KEY` atau `TWOCAPTCHA_API_KEY`, seluruh request verifikasi reCAPTCHA akan didelegasikan ke cloud proxy pool eksternal, sehingga IP lokal Anda sama sekali tidak pernah menyentuh Google reCAPTCHA.
5. **Humanized Delays & Jitter**:
   - Jeda acak (*jitter*) diterapkan di antara ronde (`ROUND_DELAY_SEC + Math.random() * 2s`) dan pergerakan mouse acak pada mode browser.

---

## ⚙️ Konfigurasi Lengkap (`.env`)

| Variabel | Deskripsi | Default / Contoh |
| :--- | :--- | :--- |
| `MINIGAMES_USERNAME` | Username Instagram peserta | `zildjiannesta` |
| `GAME_CHOICE` | Pilihan game (`all`, `tariktambang`, `panjatpinang`, `balapkarung`) | `tariktambang` |
| `VUS` | Jumlah Virtual Users paralel di k6 (**Rekomendasi anti-ban: 1**) | `1` |
| `LOOP_COUNT` | Jumlah ronde per VU | `100` |
| `ROUND_DELAY_SEC` | Jeda dasar antar ronde (detik) | `3` |
| `CAPTCHA_MIN_INTERVAL_SEC`| Interval minimum antar eksekusi solver lokal | `6` |
| `CAPTCHA_DOS_COOLDOWN_SEC`| Durasi cooldown saat Google membatasi IP | `90` |
| `CDP_URL` | Alamat remote debugging Google Chrome asli | `http://127.0.0.1:9222` |
| `PROXY_SERVER` / `HTTP_PROXY` | Proxy HTTP/SOCKS5 untuk merotasi IP | *(opsional)* |
| `CAPSOLVER_API_KEY` | API Key CapSolver (Cloud Proxy Solver) | *(opsional)* |
| `TWOCAPTCHA_API_KEY` | API Key 2Captcha (Cloud Solver) | *(opsional)* |
| `WITAI_ACCESS_TOKEN` | Token Speech-to-Text Wit.ai untuk audio captcha | *(terpasang)* |

---

## 🚀 Cara Menjalankan

### Opsi A: Mode Google Chrome CDP (Paling Aman dari Ban IP)
1. Buka Google Chrome asli dengan port debugging di terminal:
   ```bash
   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
   ```
2. Jalankan bot k6:
   ```bash
   cd k6
   ./start.sh api
   ```

### Opsi B: Mode Direct HTTP API Standalone
```bash
cd k6
./start.sh api
```

### Opsi C: Mode Browser UI Headless (k6/browser)
```bash
cd k6
./start.sh browser
```
