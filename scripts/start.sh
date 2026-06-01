#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
source "$(dirname "$0")/common.sh"

parse_mode_args "$@"

cd "$ROOT_DIR"
require_cmd npm
require_cmd node
require_cmd npx

ensure_runtime_dirs
load_env

# Si ya corre, avisar y salir
if is_running "$SERVER_PID_FILE" || is_running "$CLIENT_PID_FILE"; then
  warn "AniMDB ya está en ejecución. Usa scripts/stop.sh primero o scripts/restart.sh"
  "$ROOT_DIR/scripts/status.sh"
  exit 1
fi

# Liberar puertos ocupados por otros procesos
if pid_on_port "$BACKEND_PORT" >/dev/null 2>&1; then
  warn "Puerto $BACKEND_PORT ocupado; intentando liberar…"
  kill_port "$BACKEND_PORT"
fi
if pid_on_port "$FRONTEND_PORT" >/dev/null 2>&1; then
  warn "Puerto $FRONTEND_PORT ocupado; intentando liberar…"
  kill_port "$FRONTEND_PORT"
fi

if [[ "$MODE" == "prod" ]]; then
  if [[ ! -d "$ROOT_DIR/dist" ]]; then
    log "Build de producción no encontrado; ejecutando npm run build…"
    npm run build
  fi
  CLIENT_CMD="npx vite preview --host 0.0.0.0 --port ${FRONTEND_PORT}"
else
  CLIENT_CMD="npx vite --host 0.0.0.0 --port ${FRONTEND_PORT}"
fi

start_background "backend" "node server/index.js" "$SERVER_LOG" "$SERVER_PID_FILE"
start_background "frontend ($MODE)" "$CLIENT_CMD" "$CLIENT_LOG" "$CLIENT_PID_FILE"

echo "$MODE" >"$MODE_FILE"

wait_for_port "$BACKEND_PORT" "Backend" || true
wait_for_port "$FRONTEND_PORT" "Frontend" || true

print_urls "$MODE"
