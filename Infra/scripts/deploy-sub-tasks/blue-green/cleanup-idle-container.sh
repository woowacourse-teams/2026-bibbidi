#!/usr/bin/env bash

# cleanup 명령: 트래픽을 받지 않는 컨테이너를 정지하고 삭제한다. 서비스 중인 컨테이너는 지우지 않는다.
# nginx worker가 이전 요청을 마치는 중이면 거부한다.
# 종료 코드: 0 완료(지울 컨테이너가 없어도 0), 30 정리를 검증하지 못함, 64 사전 점검 실패.

source "$script_dir/lib-remove-container.sh"

cleanup_attempted=false
cleanup_complete=false

cleanup_finish() {
  local cause=$? result=64
  trap - EXIT INT TERM
  if [[ "$cleanup_complete" = true ]]; then
    result=0
  elif [[ "$cleanup_attempted" = true ]]; then
    result=30
    log "Cleanup failed (command status $cause); check the container state manually"
  fi
  exit "$result"
}

cleanup_check_args() { [[ "$#" -eq 0 ]] || preflight_fail "$usage"; }

cleanup_prepare() { check_log_tail_lines; }

cleanup_select_target() { select_other_target cleanup; }

cleanup_preflight() { :; }

cleanup_run() {
  trap cleanup_finish EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  if [[ -z "$before_id" ]]; then
    log "No $target_name container to remove"
  else
    require_no_draining || preflight_fail 'Nginx is still finishing earlier requests; retry later'
    cleanup_attempted=true
    log "Removing $target_name, which receives no traffic"
    remove_idle_target "$before_id" || fail "Could not remove $target_name"
  fi
  cleanup_complete=true
  log "Cleanup complete: $previous keeps serving"
}
