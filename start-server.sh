#!/bin/bash
cd "$(dirname "$0")"
npm run start &
sleep 2
TS_IP=$(tailscale ip -4 2>/dev/null)
if [ -n "$TS_IP" ]; then
  echo "AniMDB local:  http://localhost:5173"
  echo "AniMDB remoto: http://${TS_IP}:5173  (Tailscale)"
else
  echo "AniMDB iniciado en http://localhost:5173"
  echo "Tailscale no detectado — uso local sin configuración extra."
fi
