@echo off
REM Double-click this to play locally. The game's source is split across
REM several files that Babel compiles in the browser, so it has to be served
REM over http:// rather than opened straight off disk.

cd /d "%~dp0"

set PORT=8000
set PY=

where python >nul 2>&1
if %ERRORLEVEL%==0 set PY=python
if "%PY%"=="" (
  where py >nul 2>&1
  if %ERRORLEVEL%==0 set PY=py
)

if "%PY%"=="" (
  echo.
  echo Python was not found on this machine.
  echo.
  echo Install it from https://python.org ^(tick "Add python.exe to PATH"^),
  echo or serve this folder with any other static server, e.g.:
  echo     npx serve .
  echo.
  pause
  exit /b 1
)

echo.
echo   Sundown Kennels  --  http://localhost:%PORT%
echo   Press Ctrl+C to stop.
echo.

REM Open the browser once the server has had a moment to bind.
start /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:%PORT%'"

%PY% -m http.server %PORT%
