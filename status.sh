#!/usr/bin/env bash
set -Eeuo pipefail

trap 'echo "Перевірку статусу перервано." >&2; exit 130' INT

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib.sh
. "$ROOT_DIR/deploy/lib.sh"

require_linux
load_env_file
require_vars PUBLIC_PORT
require_docker

echo "PUBLIC_PORT=$(public_port)"
echo
echo "Docker Compose services:"
"${COMPOSE[@]}" ps
echo

unhealthy_services=()

for service in postgres api web nginx; do
  health="$(service_health "$service" 2>/dev/null || true)"
  [[ -n "$health" ]] || health="not-running"
  printf '%s: %s\n' "$service" "$health"

  if [[ "$health" != "healthy" && "$health" != "running" ]]; then
    unhealthy_services+=("$service")
  fi
done

echo
if check_nginx_api; then
  echo "API health через Nginx: OK"
else
  echo "API health через Nginx: ERROR"
  unhealthy_services+=("api")
fi

if check_nginx_frontend; then
  echo "Frontend через Nginx: OK"
else
  echo "Frontend через Nginx: ERROR"
  unhealthy_services+=("web")
fi

if (( ${#unhealthy_services[@]} > 0 )); then
  echo
  echo "Останні 30 рядків логів проблемних сервісів:"
  printed=()
  for service in "${unhealthy_services[@]}"; do
    if [[ " ${printed[*]} " == *" ${service} "* ]]; then
      continue
    fi
    printed+=("$service")
    echo
    echo "--- $service ---"
    "${COMPOSE[@]}" logs --tail=30 "$service" || true
  done
fi
