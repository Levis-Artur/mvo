#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib.sh
. "$ROOT_DIR/deploy/lib.sh"

usage() {
  echo "Використання: ./restore.sh backups/mvo_YYYY-MM-DD_HH-MM-SS.sql.gz"
}

API_STOPPED=false

on_interrupt() {
  echo "Restore перервано." >&2

  if [[ "$API_STOPPED" == "true" ]]; then
    log "Спроба повернути api у запущений стан..."
    "${COMPOSE[@]}" up -d api || true
  fi

  exit 130
}

on_error() {
  local exit_code=$?
  log "Restore завершився з помилкою."

  if [[ "$API_STOPPED" == "true" ]]; then
    log "Спроба повернути api у запущений стан..."
    "${COMPOSE[@]}" up -d api || true
  fi

  exit "$exit_code"
}

trap on_interrupt INT
trap on_error ERR

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

backup_file="$1"

require_linux
load_env_file
require_vars POSTGRES_DB POSTGRES_USER
require_docker

[[ -f "$backup_file" ]] || fail "backup-файл не знайдено: $backup_file"
gzip -t "$backup_file"

postgres_health="$(service_health postgres 2>/dev/null || true)"
if [[ "$postgres_health" != "healthy" && "$postgres_health" != "running" ]]; then
  fail "контейнер postgres не працює або не готовий."
fi

echo "Цільова база даних: ${POSTGRES_DB}"
echo "Для підтвердження відновлення введіть RESTORE:"
read -r confirmation

[[ "$confirmation" == "RESTORE" ]] || fail "відновлення скасовано."

log "Перед відновленням створюється актуальний backup..."
"$ROOT_DIR/backup.sh"

log "Тимчасова зупинка api..."
"${COMPOSE[@]}" stop api
API_STOPPED=true

log "Відновлення PostgreSQL із backup..."
gunzip -c "$backup_file" |
  "${COMPOSE[@]}" exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null

log "Запуск api..."
"${COMPOSE[@]}" up -d api
API_STOPPED=false
wait_for_service api 180

log "Перевірка API health..."
check_nginx_api

log "Restore завершено успішно."
