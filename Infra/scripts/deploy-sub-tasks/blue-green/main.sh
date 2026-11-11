#!/usr/bin/env bash

# 한 호스트의 Blue/Green 컨테이너를 다루는 진입점이다. EC2나 DNS는 바꾸지 않는다.
# 명령을 해석하고 사전 점검 순서를 정하며, 각 명령의 동작은 명령 파일이 맡는다.
#
#   main.sh deploy {blue|green} IMAGE_TAG   deploy-new-version.sh
#   main.sh rollback                        rollback-previous-version.sh
#   main.sh cleanup                         cleanup-idle-container.sh
#
# 제한 시간(초) 세 개는 필수이고 운영 기본값은 없다: HEALTHCHECK_TIMEOUT_SECONDS,
# PROXY_VERIFY_TIMEOUT_SECONDS, DRAIN_TIMEOUT_SECONDS.
# 종료 코드는 deploy와 rollback이 lib-switch-upstream.sh에, cleanup이 cleanup-idle-container.sh에 있다.
#
# 명령 파일은 아래 함수를 정의하고, 이 순서로 호출된다.
#   <명령>_check_args     인자 확인
#   <명령>_prepare        명령에 필요한 환경·파일 확인
#   <명령>_select_target  대상 슬롯 선택
#   <명령>_preflight      대상 컨테이너 상태 확인
#   <명령>_run            명령 실행
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib-inspect.sh
source "$script_dir/lib-inspect.sh"

usage='Usage: main.sh deploy {blue|green} IMAGE_TAG | rollback | cleanup'
[[ "$#" -ge 1 ]] || preflight_fail "$usage"
command_name="$1"
shift
case "$command_name" in
  deploy) command_file=deploy-new-version.sh ;;
  rollback) command_file=rollback-previous-version.sh ;;
  cleanup) command_file=cleanup-idle-container.sh ;;
  *) preflight_fail "$usage" ;;
esac
source "$script_dir/$command_file"

"${command_name}_check_args" "$@"
check_environment
load_paths
"${command_name}_prepare"
read_live_state
"${command_name}_select_target"
inspect_target
"${command_name}_preflight"
verify_live_route
"${command_name}_run"
