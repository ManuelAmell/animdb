@echo off
REM Build script for Windows
echo Building AniMDB for Windows...
npm run build
npx electron-builder --win --prepackaged dist-electron/win-unpacked
echo.
echo Windows installer created: dist-electron\AniMDB Setup 1.0.0.exe
pause