# 📡 Dokumentasi Spesifikasi API Mini Games Kemerdekaan Liputan6

Dokumentasi lengkap seluruh endpoint HTTP REST API yang digunakan untuk memainkan 3 Mini Games (**Tarik Tambang**, **Panjat Pinang**, **Balap Karung**) secara otomatis, serentak, dan termonitor.

---

## 🗺️ Ringkasan Endpoint

| Endpoint | Method | Fungsi | Autentikasi / Proteksi |
| :--- | :---: | :--- | :--- |
| `GET /games/{game}` | `GET` | Mengakses halaman frontend mini game | Publik |
| `GET /api/games/terms` | `GET` | Mengambil data syarat & ketentuan event | Publik |
| `GET /api/games/ads` | `GET` | Mengambil konfigurasi sponsor & banner iklan | Publik |
| `POST /api/games/{game}/sessions` | `POST` | Membuka sesi permainan baru | **reCAPTCHA v2 Token** (`g-recaptcha-response`) |
| `POST /api/games/{game}/scores` | `POST` | Mengirimkan skor akhir permainan | **Session Token** (`token`) + Anti-Cheat |
| `GET /api/games/leaderboard` | `GET` | Mengambil klasemen dan peringkat live peserta | Publik |

---

## 📋 Detail Endpoint API

### 1. Membuka Sesi Permainan (`Open Session`)
Digunakan oleh klien game sesaat sebelum permainan dimulai (ketika tombol *"Ayo Main"* ditekan).

- **URL**: `POST https://kemerdekaan.liputan6.com/api/games/{game}/sessions`
- **Path Parameter**:
  - `game`: `tariktambang` | `panjatpinang` | `balapkarung`
- **Headers**:
  ```http
  Content-Type: application/json
  Accept: application/json
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36
  Origin: https://kemerdekaan.liputan6.com
  Referer: https://kemerdekaan.liputan6.com/games/{game}
  ```
- **Request Body**:
  ```json
  {
    "username": "zildjiannesta",
    "g-recaptcha-response": "09AKhCRwhN1tNvTvScIgdw1YKatGT9Qgk6Jr..."
  }
  ```
- **Response Success (`HTTP 201 Created`)**:
  ```json
  {
    "token": "JwvjSjqHXj7KC0iomHqBSN50WUWYmlAqFqDrkqQN3a3OHDVCy5VUxw6W1c5LyPse",
    "started_at": "2026-08-14T19:21:35+07:00",
    "duration": 30,
    "username": "zildjiannesta"
  }
  ```
- **Response Error (`HTTP 422 Unprocessable Content`)**:
  ```json
  {
    "message": "The g-recaptcha-response field is required.",
    "errors": {
      "g-recaptcha-response": [
        "The g-recaptcha-response field is required."
      ]
    }
  }
  ```
- **Response Rate Limit (`HTTP 429 Too Many Requests`)**:
  ```json
  {
    "message": "Too Many Attempts."
  }
  ```

---

### 2. Pengiriman Skor & Poin Permainan (`Submit Score`)
Dikirim setelah permainan selesai (baik menang maupun kalah) untuk mencatat perolehan poin dan durasi waktu bermain ke leaderboard.

- **URL**: `POST https://kemerdekaan.liputan6.com/api/games/{game}/scores`
- **Path Parameter**:
  - `game`: `tariktambang` | `panjatpinang` | `balapkarung`
- **Headers**:
  ```http
  Content-Type: application/json
  Accept: application/json
  User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36
  Origin: https://kemerdekaan.liputan6.com
  Referer: https://kemerdekaan.liputan6.com/games/{game}
  ```
- **Request Body**:
  ```json
  {
    "token": "JwvjSjqHXj7KC0iomHqBSN50WUWYmlAqFqDrkqQN3a3OHDVCy5VUxw6W1c5LyPse",
    "is_win": true,
    "time_left": 22
  }
  ```
- **Response Success (`HTTP 201 Created`)**:
  ```json
  {
    "score": {
      "points": 50,
      "is_win": true,
      "duration_ms": 7000,
      "game": "tariktambang"
    },
    "standing": {
      "rank": 12,
      "prize_rank": null,
      "already_won": false,
      "player_id": 1420,
      "total_score": 5880,
      "total_plays": 125
    }
  }
  ```
- **Aturan Validasi Anti-Cheat Server**:
  1. Durasi bermain harus $\ge 7.0$ detik sejak sesi dibuka (`duration_ms >= 7000`).
  2. Nilai `time_left` harus logis dan sesuai dengan batas maksimal timer (30 detik).
  3. `token` sesi hanya berlaku untuk satu kali submission (single use).

---

### 3. Klasemen & Peringkat Pemain (`Leaderboard API`)
Mengambil statistik klasemen periode berjalan dan posisi pemain.

- **URL**: `GET https://kemerdekaan.liputan6.com/api/games/leaderboard`
- **Query Parameter (Opsional)**:
  - `username`: username pemain untuk mengambil posisi spesifik
- **Headers**:
  ```http
  Accept: application/json
  ```
- **Response Success (`HTTP 200 OK`)**:
  ```json
  {
    "period": {
      "id": 2,
      "name": "Periode 2: 8–14 Agustus 2026",
      "start_at": "2026-08-08T00:00:00+07:00",
      "end_at": "2026-08-14T23:59:59+07:00"
    },
    "board": [
      {
        "rank": 1,
        "username": "alvan_maulana99",
        "total_score": 404420,
        "total_plays": 8169
      },
      {
        "rank": 2,
        "username": "fatin_agustin",
        "total_score": 273440,
        "total_plays": 5493
      },
      {
        "rank": 3,
        "username": "alifhr_",
        "total_score": 272150,
        "total_plays": 6333
      },
      {
        "rank": 12,
        "username": "kbrnugroho",
        "total_score": 5880,
        "total_plays": 125
      }
    ]
  }
  ```

---

### 4. Syarat & Ketentuan (`Terms API`)
- **URL**: `GET https://kemerdekaan.liputan6.com/api/games/terms`
- **Response (`HTTP 200 OK`)**: Mengembalikan HTML modal syarat & ketentuan resmi perlombaan kemerdekaan.

---

### 5. Iklan & Sponsor (`Ads API`)
- **URL**: `GET https://kemerdekaan.liputan6.com/api/games/ads`
- **Response (`HTTP 200 OK`)**: Mengembalikan array URL banner sponsor event kemerdekaan.

---

## 📁 File Audit Log Rekaman API

Semua request dan response dari eksekusi 3 game (300 ronde) secara real-time dicatat ke dalam:
- **`k6/api_records.jsonl`**: Format baris JSON (*JSON Lines*) untuk setiap request & response HTTP.
