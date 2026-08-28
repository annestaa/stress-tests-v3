# ==============================================================================
# Script Startup Bot Automation Mini Games Kemerdekaan (k6)
# PowerShell Version - Support Optimized
# ==============================================================================

param(
    [string]$Mode = "api",
    [switch]$Original,
    [switch]$Optimized
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Determine version
$UseOptimized = $true
if ($Original) {
    $UseOptimized = $false
}

# Load environment
$EnvFile = ".env.$Mode"
if (-not (Test-Path $EnvFile)) {
    $EnvFile = ".env"
}

if (Test-Path $EnvFile) {
    Write-Host "📄 Memuat konfigurasi dari $EnvFile..." -ForegroundColor Cyan
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Get config values
$BaseUrl = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { "https://minigames.liputan6.com" }
$Username = if ($env:MINIGAMES_USERNAME) { $env:MINIGAMES_USERNAME } else { "zildjiannesta" }
$GameChoice = if ($env:GAME_CHOICE) { $env:GAME_CHOICE } else { "tariktambang" }
$VUs = if ($env:VUS) { $env:VUS } else { "1" }
$LoopCount = if ($env:LOOP_COUNT) { $env:LOOP_COUNT } else { "9999" }

$ModeUpper = $Mode.ToUpper()
$VersionStr = if ($UseOptimized) { "OPTIMIZED ⚡" } else { "ORIGINAL" }

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "🚀 k6 Mini Games Automation Bot" -ForegroundColor Green
Write-Host "   Mode: $ModeUpper - $VersionStr" -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "Konfigurasi File : $EnvFile"
Write-Host "Target Base URL  : $BaseUrl"
Write-Host "Username         : $Username"
Write-Host "Pilihan Game     : $GameChoice"
Write-Host "Virtual Users    : $VUs"
Write-Host "Jumlah Ronde     : $LoopCount"
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""

# Check if token daemon is running
$DaemonRunning = $false
try {
    $connection = Test-NetConnection -ComputerName 127.0.0.1 -Port 9876 -InformationLevel Quiet -WarningAction SilentlyContinue
    $DaemonRunning = $connection
} catch {
    $DaemonRunning = $false
}

if (-not $DaemonRunning) {
    Write-Host "🔄 Menjalankan Anti-Ban Token Sync Daemon (background)..." -ForegroundColor Cyan
    
    # Kill existing node processes first
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 1
    
    # Start daemon
    Start-Process -FilePath "node" -ArgumentList "token_sync.js" -WindowStyle Hidden -RedirectStandardOutput "token_sync.log" -RedirectStandardError "token_sync.log"
    
    # Wait for daemon to be ready
    $maxAttempts = 10
    $attempt = 0
    $ready = $false
    
    while ($attempt -lt $maxAttempts -and -not $ready) {
        Start-Sleep -Milliseconds 300
        try {
            $connection = Test-NetConnection -ComputerName 127.0.0.1 -Port 9876 -InformationLevel Quiet -WarningAction SilentlyContinue
            if ($connection) {
                $ready = $true
                Write-Host "✅ Anti-Ban Daemon ONLINE di http://127.0.0.1:9876" -ForegroundColor Green
            }
        } catch {
            # Continue waiting
        }
        $attempt++
    }
    
    if (-not $ready) {
        Write-Host "⚠️  Warning: Daemon might not be ready yet. Check token_sync.log if issues occur." -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Anti-Ban Daemon sudah aktif di http://127.0.0.1:9876" -ForegroundColor Green
}

Write-Host ""

# Run appropriate script
if ($Mode -eq "browser") {
    Write-Host "🌐 Mode: Browser Automation (k6/browser)..." -ForegroundColor Cyan
    $env:K6_BROWSER_ENABLED = "true"
    k6 run browser_play.js $args
} else {
    if ($UseOptimized) {
        Write-Host "⚡ Mode: Direct HTTP API Automation (OPTIMIZED with Adaptive Rate Limiting)..." -ForegroundColor Cyan
        k6 run play_optimized.js $args
    } else {
        Write-Host "⚡ Mode: Direct HTTP API Automation (Original play.js)..." -ForegroundColor Cyan
        k6 run play.js $args
    }
}
