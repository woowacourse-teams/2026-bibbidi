#!/usr/bin/env bash

# Blue/Green operations on one host. No EC2/DNS changes.
#   deploy-blue-green.sh {blue|green} IMAGE_TAG
#       Start the inactive slot from an already downloaded image and switch to it.
#       The previous app keeps running without traffic so it can be switched back to.
#   deploy-blue-green.sh rollback
#       Switch back to the other slot, which must still be running.
#   deploy-blue-green.sh cleanup
#       Stop and remove the app that receives no traffic.
# Required deadlines (seconds): HEALTHCHECK_TIMEOUT_SECONDS,
# PROXY_VERIFY_TIMEOUT_SECONDS, DRAIN_TIMEOUT_SECONDS. No production defaults.
# Optional: CLEANUP_LOG_TAIL_LINES (default 0 = off) prints the last log lines of a
# container just before it is removed. Logs may contain user data, so keep it off
# unless the output goes somewhere access-controlled.
# Exit: 0 done (deploy/rollback: switched and the other app kept running);
# 10 failed before switch and nothing is left to undo (deploy: new app stopped/absent);
# 20 restored the previous route (deploy: new app stopped); 30 recovery/cleanup unverified;
# 40 cutover was verified, a later check failed (no automatic rollback or stop);
# 64 preflight failed.
set -euo pipefail
log() { printf '[blue-green] %s\n' "$*"; }
fail() { printf '[blue-green] ERROR: %s\n' "$*" >&2; exit 1; }
preflight_fail() { printf '[blue-green] ERROR: %s\n' "$*" >&2; exit 64; }

usage='Usage: deploy-blue-green.sh {blue|green} IMAGE_TAG | rollback | cleanup'
[[ "$#" -ge 1 ]] || preflight_fail "$usage"
mode="$1"
slot=''
tag=''
case "$mode" in
  blue|green)
    [[ "$#" -eq 2 ]] || preflight_fail "$usage"
    slot="$mode"
    tag="$2"
    mode=deploy
    [[ "$tag" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || preflight_fail 'Invalid image tag' ;;
  rollback|cleanup) [[ "$#" -eq 1 ]] || preflight_fail "$usage" ;;
  *) preflight_fail "$usage" ;;
esac
slot_ports() {
  case "$1" in
    blue) app_port=8080; health_port=8081 ;;
    green) app_port=8082; health_port=8083 ;;
  esac
}
[[ -z "$slot" ]] || slot_ports "$slot"
for command in docker curl python3 flock; do
  command -v "$command" >/dev/null || preflight_fail "Missing command: $command"
done
health_timeout="${HEALTHCHECK_TIMEOUT_SECONDS:-}"
proxy_timeout="${PROXY_VERIFY_TIMEOUT_SECONDS:-}"
drain_timeout="${DRAIN_TIMEOUT_SECONDS:-}"
for timeout in "$health_timeout" "$proxy_timeout" "$drain_timeout"; do
  [[ "$timeout" =~ ^[1-9][0-9]{0,3}$ ]] || preflight_fail 'Set all three deadlines to positive integer seconds (up to 9999)'
done
log_tail_lines="${CLEANUP_LOG_TAIL_LINES:-0}"
[[ "$log_tail_lines" =~ ^[0-9]{1,3}$ ]] || preflight_fail 'CLEANUP_LOG_TAIL_LINES must be 0-999'
app_dir="${EC2_DEPLOY_PATH:-/opt/bibbidi/app}"
base="${BIBBIDI_BASE_COMPOSE_FILE:-$app_dir/compose.yaml}"
overlay="$app_dir/compose.blue-green.yml"
upstream_dir="${NGINX_UPSTREAM_DIR:-$app_dir/infra/nginx/upstream}"
# Rollback and cleanup only switch or remove containers, so they must not depend on Compose files.
if [[ "$mode" = deploy ]]; then
  for file in "$base" "$overlay" "$app_dir/.env" "$app_dir/infra/monitoring/.env.alloy"; do
    [[ -f "$file" ]] || preflight_fail 'Required Compose or environment file is missing'
  done
fi
upstream_dir="$(cd "$upstream_dir" && pwd -P)" || preflight_fail 'Upstream directory is unavailable'
active="$upstream_dir/active.conf"
[[ -f "$active" && ! -L "$active" ]] || preflight_fail 'active.conf must be an existing regular file'
# Reuse the production preparation script's descriptor when inherited. Opening
# it again would create a separate lock owner and reject our own child process.
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
# Rollback and cleanup act on the slot that does not receive traffic.
if [[ "$mode" != deploy ]]; then
  case "$previous" in
    backend-blue) slot=green ;;
    backend-green) slot=blue ;;
    *) preflight_fail "$mode requires a selected Blue/Green backend" ;;
  esac
  slot_ports "$slot"
