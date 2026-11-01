@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_EXE="
if exist "C:\Users\Harsh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" set "PYTHON_EXE=C:\Users\Harsh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not defined PYTHON_EXE (
  for /f "delims=" %%P in ('where python.exe 2^>nul') do if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
)
if not defined PYTHON_EXE (
  echo Python was not found. Install Python 3 and try again.
  pause
  exit /b 1
)

start "ClassPulse local server - close this window to stop" cmd /k ""%PYTHON_EXE%" -m http.server 8000 --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/session.html"
