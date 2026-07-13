#!/usr/bin/env bash
set -Eeuo pipefail

trap 'echo "Перегляд логів перервано." >&2; exit 130' INT

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib.sh
. "$ROOT_DIR/deploy/lib.sh"

usage() {
  echo "Використання: ./logs.sh [api|web|postgres|nginx]"
}

require_linux
require_env_file
require_docker

service="${1:-}"

if [[ $# -gt 1 ]]; then
  usage
  exit 1
fi

if [[ -z "$service" ]]; then
  "${COMPOSE[@]}" logs -f --tail=200
  exit 0
fi

case "$service" in
  api | web | postgres | nginx)
    "${COMPOSE[@]}" logs -f --tail=200 "$service"
    ;;
  *)
    usage
    exit 1
    ;;
esac
