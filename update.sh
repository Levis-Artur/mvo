#!/usr/bin/env bash
set -Eeuo pipefail

trap 'echo "Оновлення перервано." >&2; exit 130' INT

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# shellcheck source=deploy/lib.sh
. "$ROOT_DIR/deploy/lib.sh"

on_error() {
  local exit_code=$?
  log "Оновлення завершилося з помилкою. Останні логи сервісів:"
  compose_logs_tail
  exit "$exit_code"
}

trap on_error ERR

require_linux

if [[ -n "$(git status --porcelain)" ]]; then
  fail "working tree має локальні зміни. Збережіть або приберіть їх перед оновленням."
fi

log "Отримання оновлень із GitHub..."
git pull --ff-only origin main

load_env_file
require_vars POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD DATABASE_URL PUBLIC_PORT CORS_ORIGIN
validate_production_password
require_docker

log "Перевірка production compose..."
compose_config

log "Перебудова production images..."
"${COMPOSE[@]}" build

log "Запуск PostgreSQL..."
"${COMPOSE[@]}" up -d postgres
wait_for_service postgres 120

log "Застосування production migrations Prisma..."
"${COMPOSE[@]}" run --rm api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

log "Перезапуск production-сервісів..."
"${COMPOSE[@]}" up -d --build
wait_for_service api 180

log "Перевірка API через Nginx..."
check_nginx_api

log "Перевірка frontend через Nginx..."
check_nginx_frontend

log "Стан сервісів:"
"${COMPOSE[@]}" ps
