@echo off
setlocal enabledelayedexpansion

REM ==============================================================================
REM Real-time Performance Monitor for Windows
REM ==============================================================================

set LOG_FILE=automation_optimized.log
set TOTAL_WINS=0
set TOTAL_ROUNDS=0
set TOTAL_POINTS=0
set ERRORS_429=0
set ERRORS_500=0
set CYCLES=0

cls
echo ================================================================================
echo   🚀 Real-time Performance Monitor - Optimized Mini Games Automation
echo ================================================================================
echo.

if not exist "%LOG_FILE%" (
    echo ⚠️  Log file not found: %LOG_FILE%
    echo.
    echo Please run: k6 run play_optimized.js 2^>^&1 ^| tee %LOG_FILE%
    echo.
    pause
    exit /b 1
)

echo Monitoring %LOG_FILE%...
echo Press Ctrl+C to stop
echo.
echo ────────────────────────────────────────────────────────────────────────────

:monitor_loop

REM Count wins (lines with ✅)
for /f "tokens=*" %%a in ('findstr /c:"✅" "%LOG_FILE%" 2^>nul ^| find /c /v ""') do set TOTAL_WINS=%%a

REM Count errors
for /f "tokens=*" %%a in ('findstr /c:"429" "%LOG_FILE%" 2^>nul ^| find /c /v ""') do set ERRORS_429=%%a
for /f "tokens=*" %%a in ('findstr /c:"500" "%LOG_FILE%" 2^>nul ^| find /c /v ""') do set ERRORS_500=%%a

REM Count cycles
for /f "tokens=*" %%a in ('findstr /c:"Cycle complete" "%LOG_FILE%" 2^>nul ^| find /c /v ""') do set CYCLES=%%a

REM Extract last success rate
for /f "tokens=2 delims=: " %%a in ('findstr /c:"SR:" "%LOG_FILE%" 2^>nul ^| find /v /c ""') do (
    set LAST_SR=%%a
)

cls
echo ================================================================================
echo   📊 Live Performance Dashboard
echo ================================================================================
echo.
echo Performance Metrics:
echo ────────────────────────────────────────────────────────────────────────────
echo   ✓ Total Wins:          %TOTAL_WINS%
echo   ● Cycles Completed:    %CYCLES%
echo   📈 Last Success Rate:  %LAST_SR%%%
echo.
echo Error Statistics:
echo ────────────────────────────────────────────────────────────────────────────
echo   ⛔ Error 429:          %ERRORS_429%
echo   ⚠️  Error 500:          %ERRORS_500%
echo.

REM Status assessment
if %ERRORS_429% LEQ 5 (
    echo System Status: 🏆 EXCELLENT
) else if %ERRORS_429% LEQ 15 (
    echo System Status: ✅ GOOD
) else if %ERRORS_429% LEQ 30 (
    echo System Status: ⚠️  MODERATE - Consider tuning
) else (
    echo System Status: ❌ POOR - Adjustment needed
)

echo.
echo Recommendations:
echo ────────────────────────────────────────────────────────────────────────────

if %ERRORS_429% GTR 20 (
    echo   • High 429 errors detected
    echo     → Reduce INITIAL_BATCH_SIZE and MAX_BATCH_SIZE
    echo     → Set AGGRESSIVE_MODE=false
)

if %ERRORS_429% LEQ 5 (
    if %TOTAL_WINS% GTR 20 (
        echo   • Excellent performance!
        echo     → Consider increasing batch size for more throughput
    )
)

if %CYCLES% GTR 0 (
    set /a AVG_WINS_PER_CYCLE=%TOTAL_WINS% / %CYCLES%
    echo.
    echo   ℹ️  Average wins per cycle: !AVG_WINS_PER_CYCLE!
    
    if !AVG_WINS_PER_CYCLE! LSS 20 (
        echo     → Token underutilized. Consider more aggressive settings
    )
)

echo.
echo ────────────────────────────────────────────────────────────────────────────
echo   Last updated: %date% %time%
echo   Press Ctrl+C to stop monitoring
echo.

REM Wait 3 seconds before refresh
timeout /t 3 /nobreak >nul

goto monitor_loop
