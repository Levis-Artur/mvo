#!/usr/bin/env bash
set -Eeuo pipefail

trap 'echo "Backup перервано." >&2; exit 130' INT

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib.sh
. "$ROOT_DIR/deploy/lib.sh"

on_error() {
  local exit_code=$?
  log "Backup завершився з помилкою."
  exit "$exit_code"
}

trap on_error ERR

require_linux
load_env_file
require_vars POSTGRES_DB POSTGRES_USER
require_docker

postgres_health="$(service_health postgres 2>/dev/null || true)"
if [[ "$postgres_health" != "healthy" && "$postgres_health" != "running" ]]; then
  fail "контейнер postgres не працює або не готовий."
fi

mkdir -p backups

timestamp="$(date +'%Y-%m-%d_%H-%M-%S')"
backup_path="backups/mvo_${timestamp}.sql.gz"

log "Створення PostgreSQL backup..."
"${COMPOSE[@]}" exec -T postgres pg_dump --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" |
  gzip -c > "$backup_path"

[[ -s "$backup_path" ]] || fail "backup-файл не створено або він порожній."
chmod 600 "$backup_path"

size="$(du -h "$backup_path" | awk '{print $1}')"
log "Backup створено: $backup_path"
log "Розмір: $size"

if [[ "${BACKUP_RETENTION_DAYS:-}" =~ ^[0-9]+$ && "${BACKUP_RETENTION_DAYS}" -gt 0 ]]; then
  log "Очищення backup-файлів старших за ${BACKUP_RETENTION_DAYS} днів..."
  find backups -maxdepth 1 -type f -name 'mvo_*.sql.gz' -mtime "+${BACKUP_RETENTION_DAYS}" -delete
else
  log "BACKUP_RETENTION_DAYS не задано або некоректний, старі backup-файли не видаляються."
fi
