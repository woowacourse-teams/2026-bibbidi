#!/usr/bin/env bash
set -euo pipefail

host=${LOADTEST_DB_SSH_HOST:-loadtest-db}

usage() {
  echo "Usage: $0 start | stop <output.tsv>" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
case "$1" in
  start)
    ssh "$host" 'cat > /tmp/db-metrics.sh' <<'REMOTE'
query='SHOW GLOBAL STATUS WHERE Variable_name IN ("Com_select","Questions","Innodb_rows_read")'
while true; do
  status="$(sudo docker exec mysql sh -c "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" exec mysql --batch --skip-column-names -uroot -e '$query'" | tr '\t\n' '= ')"
  printf '%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$(head -n 1 /proc/stat)" "$status"
  sleep 15
done
REMOTE
    ssh "$host" 'nohup bash /tmp/db-metrics.sh > /tmp/db-metrics.tsv 2>/tmp/db-metrics.err < /dev/null & echo $! > /tmp/db-metrics.pid'
    ;;
  stop)
    [[ $# -eq 2 ]] || usage
    ssh "$host" 'kill "$(cat /tmp/db-metrics.pid)"; cat /tmp/db-metrics.err >&2; cat /tmp/db-metrics.tsv' > "$2"
    ;;
  *)
    usage
    ;;
esac
