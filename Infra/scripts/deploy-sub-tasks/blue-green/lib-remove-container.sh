#!/usr/bin/env bash

# 트래픽을 받지 않는 컨테이너를 정지하고 삭제하는 함수다. source로 불러오며 lib-inspect.sh가 먼저 필요하다.

# CLEANUP_LOG_TAIL_LINES(기본 0, 끔)는 삭제 직전에 컨테이너의 마지막 로그를 출력한다.
# 로그에 사용자 데이터가 있을 수 있어, 접근이 제한된 곳으로 출력할 때만 켠다.
check_log_tail_lines() {
  log_tail_lines="${CLEANUP_LOG_TAIL_LINES:-0}"
  [[ "$log_tail_lines" =~ ^[0-9]{1,3}$ ]] || preflight_fail 'CLEANUP_LOG_TAIL_LINES must be 0-999'
}

# 트래픽을 받지 않는 컨테이너에만 쓴다. 정지 대기 시간은 Compose의 stop_grace_period를 그대로 따른다.
remove_idle_target() {
  local id="$1"
  if (( log_tail_lines > 0 )); then
    log "Last $log_tail_lines log lines of $target_name before removal"
    docker logs --tail "$log_tail_lines" "$id" 2>&1 | sed 's/^/[container-log] /' || true
  fi
  docker stop "$id" >/dev/null || return 1
  [[ "$(docker inspect --format '{{.State.Running}} {{.State.Restarting}}' "$id")" = 'false false' ]] || return 1
  docker rm "$id" >/dev/null || return 1
  [[ -z "$(target_id)" ]]
}
