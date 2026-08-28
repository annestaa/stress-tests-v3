# ==============================================================================
# Quick Setup Script - Optimal Config for Rank 1 (PowerShell)
# ==============================================================================

Write-Host "🚀 Setting up optimal configuration..." -ForegroundColor Cyan
Write-Host ""

# Copy example to .env.api
if (Test-Path ".env.api") {
    Write-Host "⚠️  .env.api already exists!" -ForegroundColor Yellow
    $reply = Read-Host "   Overwrite? (y/N)"
    if ($reply -notmatch '^[Yy]$') {
        Write-Host "❌ Cancelled. Keeping existing .env.api" -ForegroundColor Red
        exit
    }
}

Copy-Item .env.api.example .env.api
Write-Host "✅ Created .env.api from template" -ForegroundColor Green
Write-Host ""

# Prompt for username
Write-Host "📝 Current username in config: zildjiannesta" -ForegroundColor Cyan
$username = Read-Host "   Enter your Instagram username"

if ($username) {
    # Update username in .env.api
    $content = Get-Content .env.api
    $content = $content -replace 'MINIGAMES_USERNAME=.*', "MINIGAMES_USERNAME=$username"
    $content | Set-Content .env.api
    Write-Host "✅ Updated username to: $username" -ForegroundColor Green
} else {
    Write-Host "⚠️  No username provided. Please edit .env.api manually:" -ForegroundColor Yellow
    Write-Host "   notepad .env.api"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Current configuration:" -ForegroundColor Cyan
Write-Host "   • VUs: 5 (parallel exploitation)"
Write-Host "   • Batch: 2-10 (adaptive)"
Write-Host "   • Expected: 90,000-150,000 points/hour"
Write-Host ""
Write-Host "🚀 To start automation:" -ForegroundColor Green
Write-Host "   .\start.ps1 api"
Write-Host ""
Write-Host "⚙️  To customize config:" -ForegroundColor Yellow
Write-Host "   notepad .env.api"
Write-Host ""
Write-Host "Good luck chasing rank 1! 🏆" -ForegroundColor Green
Write-Host ""
