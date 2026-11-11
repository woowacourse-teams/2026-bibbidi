#!/usr/bin/env bash

# deploy 명령: 이미 내려받은 이미지로 비활성 슬롯을 띄우고 그 슬롯으로 전환한다.
# 이전 배포가 남긴 같은 슬롯의 트래픽 없는 컨테이너는 시작 전에 정지하고 삭제한다.
# 실패하면 새 컨테이너를 정지하고 이전 경로를 유지한다. 종료 코드는 lib-switch-upstream.sh에 있다.

source "$script_dir/lib-switch-upstream.sh"
source "$script_dir/lib-remove-container.sh"

deploy_check_args() {
  [[ "$#" -eq 2 ]] || preflight_fail "$usage"
  deploy_slot="$1"
  tag="$2"
  case "$deploy_slot" in blue|green) ;; *) preflight_fail "$usage" ;; esac
  [[ "$tag" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || preflight_fail 'Invalid image tag'
}

deploy_prepare() {
  local file
  check_log_tail_lines
  base="${BIBBIDI_BASE_COMPOSE_FILE:-$app_dir/compose.yaml}"
  overlay="$app_dir/compose.blue-green.yml"
  for file in "$base" "$overlay" "$app_dir/.env" "$app_dir/infra/monitoring/.env.alloy"; do
    [[ -f "$file" ]] || preflight_fail 'Required Compose or environment file is missing'
  done
}

deploy_select_target() { select_target "$deploy_slot"; }

deploy_preflight() { :; }

compose() {
  BIBBIDI_BASE_COMPOSE_FILE="$base" IMAGE_TAG="$tag" BLUE_IMAGE_TAG="$tag" GREEN_IMAGE_TAG="$tag" \
    docker compose --project-name "$project" --project-directory "$app_dir" \
      --env-file "$app_dir/.env" --env-file "$app_dir/infra/monitoring/.env.alloy" \
      -f "$base" -f "$overlay" --profile "$deploy_slot" "$@"
}

# 이전 경로를 다시 확인한 뒤에만 호출된다. 정지 대기 시간은 Compose의 stop_grace_period를 따른다.
stop_failed_target() {
  remember_target || return 1
  [[ -n "$owned_id" ]] || return 0
  log "Stopping this deployment's failed $target container"
  docker stop "$owned_id" >/dev/null || return 1
  [[ "$(docker inspect --format '{{.State.Running}} {{.State.Restarting}}' "$owned_id")" = 'false false' ]]
}

deploy_run() {
  operation=deploy
  failure_note='Previous route verified; failed new container stopped or absent'
  register_switch_handlers
  compose config --quiet >/dev/null 2>&1 || fail 'Compose configuration invalid; no new container started'
  if [[ -n "$before_id" ]]; then
    require_no_draining || preflight_fail 'Nginx is still finishing earlier requests; no new container started'
    log "Removing the idle $target_name left by an earlier deployment"
    remove_idle_target "$before_id" || preflight_fail 'Could not remove the idle container; no new container started'
  fi
  attempted=true
  log "Starting inactive $target from the prepared image"
  compose up -d --no-deps --no-build --pull never "$target"
  switch_to_target
}
