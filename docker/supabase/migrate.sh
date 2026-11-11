#!/bin/sh
# Apply supabase/migrations/*.sql in filename order, each in its own transaction.
# Applied versions are tracked in supabase_migrations.schema_migrations — the
# same table `supabase db push` uses, so both tools stay compatible.
#
#   migrate.sh auto      run pending migrations (fails the container on error)
#   migrate.sh baseline  mark ALL bundled migrations as applied WITHOUT running
#                        them — only for a DB that was migrated by hand before.
set -eu

MODE="${1:-auto}"
DB_URL="${SUPABASE_DB_URL:-${DB_URL:-}}"
MIG_DIR="${MIG_DIR:-/opt/rcare/migrations}"

if [ -z "$DB_URL" ]; then
  echo "[rcare] ERROR: SUPABASE_DB_URL is not set (or set MIGRATE=skip)" >&2
  exit 1
fi

export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL="psql $DB_URL -X -q -v ON_ERROR_STOP=1"

# Wait for Postgres (up to ~90s)
i=0
until $PSQL -c 'select 1' >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 45 ]; then echo "[rcare] ERROR: database not reachable" >&2; exit 1; fi
  sleep 2
done

$PSQL <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
SQL

applied=$($PSQL -At -c 'select version from supabase_migrations.schema_migrations')
count=0

for f in "$MIG_DIR"/*.sql; do
  [ -e "$f" ] || continue
  file=$(basename "$f" .sql)
  version=${file%%_*}
  name=${file#*_}
  if printf '%s\n' "$applied" | grep -qx "$version"; then
    continue
  fi
  case "$version" in
    *[!0-9]*|'') echo "[rcare] ERROR: bad migration filename $file (expected <digits>_<name>.sql)" >&2; exit 1 ;;
  esac
  name_sql=$(printf '%s' "$name" | sed "s/'/''/g")
  record="insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name_sql') on conflict do nothing;"

  if [ "$MODE" = "baseline" ]; then
    echo "[rcare] baseline: mark $file as applied"
    $PSQL -c "$record"
  else
    echo "[rcare] migrate: $file"
    # Migration + its tracking row in ONE transaction: either both or neither.
    if ! { cat "$f"; printf '\n;\n%s\n' "$record"; } | $PSQL -1; then
      echo "[rcare] ERROR: migration $file failed — rolled back, nothing from this file was applied" >&2
      exit 1
    fi
  fi
  count=$((count + 1))
done
echo "[rcare] migrations done ($MODE): $count new"

# Vault secrets for pg_cron → scan-pre-consult-reminders.
# URL = gateway as seen from the db container (default: SUPABASE_URL of this container).
CRON_URL="${CRON_FUNCTIONS_BASE_URL:-${SUPABASE_URL:-}}"
if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && [ -n "$CRON_URL" ]; then
  if $PSQL -v url="$CRON_URL" -v key="$SUPABASE_SERVICE_ROLE_KEY" <<'SQL' >/dev/null
select set_config('rcare.url', :'url', false), set_config('rcare.key', :'key', false);
do $$
declare
  s record;
begin
  for s in select * from (values
    ('supabase_project_url', current_setting('rcare.url')),
    ('supabase_service_role_key', current_setting('rcare.key'))
  ) as t(name, value) loop
    if exists (select 1 from vault.secrets where name = s.name) then
      perform vault.update_secret((select id from vault.secrets where name = s.name), s.value);
    else
      perform vault.create_secret(s.value, s.name);
    end if;
  end loop;
end $$;
SQL
  then
    echo "[rcare] vault secrets for cron updated (url=$CRON_URL)"
  else
    echo "[rcare] WARN: could not write vault secrets — cron reminders will be skipped" >&2
  fi
else
  echo "[rcare] WARN: SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL missing — cron reminder secrets not set"
fi
