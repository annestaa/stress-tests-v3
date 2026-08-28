# 📝 Command Reference - All Terminals (PowerShell/CMD/Git Bash)

## ⚠️ Important: File Extensions

Karena project ini menggunakan ES modules, beberapa file menggunakan `.cjs` extension:
- ✅ `auto_tune.cjs` (bukan .js)
- ✅ `compare_performance.cjs` (bukan .js)
- ✅ File lain tetap `.js`

---

## 🚀 Quick Start Commands

### Step 1: Generate Optimal Config
```powershell
node auto_tune.cjs
```

### Step 2: Copy & Edit Config
```powershell
# PowerShell
copy .env.auto .env
notepad .env

# Git Bash
cp .env.auto .env
nano .env

# Edit dan ganti:
# MINIGAMES_USERNAME=username_instagram_kamu
```

### Step 3: Run Token Daemon
```powershell
# Terminal 1
node token_sync.js
```

### Step 4: Run Automation
```powershell
# Terminal 2
k6 run play_optimized.js
```

---

## 🛠️ Tool Commands

### Auto-Tune (Config Generator)
```powershell
# Auto-detect dan generate
node auto_tune.cjs

# Interactive mode
node auto_tune.cjs --interactive
```

### Compare Performance
```powershell
# Setelah punya log dari kedua script
node compare_performance.cjs
```

### Real-time Monitor
```powershell
# PowerShell/CMD
monitor.bat

# Git Bash
./monitor.sh
```

---

## 📊 Monitoring Commands

### Run with Logging
```powershell
# PowerShell
k6 run play_optimized.js 2>&1 | Tee-Object -FilePath automation_optimized.log

# Git Bash
k6 run play_optimized.js 2>&1 | tee automation_optimized.log
```

### Watch Live Log
```powershell
# PowerShell
Get-Content automation_optimized.log -Wait -Tail 20

# Git Bash
tail -f automation_optimized.log
```

### Count Successes
```powershell
# PowerShell
(Select-String -Path automation_optimized.log -Pattern "✅").Count

# Git Bash
grep "✅" automation_optimized.log | wc -l
```

### Count Errors
```powershell
# PowerShell
(Select-String -Path automation_optimized.log -Pattern "429").Count

# Git Bash
grep "429" automation_optimized.log | wc -l
```

---

## 🔧 Common Workflows

### Workflow 1: First Time Setup
```powershell
# 1. Generate config
node auto_tune.cjs

# 2. Copy to .env
copy .env.auto .env

# 3. Edit username (PowerShell)
notepad .env

# 4. Start daemon (Terminal 1)
node token_sync.js

# 5. Run automation (Terminal 2)
k6 run play_optimized.js
```

### Workflow 2: Daily Run with Monitoring
```powershell
# Terminal 1: Token daemon
node token_sync.js

# Terminal 2: Automation with log
k6 run play_optimized.js 2>&1 | Tee-Object automation_optimized.log

# Terminal 3: Monitor
monitor.bat
```

### Workflow 3: Compare Performance
```powershell
# 1. Run original (with log)
k6 run play.js 2>&1 | Tee-Object automation_original.log

# 2. Run optimized (with log)
k6 run play_optimized.js 2>&1 | Tee-Object automation_optimized.log

# 3. Compare
node compare_performance.cjs
```

---

## 🎯 Terminal-Specific Commands

### PowerShell Specific

#### Stop All Node Processes
```powershell
Get-Process node | Stop-Process -Force
```

#### Check if Port 9876 is Used
```powershell
netstat -ano | findstr :9876
```

#### Kill Process on Port 9876
```powershell
$port = Get-NetTCPConnection -LocalPort 9876
Stop-Process -Id $port.OwningProcess -Force
```

#### Set Environment Variable (Temporary)
```powershell
$env:MINIGAMES_USERNAME = "username_kamu"
k6 run play_optimized.js
```

### Git Bash Specific

#### Stop All Node Processes
```bash
pkill node
```

#### Check Port 9876
```bash
netstat -ano | grep 9876
```

#### Background Daemon
```bash
node token_sync.js &
```

#### Set Environment Variable
```bash
MINIGAMES_USERNAME=username_kamu k6 run play_optimized.js
```

---

## 🚨 Troubleshooting Commands

### Problem: "node: command not found"
```powershell
# Check Node.js installed
node --version

# If not installed, download from:
# https://nodejs.org/
```

### Problem: "k6: command not found"
```powershell
# Check k6 installed
k6 version

# If not installed:
# PowerShell (as Admin)
choco install k6

# Or download from:
# https://k6.io/docs/get-started/installation/
```

