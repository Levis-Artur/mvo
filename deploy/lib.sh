#!/usr/bin/env bash

COMPOSE=(docker compose --env-file .env -f docker-compose.prod.yml)

log() {
  printf '%s\n' "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

fail() {
  printf '%s\n' "Помилка: $*" >&2
  exit 1
}

require_linux() {
  [[ "$(uname -s)" == "Linux" ]] || fail "цей скрипт потрібно запускати на Linux."
}

require_env_file() {
  [[ -f .env ]] || fail "файл .env не знайдено. Створіть його з .env.example."
}

load_env_file() {
  require_env_file

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"

    [[ -z "$line" || "${line:0:1}" == "#" ]] && continue
    [[ "$line" == export\ * ]] && line="${line#export }"
    [[ "$line" == *=* ]] || fail "некоректний рядок у .env."

    local key="${line%%=*}"
    local value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "некоректна назва змінної у .env."

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < .env
}

require_vars() {
  local name
  for name in "$@"; do
    [[ -n "${!name:-}" ]] || fail "обов'язкова змінна $name не задана."
  done
}

validate_production_password() {
  case "${POSTGRES_PASSWORD:-}" in
    '' | CHANGE_ME | CHANGE_ME_TO_A_LONG_RANDOM_PASSWORD)
      fail "POSTGRES_PASSWORD має бути замінений на довгий випадковий пароль."
      ;;
  esac
}

require_docker() {
  command -v docker >/dev/null 2>&1 || fail "docker не встановлено."
  docker info >/dev/null 2>&1 || fail "Docker daemon недоступний."
  docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin недоступний."
}

compose_config() {
  "${COMPOSE[@]}" config >/dev/null
}

compose_logs_tail() {
  local service="${1:-}"
  if [[ -n "$service" ]]; then
    "${COMPOSE[@]}" logs --tail=80 "$service" || true
  else
    "${COMPOSE[@]}" logs --tail=80 || true
  fi
}

service_container_id() {
  "${COMPOSE[@]}" ps -q "$1"
}

service_health() {
  local service="$1"
  local container_id
  container_id="$(service_container_id "$service")"
  [[ -n "$container_id" ]] || return 1
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id"
}

wait_for_service() {
  local service="$1"
  local timeout="${2:-120}"
  local started_at
  started_at="$(date +%s)"

  log "Очікування готовності сервісу $service..."

  while true; do
    local health
    health="$(service_health "$service" 2>/dev/null || true)"

    if [[ "$health" == "healthy" || "$health" == "running" ]]; then
      log "Сервіс $service готовий."
      return 0
    fi

    if (( "$(date +%s)" - started_at >= timeout )); then
      log "Сервіс $service не став ready за ${timeout}s."
      compose_logs_tail "$service"
      return 1
    fi

    sleep 3
  done
}

public_port() {
  printf '%s' "${PUBLIC_PORT:-80}"
}

server_ip() {
  local detected=""

  if command -v hostname >/dev/null 2>&1; then
    detected="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  fi

  if [[ -z "$detected" ]] && command -v ip >/dev/null 2>&1; then
    detected="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1; i<=NF; i++) if ($i == "src") {print $(i+1); exit}}' || true)"
  fi

  printf '%s' "${detected:-SERVER_IP}"
}

check_nginx_frontend() {
  local port
  port="$(public_port)"
  curl -fsS "http://127.0.0.1:${port}/" >/dev/null
}

check_nginx_api() {
  local port
  port="$(public_port)"
  curl -fsS "http://127.0.0.1:${port}/api/health" >/dev/null
}
