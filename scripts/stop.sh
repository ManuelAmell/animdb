#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
source "$(dirname "$0")/common.sh"

ensure_runtime_dirs

stopped=0

if is_running "$SERVER_PID_FILE" || is_running "$CLIENT_PID_FILE"; then
  kill_pid_file "$SERVER_PID_FILE" "backend"
  kill_pid_file "$CLIENT_PID_FILE" "frontend"
  stopped=1
fi

# Fallback: liberar puertos si quedaron procesos huérfanos
if pid_on_port "$BACKEND_PORT" >/dev/null 2>&1; then
  kill_port "$BACKEND_PORT"
  stopped=1
fi
if pid_on_port "$FRONTEND_PORT" >/dev/null 2>&1; then
  kill_port "$FRONTEND_PORT"
  stopped=1
fi

rm -f "$MODE_FILE"

if [[ "$stopped" -eq 1 ]]; then
  log "AniMDB detenido."
else
  log "AniMDB no estaba en ejecución."
fi
