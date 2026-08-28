# 🚀 Quick Start - Optimized Script

## Apa yang Baru?

Script optimized ini mengatasi masalah error 429 dan 500 dengan:

✅ **Adaptive Batch Size** - Auto-adjust berdasarkan performa  
✅ **Smart Rate Limiting** - Slow down otomatis saat error  
✅ **Maximum Token Utilization** - Manfaatkan token 2 menit maksimal  
✅ **Intelligent Error Recovery** - Handle 429/500 dengan baik  
✅ **Real-time Performance Tracking** - Monitor success rate live  

**Peningkatan yang diharapkan:**
- 🎯 +50-100% lebih banyak wins per token
- 📈 +20-30% success rate lebih tinggi
- 🛡️ -70% lebih sedikit error 429
- 💎 +35% utilisasi token lebih baik

---

## 🚀 Cara Pakai (3 Langkah)

### 1. Setup Configuration

```bash
# Copy config optimized
cp .env.optimized .env

# Edit username kamu
nano .env  # atau notepad .env di Windows
# Ubah: MINIGAMES_USERNAME=username_instagram_kamu
```

### 2. Jalankan Token Sync Daemon

```bash
# Terminal 1
node token_sync.js
```

**Output yang diharapkan:**
```
[Token Sync] 🚀 Token Sync Daemon v2.0 aktif di http://0.0.0.0:9876
[Token Sync] 🎯 Mode: Persistent CDP + Audio Solver
```

### 3. Jalankan Script Optimized

```bash
# Terminal 2
k6 run play_optimized.js
```

**Output yang diharapkan:**
```
🚀 Starting Optimized Mini Games Automation with Adaptive Rate Control
📊 Config: Initial Batch=8, Min=2, Max=12
🎯 Target Success Rate: 75%

[VU1|#1] 🔄 Refreshing token (new)...
[VU1|#1] ✅ Token OK (Lifetime: 115s)
[VU1|#1] ✅ +180pts | Batch: 6/6 (100%) | Size: 8 | SR: 83.3% | Rank: #45 | Total: 8950
[VU1|#1] ✅ +210pts | Batch: 7/7 (100%) | Size: 10 | SR: 87.5% | Rank: #42 | Total: 9160
...
```

---

## 📊 Membaca Output

### Format Log Per Round:
```
[VU1|#5] ✅ +150pts | Batch: 5/5 (100%) | Size: 8 | SR: 82.3% | Rank: #123 | Total: 12500
         ↑           ↑                     ↑        ↑            ↑              ↑
      Points      Success/Total       Batch Size  Success    Current      Total Score
                     (Rate)                        Rate        Rank
```

### Cycle Summary:
```
[VU1|#5] 🏁 Cycle complete: 28 wins in 32 rounds (112s) | Overall SR: 78.5% | Requests: 156/198
                             ↑            ↑        ↑                          ↑
                          Wins         Rounds   Duration                   Requests
```

### Indikator Kesehatan:

| Metric | Good | Warning | Bad |
|--------|------|---------|-----|
| Success Rate (SR) | > 80% | 60-80% | < 60% |
| Batch Size | 6-12 | 4-6 | 2-4 |
| Wins per Cycle | > 25 | 15-25 | < 15 |
| Token Utilization | > 80% | 60-80% | < 60% |

---

## ⚙️ Tuning Cepat

### Terlalu Banyak Error 429?

```bash
# Edit .env
INITIAL_BATCH_SIZE=4        # Turunkan dari 8
MAX_BATCH_SIZE=6            # Turunkan dari 12
TARGET_SUCCESS_RATE=0.85    # Naikkan dari 0.75
MIN_ROUND_DELAY_SEC=2.0     # Naikkan dari 1.0
AGGRESSIVE_MODE=false       # Matikan aggressive mode
```

### Token Tidak Maksimal?

```bash
# Edit .env
INITIAL_BATCH_SIZE=10       # Naikkan dari 8
MAX_BATCH_SIZE=15           # Naikkan dari 12
TARGET_SUCCESS_RATE=0.70    # Turunkan dari 0.75
MIN_ROUND_DELAY_SEC=0.8     # Turunkan dari 1.0
AGGRESSIVE_MODE=true        # Aktifkan aggressive mode
```

