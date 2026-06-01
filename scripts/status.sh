#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
source "$(dirname "$0")/common.sh"

ensure_runtime_dirs

mode="desconocido"
[[ -f "$MODE_FILE" ]] && mode="$(cat "$MODE_FILE")"

server_state="detenido"
client_state="detenido"

if is_running "$SERVER_PID_FILE"; then
  server_state="activo (PID $(cat "$SERVER_PID_FILE"))"
fi
if is_running "$CLIENT_PID_FILE"; then
  client_state="activo (PID $(cat "$CLIENT_PID_FILE"))"
fi

echo "=== AniMDB status ==="
echo "Modo:     $mode"
echo "Backend:  $server_state  :$BACKEND_PORT"
echo "Frontend: $client_state  :$FRONTEND_PORT"
echo "Local:    http://localhost:${FRONTEND_PORT}"
ts="$(tailscale_url)"
[[ -n "$ts" ]] && echo "Tailscale: $ts"

if [[ -f "$SERVER_LOG" ]]; then
  echo ""
  echo "--- server.log (últimas 5 líneas) ---"
  tail -n 5 "$SERVER_LOG" 2>/dev/null || true
fi
if [[ -f "$CLIENT_LOG" ]]; then
  echo ""
  echo "--- client.log (últimas 5 líneas) ---"
  tail -n 5 "$CLIENT_LOG" 2>/dev/null || true
fi
