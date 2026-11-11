#!/usr/bin/env bash

# rollback 명령: 트래픽 없이 실행 중인 다른 슬롯으로 nginx 전달 대상을 되돌린다.
# 컨테이너를 새로 띄우지 않으므로 대상이 없거나 정지돼 있으면 거부한다. 실패해도 컨테이너를 정지하지 않는다.
# 종료 코드는 lib-switch-upstream.sh에 있다.

source "$script_dir/lib-switch-upstream.sh"

rollback_check_args() { [[ "$#" -eq 0 ]] || preflight_fail "$usage"; }

# 롤백은 컨테이너를 전환하기만 하므로 Compose 파일에 의존하지 않는다.
rollback_prepare() { :; }

rollback_select_target() { select_other_target rollback; }

rollback_preflight() {
  [[ -n "$before_id" ]] || preflight_fail 'Rollback target does not exist; redeploy the previous version instead'
  [[ "$(docker inspect --format '{{.State.Running}}' "$before_id")" = true ]] || preflight_fail 'Rollback target is not running; redeploy the previous version instead'
}

rollback_run() {
  operation=rollback
  failure_note='Previous route verified; both containers left running'
  register_switch_handlers
  attempted=true
  log "Switching back to $target, which is still running"
  switch_to_target
}
