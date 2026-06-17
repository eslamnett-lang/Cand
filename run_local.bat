@echo off
REM
REM Launch a simple static web server to serve the MNDO View application.
REM Works even when "python" isn't on PATH by trying: py -> python -> npx serve
REM
REM Usage:
REM   run_local.bat
REM

setlocal EnableExtensions

REM Determine the directory of this script and switch into it
set "DIR=%~dp0"
cd /d "%DIR%"

set "PORT=8080"
echo Starting MNDO View static server on http://localhost:%PORT% …

REM --- Try Python launcher (Windows) ---
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -m http.server %PORT%
  goto :eof
)

REM --- Try python on PATH ---
where python >nul 2>nul
if %ERRORLEVEL%==0 (
  python -m http.server %PORT%
  goto :eof
)

REM --- Try Node.js (npx) ---
where npx >nul 2>nul
if %ERRORLEVEL%==0 (
  echo Python not found. Using Node.js via "npx serve" …
  npx serve . -l %PORT%
  goto :eof
)

echo.
echo ERROR: Could not start a local server.
echo - Python was not found (py/python).
echo - Node.js was not found (npx).
echo.
echo Options:
echo 1) Install Python (recommended) OR Node.js
echo 2) Or open index.html directly (works best for small files, e.g., ~500 rows)
echo.
pause
