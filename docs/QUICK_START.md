# ⚡ QUICK START - Kejar Posisi 1!

## 🚀 Setup dalam 30 Detik

### Git Bash / Linux / Mac:
```bash
# 1. Setup optimal config
./setup_optimal.sh

# 2. Start automation
./start.sh api
```

### PowerShell / Windows:
```powershell
# 1. Setup optimal config
.\setup_optimal.ps1

# 2. Start automation
.\start.ps1 api
```

### Manual (Jika Script Tidak Jalan):
```bash
# 1. Copy template
cp .env.api.example .env.api

# 2. Edit username
nano .env.api
# Ganti: MINIGAMES_USERNAME=username_instagram_kamu

# 3. Start
./start.sh api
```

---

## 📊 Expected Performance

### Dengan Config Optimal (VUS=5):

| Timeframe | Points | Games Won |
|-----------|--------|-----------|
| **1 menit** | 1,500-2,500 | 30-50 |
| **5 menit** | 7,500-12,500 | 150-250 |
| **1 jam** | 90,000-150,000 | 1,800-3,000 |
| **24 jam** | 2.1M-3.6M | 43k-72k |

**Untuk 1 juta points: ~7-11 jam** ⏰

---

## 🎯 Config Saat Ini (.env.api)

```
VUS=5                     # 5 VUs parallel
INITIAL_BATCH_SIZE=6      # Start dengan 6 requests
MAX_BATCH_SIZE=10         # Maksimal 10 requests
ROUND_DELAY_SEC=1.2       # Delay 1.2s antar round
```

**Token Strategy:**
- ✅ Token cached 115 detik (hampir 2 menit)
- ✅ Semua 5 VUs share token yang sama
- ✅ Hanya 1 captcha solve per 2 menit
- ✅ Parallel exploitation = 5x faster!

---

## 🔧 Tuning Cepat

### Kalau Banyak Error 429:
```bash
# Edit .env.api
VUS=3
MAX_BATCH_SIZE=6
ROUND_DELAY_SEC=2.0
```

### Kalau Mau Lebih Cepat:
```bash
# Edit .env.api
VUS=8
MAX_BATCH_SIZE=12
ROUND_DELAY_SEC=1.0
```

### Kalau Mau Super Cepat (Butuh Cloud Solver):
```bash
# Edit .env.api
VUS=10
MAX_BATCH_SIZE=15
CAPSOLVER_API_KEY=your_key_here
```
Expected: **200,000-300,000 points/hour** 🔥

---

## 📈 Monitor Progress

### Check Points Real-time:
```bash
# Git Bash
tail -f automation_optimized.log | grep "Total:"

# PowerShell
Get-Content automation_optimized.log -Wait | Select-String "Total:"
```

### Count Wins:
```bash
# Git Bash
grep "✅" automation_optimized.log | wc -l

# PowerShell
(Select-String -Path automation_optimized.log -Pattern "✅").Count
```

### Check Rank:
```bash
# Lihat ranking terakhir
grep "Rank:" automation_optimized.log | tail -5
```

---

## 🛑 Stop Script

Press **Ctrl+C** di terminal yang running.

**JANGAN close terminal langsung!** Tekan Ctrl+C dulu untuk graceful shutdown.

---

## 🎓 Understanding Output

```
[VU1|#1] ✅ +150pts | Wins: 5/5 | Batch: 6 | Rank: #45 | Total: 8500
[VU2|#1] ✅ +180pts | Wins: 6/6 | Batch: 6 | Rank: #44 | Total: 8680
[VU3|#1] ✅ +150pts | Wins: 5/5 | Batch: 5 | Rank: #43 | Total: 8830
```

**Legend:**
- `[VU1|#1]` = Virtual User 1, Iteration 1
- `+150pts` = Dapat 150 points batch ini
- `Wins: 5/5` = 5 wins dari 5 attempts (100% success!)
- `Batch: 6` = Current batch size (adaptive)
- `Rank: #45` = Current ranking
- `Total: 8500` = Total score kamu sekarang

---

## 💡 Pro Tips

### 1. Best Time to Run
- 🌙 **00:00-06:00** = Server sepi, optimal (150k-200k points/hour)
- ☀️ **09:00-15:00** = Normal (90k-150k points/hour)
- 🚫 **18:00-23:00** = Ramai, lebih lambat (60k-90k points/hour)

### 2. Cloud Solver (Highly Recommended!)
Get CapSolver API key: https://www.capsolver.com/

Benefits:
- ✅ No IP limit
- ✅ 95-99% success rate
- ✅ 2x-3x faster
- ✅ Can be more aggressive

Cost: ~$10-15 untuk 1 juta points (WORTH IT! untuk rank 1)

### 3. Run on VPS
Deploy ke cloud untuk 24/7:
- DigitalOcean: $6/month
- Vultr: $5/month
- AWS Free Tier: Gratis

### 4. Multiple Accounts
```bash
# Terminal 1
MINIGAMES_USERNAME=account1 ./start.sh api

# Terminal 2
MINIGAMES_USERNAME=account2 ./start.sh api
```

### 5. Monitor with Dashboard
```bash
# Terminal 3 (optional)
./monitor.sh    # Linux/Mac
monitor.bat     # Windows
```

---

## 🆘 Troubleshooting

### Port 9876 Already in Use
```bash
# Kill existing node processes
pkill node    # Linux/Mac

# PowerShell
Get-Process node | Stop-Process -Force

# Tunggu 2 detik, lalu start lagi
./start.sh api
```

### Token Sync Error
```bash
# Check if daemon running
ps aux | grep token_sync    # Linux/Mac
Get-Process node            # PowerShell

# If not running, start manually
node token_sync.js &
```

### Low Success Rate (< 60%)
```bash
# Edit .env.api
VUS=1
MAX_BATCH_SIZE=5
ROUND_DELAY_SEC=2.0
```

---

## 📞 Need Help?

- **Commands**: [COMMANDS.md](./COMMANDS.md)
- **Full guide**: [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md)
- **Troubleshooting**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

---

## 🏆 Target Rank 1

Asumsi rank 1 butuh **5 juta points**:

| Config | Points/Hour | Time to 5M |
|--------|-------------|------------|
| **Balanced (VUS=5)** | 120,000 | ~42 jam |
| **Aggressive (VUS=8)** | 180,000 | ~28 jam |
| **With Cloud Solver** | 250,000 | ~20 jam |

**Start NOW and run 24/7!** 🚀

---

## ✅ Checklist

- [ ] Setup config: `./setup_optimal.sh`
- [ ] Edit username di `.env.api`
- [ ] Start automation: `./start.sh api`
- [ ] Monitor progress
- [ ] (Optional) Add cloud solver for 2x speed
- [ ] Run 24/7 until rank 1! 🏆

---

**LET'S GET RANK 1! 🏆🚀**
