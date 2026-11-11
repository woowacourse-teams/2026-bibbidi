#!/usr/bin/env bash

# Blue/Green 스크립트가 함께 쓰는 상태 조회·검증 함수다. source로 불러오며, 불러오는 쪽이
# 먼저 set -euo pipefail을 설정해야 한다. preflight_fail은 종료 코드 64로 끝낸다.

log() { printf '[blue-green] %s\n' "$*"; }
fail() { printf '[blue-green] ERROR: %s\n' "$*" >&2; exit 1; }
preflight_fail() { printf '[blue-green] ERROR: %s\n' "$*" >&2; exit 64; }

slot_ports() {
  case "$1" in
    blue) app_port=8080; health_port=8081 ;;
    green) app_port=8082; health_port=8083 ;;
  esac
}

# 필요한 명령과 제한 시간(초) 세 개를 확인한다. 운영 기본값은 없다.
check_environment() {
  local command timeout
  for command in docker curl python3 flock; do
    command -v "$command" >/dev/null || preflight_fail "Missing command: $command"
  done
  health_timeout="${HEALTHCHECK_TIMEOUT_SECONDS:-}"
  proxy_timeout="${PROXY_VERIFY_TIMEOUT_SECONDS:-}"
  drain_timeout="${DRAIN_TIMEOUT_SECONDS:-}"
  for timeout in "$health_timeout" "$proxy_timeout" "$drain_timeout"; do
    [[ "$timeout" =~ ^[1-9][0-9]{0,3}$ ]] || preflight_fail 'Set all three deadlines to positive integer seconds (up to 9999)'
  done
}

load_paths() {
  app_dir="${EC2_DEPLOY_PATH:-/opt/bibbidi/app}"
  upstream_dir="${NGINX_UPSTREAM_DIR:-$app_dir/infra/nginx/upstream}"
}

# 락을 잡고 현재 서비스 중인 백엔드(previous)와 nginx 상태를 읽는다.
# 롤백에서는 previous가 되돌리기 직전에 서비스하던 백엔드를 뜻한다.
read_live_state() {
  upstream_dir="$(cd "$upstream_dir" && pwd -P)" || preflight_fail 'Upstream directory is unavailable'
  active="$upstream_dir/active.conf"
  [[ -f "$active" && ! -L "$active" ]] || preflight_fail 'active.conf must be an existing regular file'
  # 운영 준비 스크립트가 잡은 락의 디스크립터를 물려받았으면 그대로 쓴다.
  # 다시 열면 별도 락 소유자가 되어, 자기 부모가 잡은 락에 막힌다.
  if [[ ! /proc/$$/fd/9 -ef "$upstream_dir/.switch.lock" ]]; then
    exec 9>"$upstream_dir/.switch.lock" || preflight_fail 'Cannot open deployment lock'
  fi
  flock -n 9 || preflight_fail 'Another deployment is in progress'
  mounted="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/nginx/bibbidi-upstream"}}{{.Source}} {{.RW}}{{end}}{{end}}' nginx)" || preflight_fail 'Cannot inspect nginx mount'
  [[ "$mounted" = "$upstream_dir false" ]] || preflight_fail 'nginx must mount this upstream directory read-only'
  original_config="$(cat "$active")" || preflight_fail 'Cannot read active.conf'
  case "$(printf '%s' "$original_config" | sed 's/#.*//' | tr -d '[:space:]')" in
    'serverbackend:8080;') previous=backend ;;
    'serverbackend-blue:8080;') previous=backend-blue ;;
    'serverbackend-green:8080;') previous=backend-green ;;
    *) preflight_fail 'active.conf must select exactly one known backend' ;;
  esac
  [[ "$(docker inspect --format '{{.State.Running}}' "bibbidi-$previous")" = true ]] || preflight_fail 'Previous backend is not running'
  previous_instance="$(docker inspect --format '{{.Id}} {{.State.StartedAt}}' "bibbidi-$previous")" || preflight_fail 'Cannot inspect previous instance'
  previous_id="${previous_instance%% *}"
  project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$previous_id")" || preflight_fail 'Cannot inspect previous project'
  [[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || preflight_fail 'Previous backend must belong to a Compose project'
  previous_ip="$(docker inspect --format '{{with index .NetworkSettings.Networks "bibbidi-observability"}}{{.IPAddress}}{{end}}' "$previous_id")" || preflight_fail 'Cannot inspect previous address'
  [[ -n "$previous_ip" ]] || preflight_fail 'Previous backend must join bibbidi-observability'
  nginx_instance="$(docker inspect --format '{{.Id}} {{.State.StartedAt}}' nginx)" || preflight_fail 'Cannot inspect nginx instance'
}

# 대상 슬롯을 정한다. 배포는 받은 슬롯을, 롤백과 정리는 서비스 중이 아닌 슬롯을 쓴다.
select_target() {
  slot="$1"
  slot_ports "$slot"
  target="backend-$slot"
  target_name="bibbidi-$target"
  [[ "$previous" != "$target" ]] || preflight_fail 'The target is already the selected backend'
}

select_other_target() {
  case "$previous" in
    backend-blue) select_target green ;;
    backend-green) select_target blue ;;
    *) preflight_fail "$1 requires a selected Blue/Green backend" ;;
  esac
}

