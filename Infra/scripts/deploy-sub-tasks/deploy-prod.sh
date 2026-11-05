#!/usr/bin/env bash

# App-only CD for an already migrated Blue/Green host. Shared services are
# deliberately not recreated while they serve production traffic.
set -euo pipefail
fail() { printf '[prod-deploy] ERROR: %s\n' "$*" >&2; exit 1; }
app_dir="${EC2_DEPLOY_PATH:-/opt/bibbidi/app}"
upstream_dir="${NGINX_UPSTREAM_DIR:-$app_dir/infra/nginx/upstream}"
: "${DOCKERHUB_USERNAME:?required}" "${IMAGE_TAG:?required}"
: "${SPRING_ENV_CONTENT:?required}" "${NGINX_ENV_CONTENT:?required}" "${ALLOY_ENV_CONTENT:?required}"
[[ "$IMAGE_TAG" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || fail 'Invalid image tag'

# Hold the switch lock throughout preparation and pass descriptor 9 to the child.
# A manual switch must not race with Compose/environment installation either.
exec 9>"$upstream_dir/.switch.lock"
flock -n 9 || fail 'Another deployment is in progress'
case "$(sed 's/#.*//' "$upstream_dir/active.conf" | tr -d '[:space:]')" in
  'serverbackend-blue:8080;') target=green ;;
  'serverbackend-green:8080;') target=blue ;;
  *) fail 'Expected an existing Blue/Green route; migrate the host first' ;;
esac

# These files are already installed and validated during host migration.
# A shared configuration change needs its own validated reload/update procedure.
cmp -s Infra/nginx/nginx.conf.template "$app_dir/infra/nginx/nginx.conf.template" ||
  fail 'Nginx template differs; apply and validate the shared configuration before app CD'
cmp -s Infra/monitoring/grafana/alloy/config.alloy "$ALLOY_CONFIG_PATH" ||
  fail 'Alloy configuration differs; apply and validate the shared configuration before app CD'

umask 077
stage=$(mktemp -d "$app_dir/.cd-stage.XXXXXXXX")
trap 'rm -rf "$stage"' EXIT
printf '%s\n' "$SPRING_ENV_CONTENT" > "$stage/.env.spring"
printf '%s\n' "$NGINX_ENV_CONTENT" > "$stage/.env.nginx"
printf '%s\n' "$ALLOY_ENV_CONTENT" > "$stage/.env.alloy"
# Ignore a final newline only; never print environment file contents or diffs.
python3 - "$stage/.env.nginx" "$NGINX_ENV_FILE" "$stage/.env.alloy" "$ALLOY_ENV_FILE" <<'PY'
import pathlib, sys
for candidate, installed in zip(sys.argv[1::2], sys.argv[2::2]):
    if pathlib.Path(candidate).read_bytes().rstrip(b'\n') != pathlib.Path(installed).read_bytes().rstrip(b'\n'):
        raise SystemExit('Shared service environment differs; validate its update before app CD')
PY
for container in nginx alloy dockerproxy; do
  [[ "$(docker inspect --format '{{.State.Running}}' "$container")" = true ]] ||
    fail "Required shared service is not running: $container"
done

image="$DOCKERHUB_USERNAME/bibbidi-backend:$IMAGE_TAG"
docker pull --platform linux/arm64 "$image"
[[ "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image")" = linux/arm64 ]] ||
  fail 'Prepared image must be linux/arm64'

# Validate the candidate before replacing any installed deployment files.
export BIBBIDI_BASE_COMPOSE_FILE="$PWD/BE/compose.prod.yml"
export BLUE_IMAGE_TAG="$IMAGE_TAG" GREEN_IMAGE_TAG="$IMAGE_TAG"
SPRING_ENV_FILE="$stage/.env.spring" docker compose \
  --project-directory "$app_dir" --env-file "$app_dir/.env" --env-file "$ALLOY_ENV_FILE" \
  -f BE/compose.prod.yml -f BE/compose.blue-green.yml --profile "$target" config --quiet

# Detect shared Compose changes too instead of silently leaving them unapplied.
for version in installed candidate; do
  base="$app_dir/compose.yaml"; overlay="$app_dir/compose.blue-green.yml"
  if [[ "$version" = candidate ]]; then
    base="$PWD/BE/compose.prod.yml"; overlay="$PWD/BE/compose.blue-green.yml"
  fi
  BIBBIDI_BASE_COMPOSE_FILE="$base" SPRING_ENV_FILE="$stage/.env.spring" docker compose \
    --project-directory "$app_dir" --env-file "$app_dir/.env" --env-file "$ALLOY_ENV_FILE" \
    -f "$base" -f "$overlay" --profile "$target" config --format json > "$stage/$version.json"
done
python3 - "$stage/installed.json" "$stage/candidate.json" <<'PY'
import json, sys
configs = [json.load(open(path)) for path in sys.argv[1:]]
def shared(config):
    return ([config['services'][name] for name in ('nginx', 'alloy', 'dockerproxy')],
            config.get('networks'), config.get('volumes'))
if shared(configs[0]) != shared(configs[1]):
    raise SystemExit('Shared Compose configuration differs; validate its update before app CD')
PY

install -m 0644 BE/compose.prod.yml "$app_dir/compose.yaml"
install -m 0644 BE/compose.blue-green.yml "$app_dir/compose.blue-green.yml"
install -m 0600 "$stage/.env.spring" "$SPRING_ENV_FILE"
install -d -m 0755 "$app_dir/infra/scripts"
install -m 0755 Infra/scripts/deploy-sub-tasks/deploy-blue-green.sh "$app_dir/infra/scripts/deploy-blue-green.sh"
export BIBBIDI_BASE_COMPOSE_FILE="$app_dir/compose.yaml"

# Keep the switch script's nonzero statuses, including manual recovery (30/40).
# Never run a legacy fallback or stop a container here after a failed switch.
bash "$app_dir/infra/scripts/deploy-blue-green.sh" "$target" "$IMAGE_TAG"
