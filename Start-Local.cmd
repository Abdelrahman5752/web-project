@echo off
cd /d "%~dp0"
echo Open http://localhost:3000 after the server starts.
echo Press Ctrl+C to stop.
node server.js
pause
