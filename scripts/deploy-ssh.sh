#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
source "$(dirname "$0")/common.sh"

usage() {
  cat <<EOF
Uso: $(basename "$0") [user@host] [ruta_remota] [--dev|--prod]

Despliega AniMDB en un servidor remoto vía SSH (segundo plano).

Ejemplos:
  $(basename "$0") mamell@fedora ~/Documentos/animdb --prod
  $(basename "$0") --prod
    (usa ANIMDB_SSH_HOST y ANIMDB_SSH_PATH del entorno)

Variables opcionales:
  ANIMDB_SSH_HOST   user@host
  ANIMDB_SSH_PATH   ruta al repo en el remoto (default: ~/animdb)
EOF
}

SSH_TARGET="${ANIMDB_SSH_HOST:-}"
REMOTE_PATH="${ANIMDB_SSH_PATH:-~/animdb}"
MODE="prod"
EXTRA_DEPLOY_ARGS=(--pull)

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev)
      MODE="dev"
      ;;
    --prod)
      MODE="prod"
      ;;
    --no-pull)
      EXTRA_DEPLOY_ARGS=()
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$SSH_TARGET" ]]; then
        SSH_TARGET="$1"
      elif [[ "$REMOTE_PATH" == "~/animdb" ]] && [[ "$1" != --* ]]; then
        REMOTE_PATH="$1"
      else
        die "Argumento inesperado: $1"
      fi
      ;;
  esac
  shift
done

[[ -n "$SSH_TARGET" ]] || die "Falta user@host. Uso: deploy-ssh.sh user@host [path] [--dev|--prod]"

require_cmd ssh

log "Desplegando en $SSH_TARGET:$REMOTE_PATH (modo: $MODE)…"

DEPLOY_CMD="cd '$REMOTE_PATH' && chmod +x scripts/*.sh 2>/dev/null; ./scripts/deploy.sh --$MODE"
if [[ ${#EXTRA_DEPLOY_ARGS[@]} -gt 0 ]]; then
  DEPLOY_CMD+=" ${EXTRA_DEPLOY_ARGS[*]}"
fi

ssh -t "$SSH_TARGET" "$DEPLOY_CMD"

log "Deploy remoto finalizado."
