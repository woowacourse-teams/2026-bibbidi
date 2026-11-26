#!/usr/bin/env bash

# 배포 EC2의 디스크를 정리한다. CD가 매일 도는 systemd 타이머(bibbidi-disk-cleanup.timer)로 설치하고 배포 때도 한 번 실행한다.
# 정리가 배포 때만 돌면 배포가 뜸할 때 쌓이기만 한다. 다시 받거나 다시 생기는 것만 지운다.
#
#   - 72시간 넘은 미사용 Docker 이미지와 빌드 캐시. Blue/Green 대기 컨테이너의 이미지는 사용 중이라 남는다.
#   - GitHub Actions 러너 자동 업데이트가 남긴 이전 버전(bin.*, externals.*), _work/_update, 설치 tar, 14일 넘은 _diag 로그.
#     업데이트 직후 24시간은 이전 버전을 남긴다.
#   - journald 보관 용량을 200MB로 제한한다.
#
# root로 실행한다.

set -euo pipefail

JOURNAL_LIMIT_FILE=/etc/systemd/journald.conf.d/90-bibbidi-disk-limit.conf

log() {
  printf '[disk-cleanup] %s\n' "$*"
}

prune_docker() {
  log "Docker image: $(docker image prune --all --force --filter 'until=72h' | tail -n 1)"
  log "Docker build cache: $(docker builder prune --all --force --filter 'until=72h' | tail -n 1)"
}

runner_dirs() {
  local unit
  systemctl list-units --type=service --all --no-legend --plain 'actions.runner.*' | awk '{print $1}' |
    while read -r unit; do
      systemctl show --property=WorkingDirectory --value "$unit"
    done
}

updated_within_a_day() {
  [[ -n "$(find "$1" -maxdepth 0 -mmin -1440)" ]]
}

remove_old_runner_versions() {
  local dir="$1" name current path
  for name in bin externals; do
    [[ -L "$dir/$name" ]] || continue
    if updated_within_a_day "$dir/$name"; then
      log "$dir/$name changed within a day; keep previous versions"
      continue
    fi
    current="$(readlink -f "$dir/$name")"
    for path in "$dir/$name".*; do
      [[ -d "$path" && "$(readlink -f "$path")" != "$current" ]] || continue
      log "remove $path"
      rm -rf -- "$path"
    done
  done
}

clean_runner() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  remove_old_runner_versions "$dir"
  if [[ -d "$dir/_work/_update" ]] && ! updated_within_a_day "$dir/_work/_update"; then
    log "remove $dir/_work/_update"
    rm -rf -- "$dir/_work/_update"
  fi
  find "$dir" -maxdepth 1 -type f -name 'actions-runner-*.tar.gz' -print -delete
  if [[ -d "$dir/_diag" ]]; then
    find "$dir/_diag" -maxdepth 1 -type f -name '*.log' -mtime +14 -delete
  fi
}

limit_journal() {
  local wanted=$'[Journal]\nSystemMaxUse=200M'
  if [[ "$(cat "$JOURNAL_LIMIT_FILE" 2>/dev/null)" != "$wanted" ]]; then
    install -d -m 0755 "$(dirname "$JOURNAL_LIMIT_FILE")"
    printf '%s\n' "$wanted" > "$JOURNAL_LIMIT_FILE"
    systemctl restart systemd-journald
    log "journald limited to 200M"
  fi
}

main() {
  [[ "$(id -u)" -eq 0 ]] || { log "run as root"; exit 1; }
  log "before: $(df -h / | awk 'NR == 2 {print $3 " used, " $5}')"
  prune_docker
  local dir
  while read -r dir; do
    if [[ -n "$dir" ]]; then
      clean_runner "$dir"
    fi
  done < <(runner_dirs)
  limit_journal
  log "after: $(df -h / | awk 'NR == 2 {print $3 " used, " $5}')"
}

main "$@"
