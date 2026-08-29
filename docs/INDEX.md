# 📚 Documentation Index

## 🚀 Quick Start (Start Here!)

1. **[README_OPTIMIZED.md](./README_OPTIMIZED.md)** ⭐
   - 3-step setup guide
   - Quick configuration
   - First-time user friendly
   - **Start here if you're new!**

2. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** 📋
   - Commands cheat sheet
   - Config presets
   - Troubleshooting flowchart
   - **Keep this handy for daily use**

---

## 📖 Complete Documentation

### Core Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md)** | Complete optimization guide | When you want to understand how everything works |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | System architecture & diagrams | For technical understanding |
| **[CHANGELOG_OPTIMIZATION.md](./CHANGELOG_OPTIMIZATION.md)** | What changed and why | To understand improvements |
| **[API_SPECIFICATION.md](./API_SPECIFICATION.md)** | API documentation | For API details |
| **[WITAI_TOKEN_INFO.md](./WITAI_TOKEN_INFO.md)** | Wit.ai token info | Token sudah include! |

### Original Documentation

| Document | Purpose |
|----------|---------|
| **[README.md](./README.md)** | Original project README |

---

## 🎯 By Use Case

### "I want to get started quickly"
→ [README_OPTIMIZED.md](./README_OPTIMIZED.md)  
→ [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

### "I'm getting too many errors"
→ [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) - Troubleshooting section  
→ [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Error messages table

### "I want to understand the algorithm"
→ [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) - Advanced section  
→ [ARCHITECTURE.md](./ARCHITECTURE.md) - Algorithm diagrams

### "Where is Wit.ai token?"
→ [WITAI_TOKEN_INFO.md](./WITAI_TOKEN_INFO.md) - Token info (already included!)

### "I want to tune for maximum performance"
→ [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) - Tuning section  
→ [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Config presets

### "I want to compare performance"
→ [CHANGELOG_OPTIMIZATION.md](./CHANGELOG_OPTIMIZATION.md) - Metrics comparison  
→ Use `node compare_performance.js`

---

## 🛠️ Tools & Scripts

### Main Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| **`play_optimized.js`** | Main optimized automation | `k6 run play_optimized.js` |
| **`token_sync.js`** | Token solver daemon | `node token_sync.js` |
| **`play.js`** | Original script (for comparison) | `k6 run play.js` |

### Helper Tools

| Tool | Purpose | Usage |
|------|---------|-------|
| **`auto_tune.cjs`** | Generate optimal config | `node auto_tune.cjs` |
| **`compare_performance.js`** | Compare old vs new | `node compare_performance.js` |
| **`monitor.sh`** / **`monitor.bat`** | Real-time monitoring | `./monitor.sh` or `monitor.bat` |

### Configuration Files

| File | Purpose |
|------|---------|
| **`.env.optimized`** | Template optimal config |
| **`.env.auto`** | Auto-generated config (from auto_tune.cjs) |
| **`.env`** | Your active config |

---

## 📊 File Size Guide

| Document | Size | Reading Time |
|----------|------|--------------|
| README_OPTIMIZED.md | ~5 KB | 5-10 min |
| QUICK_REFERENCE.md | ~8 KB | 5-10 min |
| OPTIMIZATION_GUIDE.md | ~35 KB | 30-45 min |
| ARCHITECTURE.md | ~15 KB | 15-20 min |
| CHANGELOG_OPTIMIZATION.md | ~18 KB | 15-25 min |

---

## 🎓 Learning Path

### Beginner Path (15 minutes)
1. Read [README_OPTIMIZED.md](./README_OPTIMIZED.md) (10 min)
2. Run `node auto_tune.cjs` (2 min)
3. Start automation (3 min)

### Intermediate Path (45 minutes)
1. Read [README_OPTIMIZED.md](./README_OPTIMIZED.md) (10 min)
2. Read [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) (10 min)
3. Skim [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) - Strategies section (15 min)
4. Run and tune (10 min)

### Advanced Path (2 hours)
1. Read [README_OPTIMIZED.md](./README_OPTIMIZED.md) (10 min)
2. Read [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) fully (45 min)
3. Read [ARCHITECTURE.md](./ARCHITECTURE.md) (20 min)
4. Read [CHANGELOG_OPTIMIZATION.md](./CHANGELOG_OPTIMIZATION.md) (20 min)
5. Experiment and optimize (25 min)

---

## 🔍 Quick Find

### Commands
- How to start? → [README_OPTIMIZED.md](./README_OPTIMIZED.md#-cara-pakai-3-langkah)
- All commands? → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#-commands-cheat-sheet)

### Configuration
- Quick config presets? → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#️-configuration-quick-reference)
- Tuning guide? → [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md#-tuning-untuk-kondisi-berbeda)
- Auto-generate? → Run `node auto_tune.cjs`

### Troubleshooting
- Error messages? → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#-error-messages--solutions)
- Detailed troubleshooting? → [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md#-troubleshooting)
- Flowchart? → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#-troubleshooting-flowchart)

### Understanding
- How does it work? → [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md#-strategi-optimasi)
- Algorithm details? → [ARCHITECTURE.md](./ARCHITECTURE.md#adaptive-rate-control-algorithm)
- What changed? → [CHANGELOG_OPTIMIZATION.md](./CHANGELOG_OPTIMIZATION.md#-key-algorithm-changes)

### Performance
- Expected results? → [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md#-expected-performance)
- Benchmarks? → [CHANGELOG_OPTIMIZATION.md](./CHANGELOG_OPTIMIZATION.md#-performance-improvements)
- Compare my results? → Run `node compare_performance.js`

---

## 📁 File Structure

```
stress-tests-v3/
├── 📄 Documentation
│   ├── README.md                      # Original README
│   ├── README_OPTIMIZED.md            # ⭐ Start here
│   ├── QUICK_REFERENCE.md             # 📋 Cheat sheet
│   ├── OPTIMIZATION_GUIDE.md          # 📖 Complete guide
│   ├── ARCHITECTURE.md                # 🏗️ Technical details
│   ├── CHANGELOG_OPTIMIZATION.md      # 📝 What's new
│   ├── API_SPECIFICATION.md           # 📡 API docs
│   └── INDEX.md                       # 📚 This file
│
├── 🚀 Main Scripts
│   ├── play_optimized.js              # New optimized script
│   ├── play.js                        # Original script
│   ├── token_sync.js                  # Token daemon
│   └── browser_play.js                # Browser automation
│
├── 🛠️ Tools
│   ├── auto_tune.cjs                   # Config generator
│   ├── compare_performance.js         # Performance analyzer
│   ├── monitor.sh                     # Real-time monitor (Linux/Mac)
│   └── monitor.bat                    # Real-time monitor (Windows)
│
├── ⚙️ Configuration
│   ├── .env.optimized                 # Template config
│   ├── .env.auto                      # Auto-generated config
│   ├── .env                           # Your active config
│   └── package.json                   # Dependencies
│
└── 📊 Output
    ├── automation_optimized.log       # Main log
    ├── token_sync.log                 # Token daemon log
    ├── api_records.jsonl              # API audit log
    └── performance_report.json        # Performance report
```

---

## 🎯 Common Tasks

### Setup for First Time
```bash
# 1. Generate config
node auto_tune.cjs

# 2. Copy and edit
cp .env.auto .env
nano .env  # Change MINIGAMES_USERNAME

# 3. Start daemon
node token_sync.js &

# 4. Run automation
k6 run play_optimized.js 2>&1 | tee automation_optimized.log
```
📖 Full guide: [README_OPTIMIZED.md](./README_OPTIMIZED.md#-cara-pakai-3-langkah)

### Tune Configuration
```bash
# Option 1: Auto-tune based on network/server
node auto_tune.cjs

# Option 2: Interactive tuning
node auto_tune.cjs --interactive

# Option 3: Manual tuning
nano .env  # Edit values
```
📖 Full guide: [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md#-tuning-untuk-kondisi-berbeda)

### Monitor Performance
```bash
# Terminal 1: Run automation
k6 run play_optimized.js 2>&1 | tee automation_optimized.log

# Terminal 2: Monitor real-time
./monitor.sh  # or monitor.bat on Windows
```
📖 Full guide: [README_OPTIMIZED.md](./README_OPTIMIZED.md#-membaca-output)

### Compare Results
```bash
# 1. Run both scripts with logging
k6 run play.js 2>&1 | tee automation_original.log
k6 run play_optimized.js 2>&1 | tee automation_optimized.log

# 2. Compare
node compare_performance.js
```
📖 Full guide: [README_OPTIMIZED.md](./README_OPTIMIZED.md#-compare-performance)

### Fix Errors
```bash
# High 429 errors?
# Edit .env:
#   INITIAL_BATCH_SIZE=4
#   MAX_BATCH_SIZE=6
#   TARGET_SUCCESS_RATE=0.85
#   AGGRESSIVE_MODE=false

# Low success rate?
# Edit .env:
#   TARGET_SUCCESS_RATE=0.85
#   MIN_ROUND_DELAY_SEC=2.0

# Token underutilized?
# Edit .env:
#   INITIAL_BATCH_SIZE=10
#   MAX_BATCH_SIZE=15
#   AGGRESSIVE_MODE=true
```
📖 Full guide: [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md#-troubleshooting)

---

## 🆘 Getting Help

### Self-Help Resources (Recommended Order)

1. **Quick Reference** → [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
   - Error messages table
   - Troubleshooting flowchart
   - Quick fixes

2. **Optimization Guide** → [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md)
   - Detailed troubleshooting
   - Configuration tuning
   - Advanced tips

3. **Auto-Tune Tool** → `node auto_tune.cjs`
   - Auto-detect issues
   - Generate optimal config
   - Interactive help

4. **Compare Tool** → `node compare_performance.js`
   - Analyze your performance
   - Get recommendations
   - Identify bottlenecks

### Reporting Issues

When asking for help, provide:
1. Output from `node auto_tune.cjs`
2. Your `.env` config (hide API keys!)
3. Last 50 lines of log
4. Output from `node compare_performance.js` if available

---

## 📌 Bookmarks

**Daily Use:**
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Keep open for reference
- [README_OPTIMIZED.md](./README_OPTIMIZED.md) - Quick setup reminders

**Troubleshooting:**
- [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md#-troubleshooting)
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md#-troubleshooting-flowchart)

**Understanding:**
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md#-advanced-understanding-the-algorithm)

**Performance:**
- [CHANGELOG_OPTIMIZATION.md](./CHANGELOG_OPTIMIZATION.md#-performance-improvements)
- Run `node compare_performance.js`

---

## ✨ Pro Tips

1. **Print** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) and keep it next to your computer
2. **Bookmark** this INDEX.md for quick navigation
3. **Run** `node auto_tune.cjs` when changing network/time
4. **Monitor** with `monitor.sh`/`monitor.bat` in separate terminal
5. **Compare** periodically with `compare_performance.js`

---

## 🎓 Educational Value

This documentation structure teaches:
- ✅ Load testing with k6
- ✅ Adaptive rate limiting algorithms
- ✅ Error handling strategies
- ✅ Performance optimization
- ✅ Real-time metrics
- ✅ Configuration management
- ✅ System architecture

---

**Happy Learning & Optimizing! 🚀**

*Last updated: 2026-08-28*
