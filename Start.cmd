@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer from https://nodejs.org/ then try again.
  pause
  exit /b 1
)
node.exe launcher.mjs
if errorlevel 1 pause
