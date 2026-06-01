@echo off
REM Build script for Windows
setlocal enabledelayedexpansion

cd /d "%~dp0\.."

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm no encontrado
  exit /b 1
)

echo Building AniMDB for Windows...
call npm run build
if errorlevel 1 exit /b 1

call npx electron-builder --win --prepackaged dist-electron/win-unpacked
if errorlevel 1 exit /b 1

echo.
echo Windows installer created: dist-electron\
dir /b dist-electron\*.exe 2>nul || echo Revisa la carpeta dist-electron\
