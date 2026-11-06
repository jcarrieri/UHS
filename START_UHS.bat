@echo off
cd /d "%~dp0"
set "UHS_LOCAL_ACCOUNTS=1"
set "HOST=127.0.0.1"
echo Starting UHS local test server...
echo Open http://localhost:8082/UHS/ in your browser.
node server.js
pause