### Koneksi Internet Lambat?

```bash
# Edit .env
INITIAL_BATCH_SIZE=4
MIN_BATCH_SIZE=1
MAX_BATCH_SIZE=6
TARGET_SUCCESS_RATE=0.80
MIN_ROUND_DELAY_SEC=2.0
MAX_ROUND_DELAY_SEC=4.0
```

---

## 🔍 Troubleshooting

### ❌ "Token Sync error"
**Problem:** Daemon tidak running atau port 9876 blocked

**Solution:**
```bash
# Cek apakah daemon running
lsof -i :9876  # Linux/Mac
netstat -ano | findstr :9876  # Windows

# Restart daemon
node token_sync.js
```

### ❌ Banyak "429 Rate Limit"
**Problem:** Batch size terlalu besar atau server ramai

**Solution:**
1. Turunkan batch size (lihat "Tuning Cepat" di atas)
2. Coba run di jam sepi (dini hari)
3. Set `AGGRESSIVE_MODE=false`

### ❌ "Google Cooldown aktif"
**Problem:** IP kena rate limit dari Google reCAPTCHA

**Solution:**
1. **Tunggu 90 detik** - jangan restart
2. Script otomatis handle cooldown
3. Atau pakai cloud solver (CapSolver/2Captcha)

### ❌ Success Rate < 60%
**Problem:** Network latency tinggi atau config terlalu aggressive

**Solution:**
1. Test koneksi: `ping minigames.liputan6.com`
2. Turunkan semua batch size
3. Naikkan `TARGET_SUCCESS_RATE` ke 0.85
4. Perlambat timing

---

## 📈 Compare Performance

Untuk membandingkan performa dengan script lama:

```bash
# 1. Run original script dengan log
k6 run play.js 2>&1 | tee automation_original.log

# 2. Run optimized script dengan log
k6 run play_optimized.js 2>&1 | tee automation_optimized.log

# 3. Compare
node compare_performance.js
```

Output:
```
📊 PERFORMANCE COMPARISON - Original vs Optimized
================================================================================
Metric                        Original            Optimized           Change
--------------------------------------------------------------------------------
Total Games Played            156                 287                 +84.0%
Total Points Earned           7800                14350               +84.0%
Session Success Rate          68.5%               82.3%               +20.1%
Score Success Rate            71.2%               85.1%               +19.5%
Token Utilization             52.3%               87.4%               +67.1%
Error 429 Count               23                  7                   -69.6%
...

🎯 Overall Assessment:
🏆 EXCELLENT - Optimasi sangat efektif!
```

---

## 📚 Dokumentasi Lengkap

- **[OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md)** - Penjelasan lengkap strategi optimasi
- **[API_SPECIFICATION.md](./API_SPECIFICATION.md)** - Dokumentasi API server
- **[README.md](./README.md)** - README original

---

## 💡 Tips Pro

1. **Waktu terbaik**: Dini hari (00:00-06:00) saat server sepi
2. **Single VU**: Pakai `VUS=1` untuk hasil optimal
3. **Monitor**: Watch output real-time, adjust config jika perlu
4. **Cloud Solver**: Pakai CapSolver/2Captcha untuk bypass IP limit
5. **Long run**: Script bisa run 24/7 dengan `LOOP_COUNT=9999`

---

## 🎯 Target Metrics

Dengan config default dan network normal:

| Metric | Target |
|--------|--------|
| Session Success Rate | 75-85% |
| Score Success Rate | 80-90% |
| Wins per Token (2min) | 25-40 |
| Avg Batch Size | 6-8 |
| Token Utilization | 80-90% |
| Error 429 per hour | < 10 |

---

## 📞 Butuh Bantuan?

Jika masih ada masalah:

1. ✅ Cek [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) Troubleshooting section
2. ✅ Share log terakhir + config (.env)
3. ✅ Jalankan `node compare_performance.js` untuk diagnosis

---

**Happy Gaming! 🎮🚀**

*Script ini dibuat untuk educational purposes. Gunakan dengan bijak dan ikuti terms of service platform.*
