#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

MODE="dev"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev) MODE="dev" ;;
    --prod) MODE="prod" ;;
    *) die "Opción desconocida: $1" ;;
  esac
  shift
done

"$SCRIPT_DIR/stop.sh"
"$SCRIPT_DIR/start.sh" "--$MODE"
