@echo off
color 0A
echo ========================================================
echo   MENJALANKAN BOT MINIGAMES (VERSI NODE.JS NATIVE)
echo ========================================================
echo.
echo Pastikan Anda sudah menjalankan 'npm install' sebelumnya.
echo.

echo [1/2] Menyalakan Token Sync Daemon (Captcha Solver)...
start "Captcha Solver" cmd /k "title Captcha Solver && node token_sync.js"

:: Tunggu 3 detik agar server captcha siap
timeout /t 3 /nobreak >nul

echo [2/2] Menyalakan Game Pipeline...
start "Game Pipeline" cmd /k "title Game Pipeline && node play_node.js"

echo.
echo Selesai! Dua jendela terminal baru telah terbuka.
echo - Jendela 1: Mengurus token Captcha (token_sync.js)
echo - Jendela 2: Mengurus tembakan game (play_node.js)
echo.
echo Biarkan kedua jendela tersebut tetap terbuka.
pause
