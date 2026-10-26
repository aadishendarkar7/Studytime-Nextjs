@echo off
rem Double-click to run Studytime on this computer (Windows).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20.9 or newer is required. Download the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing Studytime for the first time. This takes a minute...
  call npm install || (pause & exit /b 1)
)
if not exist .next\BUILD_ID (
  echo Building Studytime...
  call npm run build || (pause & exit /b 1)
)
echo.
echo Studytime is running at http://localhost:3000  -  keep this window open.
echo Friends on the same Wi-Fi can open http://YOUR-COMPUTER-IP:3000
start "" http://localhost:3000
call npm start -- -H 0.0.0.0
pause
