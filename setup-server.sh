#!/usr/bin/env bash
set -Eeuo pipefail

trap 'echo "Скрипт перервано." >&2; exit 130' INT

log() {
  printf '%s\n' "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

fail() {
  printf '%s\n' "Помилка: $*" >&2
  exit 1
}

[[ "$(uname -s)" == "Linux" ]] || fail "setup-server.sh потрібно запускати на Debian або Ubuntu сервері."
[[ -r /etc/os-release ]] || fail "не вдалося прочитати /etc/os-release."

# shellcheck disable=SC1091
. /etc/os-release

case "${ID:-}" in
  debian | ubuntu) ;;
  *) fail "підтримуються лише Debian або Ubuntu." ;;
esac

command -v sudo >/dev/null 2>&1 || fail "sudo не встановлено."

if [[ "${EUID}" -eq 0 ]]; then
  SUDO=()
else
  SUDO=(sudo)
fi

install_prerequisites() {
  log "Встановлення базових пакетів..."
  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" apt-get install -y ca-certificates curl gnupg git openssl
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker і Docker Compose plugin уже встановлені."
    return
  fi

  log "Підключення офіційного Docker apt repository..."
  "${SUDO[@]}" install -m 0755 -d /etc/apt/keyrings

  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL "https://download.docker.com/linux/${ID}/gpg" |
      "${SUDO[@]}" tee /etc/apt/keyrings/docker.asc >/dev/null
    "${SUDO[@]}" chmod a+r /etc/apt/keyrings/docker.asc
  fi

  local arch codename repo_file
  arch="$(dpkg --print-architecture)"
  codename="${VERSION_CODENAME:-}"
  [[ -n "$codename" ]] || fail "не вдалося визначити VERSION_CODENAME."
  repo_file="/etc/apt/sources.list.d/docker.list"

  if [[ ! -f "$repo_file" ]]; then
    printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
      "$arch" "$ID" "$codename" |
      "${SUDO[@]}" tee "$repo_file" >/dev/null
  fi

  "${SUDO[@]}" apt-get update
  "${SUDO[@]}" apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

enable_docker() {
  log "Увімкнення Docker service..."
  "${SUDO[@]}" systemctl enable --now docker
}

add_user_to_docker_group() {
  local target_user
  target_user="${SUDO_USER:-${USER:-}}"

  if [[ -z "$target_user" || "$target_user" == "root" ]]; then
    log "Звичайного користувача не визначено, пропускаю додавання до групи docker."
    return
  fi

  if id -nG "$target_user" | tr ' ' '\n' | grep -qx docker; then
    log "Користувач $target_user уже входить до групи docker."
    return
  fi

  log "Додавання користувача $target_user до групи docker..."
  "${SUDO[@]}" usermod -aG docker "$target_user"
}

install_prerequisites
install_docker
enable_docker
add_user_to_docker_group

log "Перевірка Docker:"
docker --version
docker compose version

cat <<'MESSAGE'

Підготовку сервера завершено.
Вийдіть із SSH-сесії та зайдіть повторно, щоб група docker застосувалася до вашого користувача.
Deployment автоматично не запускався.
MESSAGE
