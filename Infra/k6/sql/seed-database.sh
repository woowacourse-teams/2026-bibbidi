#!/usr/bin/env bash
set -euo pipefail

# The SSH host is the MySQL EC2 instance reached through AWS-StartSSHSession.
# Its security group still has no inbound rule for SSH or external MySQL.
host=${LOADTEST_DB_SSH_HOST:-loadtest-db}
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
mysql_command=$(cat <<'COMMAND'
sudo docker exec -i mysql sh -c 'test "$MYSQL_DATABASE" = bibbidi_loadtest && MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --batch --skip-column-names -uroot bibbidi_loadtest'
COMMAND
)
dump_command=$(cat <<'COMMAND'
sudo docker exec mysql sh -c 'test "$MYSQL_DATABASE" = bibbidi_loadtest || exit 1; export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; mysqldump -uroot --single-transaction --no-create-info --skip-add-drop-table --skip-comments --set-gtid-purged=OFF bibbidi_loadtest categories steps catalog_items precedences terms && mysqldump -uroot --single-transaction --no-create-info --skip-add-drop-table --skip-comments --set-gtid-purged=OFF --where="id >= 900000000" bibbidi_loadtest users checklists checklist_items appointments refresh_sessions'
COMMAND
)

usage() {
  echo "Usage: $0 restore <seed.sql[.gz]> | dump <snapshot.sql.gz> | verify <1000|10000> | cleanup" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
case "$1" in
  restore)
    [[ $# -eq 2 && -f "$2" ]] || usage
    if [[ "$2" == *.gz ]]; then
      gzip -dc -- "$2" | ssh "$host" "$mysql_command"
    else
      ssh "$host" "$mysql_command" < "$2"
    fi
    ;;
  dump)
    [[ $# -eq 2 && "$2" == *.gz ]] || usage
    ssh "$host" "$dump_command" | gzip -n > "$2"
    ;;
  verify)
    [[ $# -eq 2 && ( "$2" == 1000 || "$2" == 10000 ) ]] || usage
    expected="$2"
    result="$(printf '%s\n' "SELECT
      (SELECT COUNT(*) FROM users WHERE id >= 900000000),
      (SELECT COUNT(*) FROM checklists WHERE id >= 900000000),
      (SELECT COUNT(*) FROM checklist_items WHERE id >= 900000000),
      (SELECT COUNT(*) FROM appointments WHERE id >= 900000000),
      (SELECT COUNT(*) FROM checklists WHERE owner_id BETWEEN 900000001 AND 900000100);" |
      ssh "$host" "$mysql_command")"
    [[ "$result" == "$expected"$'\t'"$expected"$'\t'"$((expected * 3))"$'\t'"$expected"$'\t'"100" ]] ||
      { echo "Unexpected seed counts: $result" >&2; exit 1; }
    echo "Verified $expected users, $expected checklists, $((expected * 3)) items, $expected appointments, 100 pooled users"
    ;;
  cleanup)
    [[ $# -eq 1 ]] || usage
    ssh "$host" "$mysql_command" < "$script_dir/cleanup-loadtest-data.sql"
    ;;
  *)
    usage
    ;;
esac
