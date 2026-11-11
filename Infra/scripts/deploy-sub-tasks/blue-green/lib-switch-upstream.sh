#!/usr/bin/env bash

# 대상 컨테이너가 준비되면 nginx 전달 대상을 바꾸고 새 경로를 확인하는 절차다. 배포와 롤백이 함께 쓴다.
# source로 불러오며 lib-inspect.sh가 먼저 필요하다.
#
# switch_to_target을 부르기 전에 호출하는 쪽이 정해 둘 값:
#   operation     deploy 또는 rollback. 로그에 쓴다
#   failure_note  실패해 이전 경로를 확인한 뒤 남길 문장
#   attempted     true
# 실패한 대상 컨테이너를 정리해야 하면 stop_failed_target을 다시 정의한다.
#
# 종료 코드
#   0   전환을 마쳤고 다른 앱은 계속 실행 중이다
#   10  전환 전에 실패했다. 되돌릴 것이 없다(배포: 새 앱은 정지되었거나 없다)
#   20  설정을 교체한 뒤 새 경로를 검증하다 실패해 이전 경로로 복원했다(배포: 새 앱은 정지했다)
#   30  복구를 검증하지 못했다
#   40  전환은 검증했으나 이후 확인에 실패했다. 자동 롤백이나 정지는 하지 않았다
#   64  사전 점검에 실패했다

owned_id=''
backup=''
candidate=''
attempted=false
changed=false
switched=false
complete=false
operation=''
failure_note=''

backend_ready() {
  curl --noproxy '*' --fail --silent --connect-timeout 1 --max-time 3 "http://127.0.0.1:$health_port/actuator/health" 2>/dev/null |
    python3 -c 'import json, sys; sys.exit(json.load(sys.stdin).get("status") != "UP")' 2>/dev/null &&
    [[ "$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' --connect-timeout 1 --max-time 3 "http://127.0.0.1:$app_port/api/catalog" 2>/dev/null)" = 200 ]]
}

remember_target() {
  local found
  found="$(target_id)" || return 1
  [[ -n "$found" ]] || return 0
  [[ -z "$owned_id" || "$owned_id" = "$found" ]] || return 1
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}} {{index .Config.Labels "com.docker.compose.service"}}' "$found")" = "$project $target" ]] || return 1
  owned_id="$found"
}

# 실패한 대상 컨테이너를 정리한다. 기본은 아무것도 하지 않는다. 롤백의 대상은 정상인 이전 앱이라 정지하면 안 된다.
stop_failed_target() { return 0; }

finish() {
  local cause=$? result=30 rollback_workers=''
  set +e
  trap - EXIT INT TERM
  if [[ "$complete" = true ]]; then result=0
  elif [[ "$switched" = true ]]; then
    result=40
    log 'Cutover was verified; a later check failed. No automatic rollback or further stops; both apps are left running.'
  elif [[ "$attempted" = true ]]; then
    log "$operation failed (command status $cause)"
    if [[ "$changed" = true ]]; then
      log 'Restoring previous upstream before considering cleanup'
      if [[ -n "$candidate" ]]; then rm -f "$candidate"; fi
      candidate="$(mktemp "$upstream_dir/.restore.conf.XXXXXX")"
      if cp "$backup" "$candidate" && chmod 0644 "$candidate" && mv -f "$candidate" "$active" &&
         docker exec nginx nginx -t && rollback_workers="$(workers)" &&
         docker exec nginx nginx -s reload && wait_for_proxy "$previous_ip" "$rollback_workers" &&
         wait_for_drain "$previous_ip" "$rollback_workers" && stop_failed_target; then result=20; fi
    elif [[ "$(cat "$active")" = "$original_config" ]] && wait_for_proxy "$previous_ip" && stop_failed_target; then result=10
    fi
  else result=64
  fi
  if [[ "$result" -eq 30 ]]; then
    log "Recovery could not be verified; no further automatic stop. Backup: ${backup:-not-created}"
  elif [[ "$result" -eq 40 ]]; then
    log "Previous configuration retained at $backup"
  else
    if [[ -n "$backup" ]]; then rm -f "$backup"; fi
    if [[ "$result" -eq 10 || "$result" -eq 20 ]]; then log "$failure_note"; fi
  fi
  if [[ -n "$candidate" ]]; then rm -f "$candidate"; fi
  exit "$result"
}

register_switch_handlers() {
  trap finish EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

# 대상 컨테이너가 준비되면 nginx 전달 대상을 바꾸고, 새 경로와 기존 요청 종료를 확인한다.
# 이전 앱은 정지하지 않는다. 그래야 롤백이 nginx 전환만으로 끝난다.
# 이전 앱은 cleanup 명령이나 다음 배포의 시작 단계에서 지운다.
switch_to_target() {
  local mapping inside outside deadline ready before_switch target_ip
  remember_target || fail 'Could not identify the target container'
  [[ -n "$owned_id" ]] || fail 'The target container does not exist'
  for mapping in "8080:$app_port" "8081:$health_port"; do
    inside="${mapping%%:*}"; outside="${mapping##*:}"
    [[ "$(docker inspect --format "{{range index .NetworkSettings.Ports \"$inside/tcp\"}}{{.HostIp}}:{{.HostPort}} {{end}}" "$owned_id")" = "127.0.0.1:$outside " ]] || fail 'Unexpected target port binding'
  done
  target_ip="$(docker inspect --format '{{with index .NetworkSettings.Networks "bibbidi-observability"}}{{.IPAddress}}{{end}}' "$owned_id")"
  [[ -n "$target_ip" ]] || fail 'Target must join bibbidi-observability'
  deadline=$((SECONDS + health_timeout)); ready=false
  while (( SECONDS < deadline )); do
    if backend_ready; then ready=true; break; fi
    sleep 1
  done
  [[ "$ready" = true ]] || fail 'Target did not become ready'
  wait_for_proxy "$previous_ip" || fail 'Previous route changed during preparation'
  [[ "$(cat "$active")" = "$original_config" ]] || fail 'active.conf changed outside this deployment'
  before_switch="$(workers)"
  backup="$(mktemp "$upstream_dir/.previous.conf.XXXXXX")"
  cp "$active" "$backup"
  candidate="$(mktemp "$upstream_dir/.next.conf.XXXXXX")"
  printf 'server %s:8080;\n' "$target" > "$candidate"
  chmod 0644 "$candidate"
  changed=true
  mv -f "$candidate" "$active"
  docker exec nginx nginx -t
  docker exec nginx nginx -s reload
  wait_for_proxy "$target_ip" "$before_switch" || fail 'Selected backend did not answer through a new nginx worker'
  switched=true
  log "Cutover to $target verified; waiting for previous requests to finish"
  wait_for_drain "$target_ip" "$before_switch" || fail 'Previous requests did not drain or the new route could not be verified'
  [[ "$(cat "$active")" = "server $target:8080;" ]] || fail 'active.conf changed after cutover'
  [[ "$(docker inspect --format '{{.Id}}' "$target_name")" = "$owned_id" ]] || fail 'Selected container was replaced after cutover'
  [[ "$(docker inspect --format '{{.Id}} {{.State.StartedAt}}' "bibbidi-$previous")" = "$previous_instance" ]] || fail 'Previous container changed after cutover'
  proxy_uses "$target_ip" "$before_switch" || fail 'Cannot verify selected route after cutover'
  complete=true
  log "$operation complete: $target is selected and $previous keeps running without traffic"
}
