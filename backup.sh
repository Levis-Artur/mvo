#!/usr/bin/env bash
set -Eeuo pipefail

trap 'echo "Backup перервано." >&2; exit 130' INT

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib.sh
. "$ROOT_DIR/deploy/lib.sh"

API_STOPPED=false

restart_api_if_needed() {
  if [[ "$API_STOPPED" == "true" ]]; then
    "${COMPOSE[@]}" up -d api
    API_STOPPED=false
    wait_for_service api 180
  fi
}

on_interrupt() {
  restart_api_if_needed || true
  exit 130
}

on_error() {
  local exit_code=$?
  restart_api_if_needed || true
  log "Backup завершився з помилкою."
  exit "$exit_code"
}

trap on_error ERR
trap on_interrupt INT

require_linux
load_env_file
require_vars POSTGRES_DB POSTGRES_USER
require_docker

postgres_health="$(service_health postgres 2>/dev/null || true)"
if [[ "$postgres_health" != "healthy" && "$postgres_health" != "running" ]]; then
  fail "контейнер postgres не працює або не готовий."
fi

api_health="$(service_health api 2>/dev/null || true)"
if [[ "$api_health" == "healthy" || "$api_health" == "running" ]]; then
  log "Temporarily stopping api for a consistent database and attachment backup..."
  "${COMPOSE[@]}" stop api
  API_STOPPED=true
fi

mkdir -p backups

timestamp="$(date +'%Y-%m-%d_%H-%M-%S')"
backup_path="backups/mvo_${timestamp}.sql.gz"
attachments_backup_path="backups/mvo_${timestamp}.attachments.tar.gz"

log "Створення PostgreSQL backup..."
"${COMPOSE[@]}" exec -T postgres pg_dump --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" |
  gzip -c > "$backup_path"

[[ -s "$backup_path" ]] || fail "backup-файл не створено або він порожній."
chmod 600 "$backup_path"

log "Creating stock document attachments backup..."
"${COMPOSE[@]}" run --rm --no-deps -T --user root api sh -c '
  mkdir -p "$STOCK_DOCUMENT_ATTACHMENTS_DIR"
  tar -C "$STOCK_DOCUMENT_ATTACHMENTS_DIR" -czf - .
' > "$attachments_backup_path"

[[ -s "$attachments_backup_path" ]] || fail "attachments backup was not created or is empty."
gzip -t "$attachments_backup_path"
chmod 600 "$attachments_backup_path"

restart_api_if_needed

size="$(du -h "$backup_path" | awk '{print $1}')"
attachments_size="$(du -h "$attachments_backup_path" | awk '{print $1}')"
log "Attachments backup: $attachments_backup_path ($attachments_size)"
log "Backup створено: $backup_path"
log "Розмір: $size"

if [[ "${BACKUP_RETENTION_DAYS:-}" =~ ^[0-9]+$ && "${BACKUP_RETENTION_DAYS}" -gt 0 ]]; then
  log "Очищення backup-файлів старших за ${BACKUP_RETENTION_DAYS} днів..."
  find backups -maxdepth 1 -type f -name 'mvo_*.sql.gz' -mtime "+${BACKUP_RETENTION_DAYS}" -delete
  find backups -maxdepth 1 -type f -name 'mvo_*.attachments.tar.gz' -mtime "+${BACKUP_RETENTION_DAYS}" -delete
else
  log "BACKUP_RETENTION_DAYS не задано або некоректний, старі backup-файли не видаляються."
fi
