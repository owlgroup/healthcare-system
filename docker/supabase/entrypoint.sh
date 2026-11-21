#!/bin/sh
# Entrypoint of rcare-supabase. See docker/supabase/Dockerfile.
set -eu

FUNCTIONS_DIR="${FUNCTIONS_DIR:-/home/deno/functions}"
MIGRATE="${MIGRATE:-auto}"

# --- 1+2. Migrations + Vault secrets -----------------------------------------
case "$MIGRATE" in
  auto|baseline) /opt/rcare/migrate.sh "$MIGRATE" ;;
  skip) echo "[rcare] MIGRATE=skip — database not touched" ;;
  *) echo "[rcare] ERROR: MIGRATE must be auto | baseline | skip (got '$MIGRATE')" >&2; exit 1 ;;
esac

# --- 3. Sync functions --------------------------------------------------------
# FUNCTIONS_DIR is usually the stack's mounted volume (./volumes/functions):
# only the app's own folders are replaced, anything else is left alone.
mkdir -p "$FUNCTIONS_DIR"
for src in /opt/rcare/functions/* /opt/rcare/functions/deno.json; do
  [ -e "$src" ] || continue
  name=$(basename "$src")
  rm -rf "${FUNCTIONS_DIR:?}/$name"
  cp -a "$src" "$FUNCTIONS_DIR/$name"
done

# Router: keep the stack's own main/ if present, otherwise use the bundled one.
if [ ! -f "$FUNCTIONS_DIR/main/index.ts" ]; then
  echo "[rcare] no main/ router found — installing bundled router"
  rm -rf "$FUNCTIONS_DIR/main"
  cp -a /opt/rcare/main "$FUNCTIONS_DIR/main"
fi
echo "[rcare] functions synced to $FUNCTIONS_DIR: $(ls /opt/rcare/functions | grep -v -e '^_' -e 'deno.json' | wc -l | tr -d ' ') function(s)"

# One-shot mode: `docker run ... rcare-supabase:<tag> deploy-only`
# migrate + copy functions into the mounted volume, then exit (no server).
if [ "${1:-}" = "deploy-only" ]; then
  echo "[rcare] deploy-only: done — restart the stack's functions container to load new code"
  exit 0
fi

# --- 4. Start edge-runtime -----------------------------------------------------
exec edge-runtime "$@"
