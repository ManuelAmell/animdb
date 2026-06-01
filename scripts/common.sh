#!/usr/bin/env bash
# Shared helpers for AniMDB shell scripts.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.animdb"
PID_DIR="$RUNTIME_DIR/pids"
LOG_DIR="$RUNTIME_DIR/logs"

FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${BACKEND_PORT:-5174}"

SERVER_PID_FILE="$PID_DIR/server.pid"
CLIENT_PID_FILE="$PID_DIR/client.pid"
MODE_FILE="$RUNTIME_DIR/mode"

SERVER_LOG="$LOG_DIR/server.log"
CLIENT_LOG="$LOG_DIR/client.log"

log() {
  printf '[animdb] %s\n' "$*"
}

warn() {
  printf '[animdb] WARN: %s\n' "$*" >&2
}

die() {
  printf '[animdb] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Comando requerido no encontrado: $1"
}

ensure_runtime_dirs() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
}

load_env() {
  if [[ -f "$ROOT_DIR/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env"
    set +a
  fi
}

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file" 2>/dev/null)" || return 1
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

pid_on_port() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -lptn "sport = :$port" 2>/dev/null | awk 'NR>1 {print $NF}' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti ":$port" 2>/dev/null | head -1
  else
    return 1
  fi
}

kill_pid_file() {
  local pid_file="$1"
  local label="$2"
  if is_running "$pid_file"; then
    local pid
    pid="$(cat "$pid_file")"
    log "Deteniendo $label (PID $pid)…"
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.25
    done
    if kill -0 "$pid" 2>/dev/null; then
      warn "Forzando cierre de $label (PID $pid)"
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi
  rm -f "$pid_file"
}

kill_port() {
  local port="$1"
  local pid
  pid="$(pid_on_port "$port" || true)"
  if [[ -n "${pid:-}" ]]; then
    warn "Liberando puerto $port (PID $pid)"
    kill "$pid" 2>/dev/null || true
    sleep 0.5
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  fi
}

tailscale_url() {
  if command -v tailscale >/dev/null 2>&1; then
    local ip
    ip="$(tailscale ip -4 2>/dev/null || true)"
    if [[ -n "$ip" ]]; then
      echo "http://${ip}:${FRONTEND_PORT}"
      return
    fi
  fi
  echo ""
}

print_urls() {
  local mode="${1:-dev}"
  log "AniMDB iniciado (modo: $mode)"
  echo "  Local:     http://localhost:${FRONTEND_PORT}"
  echo "  API:       http://localhost:${BACKEND_PORT}"
  local ts
  ts="$(tailscale_url)"
  if [[ -n "$ts" ]]; then
    echo "  Tailscale: $ts"
  fi
  echo "  Logs:      $LOG_DIR/"
  echo "  Parar:     $ROOT_DIR/scripts/stop.sh"
  echo "  Estado:    $ROOT_DIR/scripts/status.sh"
}

start_background() {
  local name="$1"
  local cmd="$2"
  local log_file="$3"
  local pid_file="$4"

  log "Iniciando $name…"
  # shellcheck disable=SC2086
  nohup bash -c "cd '$ROOT_DIR' && $cmd" >>"$log_file" 2>&1 &
  local pid=$!
  echo "$pid" >"$pid_file"
  sleep 1
  if ! kill -0 "$pid" 2>/dev/null; then
    die "$name falló al arrancar. Revisa $log_file"
  fi
  log "$name en segundo plano (PID $pid)"
}

wait_for_port() {
  local port="$1"
  local label="$2"
  local tries="${3:-30}"
  for _ in $(seq 1 "$tries"); do
    if pid_on_port "$port" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  warn "$label no respondió en el puerto $port a tiempo"
  return 1
}

parse_mode_args() {
  MODE="dev"
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dev) MODE="dev" ;;
      --prod) MODE="prod" ;;
      *) die "Opción desconocida: $1 (usa --dev o --prod)" ;;
    esac
    shift
  done
}
