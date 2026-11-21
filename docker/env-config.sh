#!/bin/sh
# Runs automatically at container start (nginx image executes /docker-entrypoint.d/*.sh).
# Writes every VITE_* container env var into /env-config.js as window.__ENV__,
# so the frontend is configured at runtime (Portainer env) instead of at build time.
set -eu

OUT=/usr/share/nginx/html/env-config.js

{
  printf 'window.__ENV__ = {\n'
  env | grep '^VITE_[A-Z0-9_]*=' | sort | while IFS= read -r line; do
    key="${line%%=*}"
    value="${line#*=}"
    esc=$(printf '%s' "$value" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '  "%s": "%s",\n' "$key" "$esc"
  done
  printf '};\n'
} > "$OUT"

echo "env-config.sh: wrote $(grep -c '": "' "$OUT") VITE_* variable(s) to $OUT"