target_id() {
  docker container ls -a --no-trunc --filter "name=^/$target_name$" --format '{{.ID}}'
}

# 이미 남아 있는 대상 컨테이너(before_id)가 같은 Compose 프로젝트·서비스인지 확인한다.
inspect_target() {
  before_id="$(target_id)" || preflight_fail 'Cannot inspect target container'
  if [[ -n "$before_id" ]]; then
    [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}} {{index .Config.Labels "com.docker.compose.service"}}' "$before_id")" = "$project $target" ]] || preflight_fail 'Existing target belongs to another deployment'
  fi
}

# 프로세스 시작 시각도 함께 기록한다. PID가 재사용돼도 이전 worker로 오인하지 않기 위해서다.
worker_snapshot() {
  [[ "$(docker inspect --format '{{.Id}} {{.State.StartedAt}}' nginx)" = "$nginx_instance" ]] || return 1
  docker exec nginx sh -eu -c '
    master=$(cat /var/run/nginx.pid)
    printf "master:%s:%s\n" "$master" "$(awk "{print \$22}" "/proc/$master/stat")"
    for pid in $(cat "/proc/$master/task/$master/children"); do
      start=$(awk "{print \$22}" "/proc/$pid/stat" 2>/dev/null) || continue
      args=$(tr "\000" " " < "/proc/$pid/cmdline") || continue
      state=active
      case "$args" in *"shutting down"*) state=draining ;; esac
      printf "%s:%s:%s\n" "$pid" "$start" "$state"
    done
  '
}
workers() {
  local snapshot
  snapshot="$(worker_snapshot)" || return 1
  [[ "${snapshot%%$'\n'*}" = "$nginx_master" ]] || return 1
  printf '%s\n' "$snapshot" | awk -F: '
    NR == 1 { if ($1 != "master" || $2 !~ /^[0-9]+$/ || $3 !~ /^[0-9]+$/) exit 1 }
    NR > 1 { if (NF != 3 || $1 !~ /^[0-9]+$/ || $2 !~ /^[0-9]+$/ || $3 !~ /^(active|draining)$/) exit 1 }
    END { if (NR < 2) exit 1 }
  ' || return 1
  printf '%s\n' "$snapshot" | tail -n +2
}
proxy_uses() {
  local headers
  headers="$(docker exec nginx wget -q -S -T 3 -O /dev/null http://127.0.0.1:8080/_deployment/verify 2>&1)" || return 1
  printf '%s\n' "$headers" | tr -d '\r' | awk -v expected="$1:8080" -v baseline="$(printf '%s' "${2:-}" | tr '\n' ' ')" '
    $1 ~ /^HTTP\// { status = $2 }
    tolower($1) == "x-bibbidi-upstream:" { address = $2 }
    tolower($1) == "x-bibbidi-worker:" { worker = $2 }
    END {
      if (status != 200 || address != expected || worker !~ /^[0-9]+$/) exit 1
      count = split(baseline, records, /[[:space:]]+/)
      for (i = 1; i <= count; i++) { split(records[i], fields, ":"); if (fields[1] == worker) exit 1 }
    }
  '
}
wait_for_proxy() {
  local deadline=$((SECONDS + proxy_timeout))
  while (( SECONDS < deadline )); do
    workers >/dev/null || return 1
    if proxy_uses "$1" "${2:-}"; then return 0; fi
    sleep 1
  done
  return 1
}
wait_for_drain() {
  local deadline=$((SECONDS + drain_timeout)) expected_ip="$1" baseline="$2" current
  while (( SECONDS < deadline )); do
    current="$(workers)" || return 1
    if proxy_uses "$expected_ip" "$baseline" && printf '%s\n' "$current" | awk -v baseline="$(printf '%s' "$baseline" | tr '\n' ' ')" '
      BEGIN { n = split(baseline, records, /[[:space:]]+/); for (i = 1; i <= n; i++) { split(records[i], f, ":"); old[f[1] ":" f[2]] = 1 } }
      NF { split($0, f, ":"); if (old[f[1] ":" f[2]] || f[3] == "draining") pending = 1 }
      END { exit pending }
    '; then return 0; fi
    sleep 1
  done
  return 1
}

# 종료 중인 nginx worker가 남아 있으면 그 worker가 보낸 요청이 아직 컨테이너에서 처리 중일 수 있어, 컨테이너를 지우면 안 된다.
require_no_draining() {
  local current
  current="$(workers)" || return 1
  ! printf '%s\n' "$current" | grep -q ':draining$'
}

# nginx 설정과 현재 서비스 경로가 정상인지 확인한다. 아무것도 바꾸기 전에 호출한다.
verify_live_route() {
  initial_workers="$(worker_snapshot)" || preflight_fail 'Cannot inspect nginx workers'
  nginx_master="${initial_workers%%$'\n'*}"
  docker exec nginx nginx -t || preflight_fail 'Current nginx configuration is invalid'
  wait_for_proxy "$previous_ip" || preflight_fail 'Current live route cannot be verified; nothing was changed'
}
