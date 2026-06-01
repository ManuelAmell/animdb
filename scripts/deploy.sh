#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
source "$(dirname "$0")/common.sh"

cd "$ROOT_DIR"

MODE="prod"
DO_PULL=0
FORCE_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev) MODE="dev" ;;
    --prod) MODE="prod" ;;
    --pull) DO_PULL=1 ;;
    --force-build) FORCE_BUILD=1 ;;
    *) die "Opción desconocida: $1 (usa --dev, --prod, --pull, --force-build)" ;;
  esac
  shift
done

if [[ "$DO_PULL" -eq 1 ]]; then
  require_cmd git
  log "Actualizando código (git pull --ff-only)…"
  git pull --ff-only
fi

"$ROOT_DIR/scripts/install.sh"

if [[ "$MODE" == "prod" ]]; then
  if [[ "$FORCE_BUILD" -eq 1 ]] || [[ ! -d "$ROOT_DIR/dist" ]]; then
    log "Compilando frontend para producción…"
    npm run build
  else
    log "Usando build existente en dist/ (usa --force-build para recompilar)"
  fi
fi

"$ROOT_DIR/scripts/stop.sh" || true
"$ROOT_DIR/scripts/start.sh" "--$MODE"

log "Despliegue local completado."
