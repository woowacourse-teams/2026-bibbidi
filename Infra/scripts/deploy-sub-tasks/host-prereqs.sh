#!/usr/bin/env bash

# Preflight for the APP EC2, run by the CD workflow on every deploy.
#
# Everything here is idempotent: it verifies what the deploy needs and installs
# what it can. It deliberately cannot grant its own sudo rights - see
# Infra/scripts/bootstrap-host.sh for the one-time step an administrator runs.

set -euo pipefail

APT_UPDATED=0

log() {
  printf '[host-prereqs] %s\n' "$*"
}

fail() {
  printf '[host-prereqs] ERROR: %s\n' "$*" >&2
  exit 1
}

have() {
  command -v "$1" >/dev/null 2>&1
}

require_passwordless_sudo() {
  if sudo -n true 2>/dev/null; then
    log "passwordless sudo: ok"
    return 0
  fi

  cat >&2 <<'GUIDE'
[host-prereqs] The deploy needs passwordless sudo, and it cannot grant that to
[host-prereqs] itself. Log in to the APP EC2 as an administrator once and run:
[host-prereqs]
[host-prereqs]     sudo bash Infra/scripts/bootstrap-host.sh <runner-user>
[host-prereqs]
[host-prereqs] then re-run this deploy.
GUIDE
  fail "passwordless sudo is not available for user $(id -un)"
}

apt_update_once() {
  if [ "$APT_UPDATED" -eq 0 ]; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get update -y
    APT_UPDATED=1
  fi
}

ensure_apt_command() {
  local cmd="$1"
  local pkg="$2"

  if have "$cmd"; then
    log "$cmd: ok"
    return 0
  fi

  log "$cmd missing - installing $pkg"
  apt_update_once
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$pkg"
  have "$cmd" || fail "installing $pkg did not provide $cmd"
  log "$cmd: installed"
}

ensure_certbot() {
  if have certbot; then
    log "certbot: $(certbot --version 2>&1 | head -n 1)"
    return 0
  fi

  log "certbot missing - installing"
  if have snap; then
    sudo snap install --classic certbot
    if [ ! -e /usr/bin/certbot ]; then
      sudo ln -sf /snap/bin/certbot /usr/bin/certbot
    fi
  else
    apt_update_once
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y certbot
  fi

  have certbot || fail "certbot installation did not put certbot on PATH"
  log "certbot: $(certbot --version 2>&1 | head -n 1)"
}

require_docker() {
  have docker || fail "docker is not installed on this host"

  if ! docker info >/dev/null 2>&1; then
    fail "user $(id -un) cannot reach the Docker daemon - add it to the docker group and restart the runner"
  fi
  log "docker: ok"
}

require_systemd() {
  have systemctl || fail "systemctl is not available, so the renewal timer cannot be installed"
  log "systemd: ok"
}

main() {
  require_passwordless_sudo
  require_docker
  require_systemd
  ensure_apt_command envsubst gettext-base
  ensure_apt_command openssl openssl
  ensure_apt_command curl curl
  ensure_certbot
  log "all prerequisites satisfied"
}

main "$@"