fi
target="backend-$slot"
target_name="bibbidi-$target"
[[ "$previous" != "$target" ]] || preflight_fail 'Cannot deploy over the selected slot'
[[ "$(docker inspect --format '{{.State.Running}}' "bibbidi-$previous")" = true ]] || preflight_fail 'Previous backend is not running'
previous_instance="$(docker inspect --format '{{.Id}} {{.State.StartedAt}}' "bibbidi-$previous")" || preflight_fail 'Cannot inspect previous instance'
previous_id="${previous_instance%% *}"
project="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "$previous_id")" || preflight_fail 'Cannot inspect previous project'
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || preflight_fail 'Previous backend must belong to a Compose project'
previous_ip="$(docker inspect --format '{{with index .NetworkSettings.Networks "bibbidi-observability"}}{{.IPAddress}}{{end}}' "$previous_id")" || preflight_fail 'Cannot inspect previous address'
[[ -n "$previous_ip" ]] || preflight_fail 'Previous backend must join bibbidi-observability'
nginx_instance="$(docker inspect --format '{{.Id}} {{.State.StartedAt}}' nginx)" || preflight_fail 'Cannot inspect nginx instance'

target_id() {
  docker container ls -a --no-trunc --filter "name=^/$target_name$" --format '{{.ID}}'
}
before_id="$(target_id)" || preflight_fail 'Cannot inspect target container'
# A leftover container of the same Compose project and service is ours to switch back to or remove.
if [[ -n "$before_id" ]]; then
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}} {{index .Config.Labels "com.docker.compose.service"}}' "$before_id")" = "$project $target" ]] || preflight_fail 'Existing target belongs to another deployment'
fi
if [[ "$mode" = rollback ]]; then
  [[ -n "$before_id" ]] || preflight_fail 'Rollback target does not exist; redeploy the previous version instead'
  [[ "$(docker inspect --format '{{.State.Running}}' "$before_id")" = true ]] || preflight_fail 'Rollback target is not running; redeploy the previous version instead'
fi

# Record process start times too, so a reused PID does not count as an old worker.
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
initial_workers="$(worker_snapshot)" || preflight_fail 'Cannot inspect nginx workers'
nginx_master="${initial_workers%%$'\n'*}"
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
docker exec nginx nginx -t || preflight_fail 'Current nginx configuration is invalid'
wait_for_proxy "$previous_ip" || preflight_fail 'Current live route cannot be verified; no new container started'

