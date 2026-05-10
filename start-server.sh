#!/bin/bash
cd ~/Documents/animdb
npm run dev &
echo "AnimDB iniciado en http://$(tailscale ip -4):5173"
