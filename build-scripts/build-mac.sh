#!/usr/bin/env bash
# Build script for macOS — run on a Mac machine
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

command -v npm >/dev/null 2>&1 || { echo "ERROR: npm no encontrado"; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "ERROR: npx no encontrado"; exit 1; }

echo "Building AniMDB for macOS (desde $ROOT)…"

npm run build
npx electron-builder --mac

echo ""
echo "macOS installer created: dist-electron/"
ls -la dist-electron/*.dmg 2>/dev/null || echo "Revisa la carpeta dist-electron/"
