#!/usr/bin/env bash

# One-time host bootstrap for the APP EC2. Run it manually, as an administrator:
#
#     sudo bash Infra/scripts/bootstrap-host.sh <runner-user>
#
# The CD workflow cannot do this itself: granting sudo requires sudo. Everything
# the deploy needs afterwards is handled by deploy-sub-tasks/host-prereqs.sh.
#
# SECURITY: this grants the GitHub Actions runner account passwordless root on
# this host. The deploy scripts need it (certbot, /etc/letsencrypt, systemd
# units), but it means anyone able to merge into release-be can run arbitrary
# root commands here. Protect that branch accordingly.

set -euo pipefail

SUDOERS_FILE=/etc/sudoers.d/90-bibbidi-runner

log() {
  printf '[bootstrap-host] %s\n' "$*"
}

fail() {
  printf '[bootstrap-host] ERROR: %s\n' "$*" >&2
  exit 1
}

resolve_runner_user() {
  local candidate="${1:-${SUDO_USER:-}}"
  [ -n "$candidate" ] || fail "usage: sudo bash bootstrap-host.sh <runner-user>"
  id -u "$candidate" >/dev/null 2>&1 || fail "no such user: $candidate"
  printf '%s' "$candidate"
}

grant_passwordless_sudo() {
  local user="$1"

  if [ -f "$SUDOERS_FILE" ] && grep -q "^${user} " "$SUDOERS_FILE"; then
    log "sudoers entry already present for $user"
    return 0
  fi

  local staged
  staged="$(mktemp)"
  printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$user" > "$staged"

  # Never install a sudoers file that has not been parsed successfully; a broken
  # one locks every account out of sudo.
  visudo -c -f "$staged" >/dev/null || {
    rm -f "$staged"
    fail "generated sudoers entry failed validation"
  }

  install -m 0440 -o root -g root "$staged" "$SUDOERS_FILE"
  rm -f "$staged"
  log "granted passwordless sudo to $user via $SUDOERS_FILE"
}

grant_docker_access() {
  local user="$1"

  getent group docker >/dev/null 2>&1 || fail "docker group is missing - install Docker Engine first"

  if id -nG "$user" | tr ' ' '\n' | grep -qx docker; then
    log "$user is already in the docker group"
    return 0
  fi

  usermod -aG docker "$user"
  log "added $user to the docker group - restart the runner service for it to take effect"
}

main() {
  [ "$(id -u)" -eq 0 ] || fail "run this script with sudo"

  local user
  user="$(resolve_runner_user "${1:-}")"

  grant_passwordless_sudo "$user"
  grant_docker_access "$user"

  log "done - re-run the deploy workflow"
}

main "$@"