compose() {
  BIBBIDI_BASE_COMPOSE_FILE="$base" IMAGE_TAG="$tag" BLUE_IMAGE_TAG="$tag" GREEN_IMAGE_TAG="$tag" \
    docker compose --project-name "$project" --project-directory "$app_dir" \
      --env-file "$app_dir/.env" --env-file "$app_dir/infra/monitoring/.env.alloy" \
      -f "$base" -f "$overlay" --profile "$slot" "$@"
}
backend_ready() {
  curl --noproxy '*' --fail --silent --connect-timeout 1 --max-time 3 "http://127.0.0.1:$health_port/actuator/health" 2>/dev/null |
    python3 -c 'import json, sys; sys.exit(json.load(sys.stdin).get("status") != "UP")' 2>/dev/null &&
    [[ "$(curl --noproxy '*' --silent --output /dev/null --write-out '%{http_code}' --connect-timeout 1 --max-time 3 "http://127.0.0.1:$app_port/api/catalog" 2>/dev/null)" = 200 ]]
}
owned_id=''
backup=''
candidate=''
attempted=false
changed=false
switched=false
complete=false
remember_target() {
  local found
  found="$(target_id)" || return 1
  [[ -n "$found" ]] || return 0
  [[ -z "$owned_id" || "$owned_id" = "$found" ]] || return 1
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}} {{index .Config.Labels "com.docker.compose.service"}}' "$found")" = "$project $target" ]] || return 1
  owned_id="$found"
}
stop_owned() {
  # Rollback targets the previous, healthy app, so a failed rollback never stops it.
  [[ "$mode" = deploy ]] || return 0
  remember_target || return 1
  [[ -n "$owned_id" ]] || return 0
  log "Stopping this deployment's failed $target container"
  # Only after route/drain verification; preserve Compose's stop_grace_period.
  docker stop "$owned_id" >/dev/null || return 1
  [[ "$(docker inspect --format '{{.State.Running}} {{.State.Restarting}}' "$owned_id")" = 'false false' ]]
}
# Removing a container that nginx may still reach would drop its requests.
require_no_draining() {
  local current
  current="$(workers)" || return 1
  ! printf '%s\n' "$current" | grep -q ':draining$'
}
# Only for a container that receives no traffic; preserve Compose's stop_grace_period.
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
finish() {
  local cause=$? result=30 rollback_workers=''
  set +e
  trap - EXIT INT TERM
  if [[ "$complete" = true ]]; then result=0
  elif [[ "$mode" = cleanup && "$attempted" = true ]]; then
    result=30
    log "Cleanup failed (command status $cause)"
  elif [[ "$switched" = true ]]; then
    result=40
    log 'Cutover was verified; a later check failed. No automatic rollback or further stops; both apps are left running.'
  elif [[ "$attempted" = true ]]; then
    log "Deployment failed (command status $cause)"
    if [[ "$changed" = true ]]; then
      log 'Restoring previous upstream before considering cleanup'
      if [[ -n "$candidate" ]]; then rm -f "$candidate"; fi
      candidate="$(mktemp "$upstream_dir/.restore.conf.XXXXXX")"
      if cp "$backup" "$candidate" && chmod 0644 "$candidate" && mv -f "$candidate" "$active" &&
         docker exec nginx nginx -t && rollback_workers="$(workers)" &&
         docker exec nginx nginx -s reload && wait_for_proxy "$previous_ip" "$rollback_workers" &&
         wait_for_drain "$previous_ip" "$rollback_workers" && stop_owned; then result=20; fi
    elif [[ "$(cat "$active")" = "$original_config" ]] && wait_for_proxy "$previous_ip" && stop_owned; then result=10
    fi
  else result=64
  fi
  if [[ "$result" -eq 30 ]]; then
    log "Recovery or cleanup could not be verified; no further automatic stop. Backup: ${backup:-not-created}"
  elif [[ "$result" -eq 40 ]]; then
    log "Previous configuration retained at $backup"
  else
    if [[ -n "$backup" ]]; then rm -f "$backup"; fi
    if [[ ( "$result" -eq 10 || "$result" -eq 20 ) && "$mode" = deploy ]]; then log 'Previous route verified; failed new container stopped or absent'; fi
    if [[ ( "$result" -eq 10 || "$result" -eq 20 ) && "$mode" = rollback ]]; then log 'Previous route verified; both containers left running'; fi
  fi
  if [[ -n "$candidate" ]]; then rm -f "$candidate"; fi
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [[ "$mode" = cleanup ]]; then
  if [[ -z "$before_id" ]]; then
    log "No $target_name container to remove"
  else
    require_no_draining || preflight_fail 'Nginx is still finishing earlier requests; retry later'
    attempted=true
    log "Removing $target_name, which receives no traffic"
    remove_idle_target "$before_id" || fail "Could not remove $target_name"
  fi
  complete=true
  log "Cleanup complete: $previous keeps serving"
  exit 0
fi

if [[ "$mode" = deploy ]]; then
  compose config --quiet >/dev/null 2>&1 || fail 'Compose configuration invalid; no new container started'
  if [[ -n "$before_id" ]]; then
    require_no_draining || preflight_fail 'Nginx is still finishing earlier requests; no new container started'
    log "Removing the idle $target_name left by an earlier deployment"
    remove_idle_target "$before_id" || preflight_fail 'Could not remove the idle container; no new container started'
  fi
  attempted=true
  log "Starting inactive $target from the prepared image"
  compose up -d --no-deps --no-build --pull never "$target"
else
  attempted=true
  log "Switching back to $target, which is still running"
fi
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
# The previous app stays up so that rollback is only an nginx switch. Remove it with
# the cleanup mode, or the next deployment removes it before starting its own slot.
[[ "$(docker inspect --format '{{.Id}} {{.State.StartedAt}}' "bibbidi-$previous")" = "$previous_instance" ]] || fail 'Previous container changed after cutover'
proxy_uses "$target_ip" "$before_switch" || fail 'Cannot verify selected route after cutover'
complete=true
log "$mode complete: $target is selected and $previous keeps running without traffic"
