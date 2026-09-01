#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "$SCRIPT_DIR/common.sh"
source "$SCRIPT_DIR/certificate-state.sh"
source "$SCRIPT_DIR/bootstrap.sh"
source "$SCRIPT_DIR/issue.sh"

usage() {
  echo "Usage: do-tls.sh {bootstrap|issue}" >&2
}

main() {
  local mode="${1:-}"
  case "$mode" in
    bootstrap|issue) ;;
    *) usage; return 2 ;;
  esac

  initialize_tls_context
  case "$mode" in
    bootstrap) bootstrap_tls ;;
    issue) issue_tls ;;
  esac
}

main "$@"
