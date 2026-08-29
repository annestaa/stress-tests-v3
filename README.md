# 🚀 Minigames Kemerdekaan Automation (Node.js + Stealth)

Automation script tingkat lanjut untuk *farming* poin Minigames Kemerdekaan Liputan6 (`tariktambang`, `panjatpinang`, `balapkarung`). Versi terbaru ini telah dirombak penuh ke ekosistem **Native Node.js** dengan integrasi **Playwright Stealth**, dirancang khusus untuk ketahanan 24/7 di VPS maupun komputer lokal.

---

## 🌟 Fitur Unggulan

1. **Jubah Siluman (Stealth Mode)**
   Menggunakan `playwright-extra` dan `puppeteer-extra-plugin-stealth` untuk menyamarkan pergerakan bot agar terlihat seperti manusia sungguhan di mata Google reCAPTCHA.
2. **Auto-Sleep & Google DOS Protection**
   Bot mampu mendeteksi pemblokiran IP sementara (Cooldown/DOS Limit) dari Google. Jika terdeteksi, bot akan otomatis istirahat (tidur) dan mencoba lagi nanti secara perlahan tanpa membuat *crash* atau *error*.
3. **Adaptive Auto-Stagger (Pintar)**
   Dilengkapi sensor kemacetan antrean. Jika server Liputan6 sedang lemot (karena *stress-test* atau *traffic* padat), bot akan secara otomatis melambatkan tempo tembakan (ngerem) agar poin tidak terdegradasi (tetap mendapatkan +50 pts).
4. **Arsitektur Dual-Daemon**
   Dipisah menjadi 2 bagian yang berkomunikasi satu sama lain:
   - `token_sync.js`: Pencari token Captcha.
   - `play_node.js`: Penembak skor game.
5. **Siap VPS (Dockerized)**
   Tinggal jalankan `docker-compose up -d --build`, bot langsung berjalan mulus di *background* server selamanya.

---

## 📂 Struktur File Utama

- **`play_node.js`**: Otak utama penembak *Direct API* (Node.js native).
- **`token_sync.js`**: Server penyedia Token (Playwright Stealth).
- **`start_node.bat`**: Script 1-klik untuk menjalankan di Windows (Lokal).
- **`docker-compose.yml` & `Dockerfile`**: File konfigurasi untuk *deploy* ke VPS.
- **`.env.api`**: File konfigurasi (Username, Target Target, dll).
- **`play.js` / `play_pipeline.js`**: (*Legacy*) Script lama bagi yang masih ingin menggunakan k6.
- **`docs/`**: Kumpulan dokumen teknis dan sejarah optimisasi script lama.

---

## ⚙️ Konfigurasi (`.env.api`)

Pastikan Anda mengedit file `.env.api` sebelum menjalankan bot:

```env
MINIGAMES_USERNAME=username_anda_disini
GAME_CHOICE=tariktambang
TARGET_DURATION_SEC=7.8
REQUEST_STAGGER_SEC=0.5
```
*(Catatan: `TARGET_DURATION_SEC=7.8` disengaja agar tidak terlalu cepat dan poin tidak ditolak).*

---

## 🚀 Cara Menjalankan

### Opsi A: Menjalankan di Windows (Lokal Laptop)
Sangat direkomendasikan jika Anda tidak punya VPS.

1. Buka Terminal/CMD, ketik: `npm install`
2. Klik ganda (Double-Click) file **`start_node.bat`**.
3. Dua jendela layar hitam akan terbuka otomatis, biarkan saja mereka bekerja!

### Opsi B: Menjalankan di VPS (Linux / Ubuntu)
Cocok untuk *farming* 24 jam non-stop sambil Anda tidur.

1. Buka Terminal VPS Anda, navigasikan ke folder script ini.
2. Pastikan Docker sudah terinstall di VPS Anda.
3. Jalankan perintah dewa ini:
   ```bash
   docker-compose up -d --build
   ```
4. Selesai! Bot akan jalan di *background*.
5. *Untuk melihat jalannya bot (Log):* `docker logs -f bot-game-pipeline`

---

## ⚠️ Disklaimer & Aturan Main
* Penggunaan bot/script automation pada platform game *online* bisa melanggar Syarat dan Ketentuan layanan. Gunakan untuk tujuan **edukasi dan stress-testing** saja.
* Developer tidak bertanggung jawab atas akun yang di-*banned* atau diblokir. *Do it at your own risk!*
