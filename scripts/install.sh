#!/usr/bin/env bash
set -euo pipefail

# shellcheck disable=SC1091
source "$(dirname "$0")/common.sh"

cd "$ROOT_DIR"
require_cmd npm

log "Instalando dependencias del frontend…"
npm install

log "Instalando dependencias del servidor…"
(cd server && npm install)

log "Instalación completada."
