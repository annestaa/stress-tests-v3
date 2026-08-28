# Helper script untuk start token_sync.js dengan auto-cleanup
# Usage: .\start_daemon.ps1

Write-Host "🔧 Checking for existing Node.js processes..." -ForegroundColor Cyan

# Kill existing node processes
$existingProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($existingProcesses) {
    Write-Host "⚠️  Found $($existingProcesses.Count) existing Node.js process(es). Cleaning up..." -ForegroundColor Yellow
    $existingProcesses | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "✅ Cleaned up!" -ForegroundColor Green
} else {
    Write-Host "✅ No existing processes found" -ForegroundColor Green
}

# Check if port 9876 is free
Write-Host "🔍 Checking port 9876..." -ForegroundColor Cyan
$portCheck = netstat -ano | findstr ":9876"
if ($portCheck) {
    Write-Host "⚠️  Port 9876 is still in use:" -ForegroundColor Yellow
    Write-Host $portCheck
    
    # Extract PID and kill
    $pid = ($portCheck -split '\s+')[-1]
    Write-Host "🔨 Killing process $pid..." -ForegroundColor Yellow
    taskkill /PID $pid /F | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "✅ Port freed!" -ForegroundColor Green
} else {
    Write-Host "✅ Port 9876 is free" -ForegroundColor Green
}

# Start token_sync.js
Write-Host ""
Write-Host "🚀 Starting token_sync.js..." -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

node token_sync.js
