#!/bin/bash
# Build script for Linux
# Run this on a Linux machine

echo "Building AniMDB for Linux..."

# Build the frontend
npm run build

# Build Linux AppImage
npx electron-builder --linux

echo ""
echo "Linux installer created: dist-electron/"
ls -la dist-electron/*.AppImage 2>/dev/null || echo "Check dist-electron folder"