### Problem: Port 9876 Already in Use
```powershell
# Find process using port
netstat -ano | findstr :9876

# Kill it (PowerShell)
$port = Get-NetTCPConnection -LocalPort 9876
Stop-Process -Id $port.OwningProcess -Force
```

### Problem: Cannot Find .env File
```powershell
# Check if file exists
Test-Path .env

# If not, create from template
copy .env.optimized .env
```

### Problem: Token Sync Not Running
```powershell
# Check if running
Get-Process node

# If not running, start it
node token_sync.js
```

---

## 📦 Installation Commands

### Install Dependencies
```powershell
npm install
```

### Update Dependencies
```powershell
npm update
```

### Check Installed Packages
```powershell
npm list
```

---

## 🔍 Diagnostic Commands

### Check Configuration
```powershell
# View .env content
Get-Content .env

# Or
type .env

# Git Bash
cat .env
```

### Test Network to Server
```powershell
# PowerShell
Test-NetConnection minigames.liputan6.com -Port 443

# Git Bash
curl -I https://minigames.liputan6.com
```

### View Recent Logs
```powershell
# PowerShell - Last 50 lines
Get-Content automation_optimized.log -Tail 50

# Git Bash
tail -50 automation_optimized.log
```

### Search Errors in Log
```powershell
# PowerShell
Select-String -Path automation_optimized.log -Pattern "error|Error|ERROR"

# Git Bash
grep -i error automation_optimized.log
```

---

## 💡 Pro Tips

### Tip 1: Create Aliases (PowerShell)
```powershell
# Add to your PowerShell profile
Set-Alias tune "node auto_tune.cjs"
Set-Alias compare "node compare_performance.cjs"
Set-Alias daemon "node token_sync.js"

# Usage
tune
compare
daemon
```

### Tip 2: Quick Config Switch
```powershell
# Conservative (peak hours)
copy .env.optimized .env
notepad .env

# Speed (off-peak)
# Edit INITIAL_BATCH_SIZE=12, MAX_BATCH_SIZE=20
```

### Tip 3: Multiple Accounts
```powershell
# Terminal 1
$env:MINIGAMES_USERNAME = "account1"
k6 run play_optimized.js

# Terminal 2
$env:MINIGAMES_USERNAME = "account2"
k6 run play_optimized.js
```

### Tip 4: Background Daemon (Git Bash)
```bash
# Start in background
node token_sync.js > token_sync.log 2>&1 &

# Check if running
ps aux | grep token_sync

# Stop
pkill -f token_sync
```

---

## 🎯 Complete Example Session

```powershell
# === FIRST TIME SETUP ===

# 1. Install dependencies (if not done)
npm install

# 2. Generate optimal config
node auto_tune.cjs

# 3. Create .env from generated config
copy .env.auto .env

# 4. Edit username
notepad .env
# Change: MINIGAMES_USERNAME=your_instagram_username

# === RUNNING ===

# 5. Open new PowerShell terminal (Terminal 1)
# Start token daemon
node token_sync.js

# 6. Open another PowerShell terminal (Terminal 2)
# Run automation with logging
k6 run play_optimized.js 2>&1 | Tee-Object automation_optimized.log

# 7. (Optional) Open third PowerShell terminal (Terminal 3)
# Monitor real-time
monitor.bat

# === AFTER RUNNING ===

# 8. Stop automation (Ctrl+C in Terminal 2)

# 9. Compare performance
node compare_performance.cjs

# 10. View summary
Get-Content automation_optimized.log | Select-String "FINAL SUMMARY" -Context 0,10
```

---

## 📚 Command Reference Table

| Task | PowerShell/CMD | Git Bash |
|------|---------------|----------|
| **Generate config** | `node auto_tune.cjs` | `node auto_tune.cjs` |
| **Copy .env** | `copy .env.auto .env` | `cp .env.auto .env` |
| **Edit .env** | `notepad .env` | `nano .env` |
| **Run daemon** | `node token_sync.js` | `node token_sync.js` |
| **Run automation** | `k6 run play_optimized.js` | `k6 run play_optimized.js` |
| **Compare** | `node compare_performance.cjs` | `node compare_performance.cjs` |
| **Monitor** | `monitor.bat` | `./monitor.sh` |
| **View log** | `Get-Content file.log -Tail 50` | `tail -50 file.log` |
| **Count errors** | `(Select-String -Pattern "429" file.log).Count` | `grep "429" file.log \| wc -l` |

---

**Semua command di atas bisa dijalankan di PowerShell, CMD, atau Git Bash!** 🚀

*Last updated: 2026-08-28*
