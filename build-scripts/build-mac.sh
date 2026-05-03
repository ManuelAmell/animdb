#!/bin/bash
# Build script for macOS
# Run this on a Mac machine

echo "Building AniMDB for macOS..."

# Build the frontend
npm run build

# Build macOS DMG
npx electron-builder --mac

echo ""
echo "macOS installer created: dist-electron/"
ls -la dist-electron/*.dmg 2>/dev/null || echo "Check dist-electron folder"