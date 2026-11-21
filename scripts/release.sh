#!/bin/sh
# Build + push both images, then trigger Portainer webhooks to redeploy.
#
#   REGISTRY=registry.example.org/rcare \
#   PORTAINER_WEBHOOK_SUPABASE=https://portainer.example.org/api/webhooks/<id> \
#   PORTAINER_WEBHOOK_FE=https://portainer.example.org/api/webhooks/<id> \
#   ./scripts/release.sh [tag]
#
# tag defaults to the short git commit. Each image is also pushed as :latest so
# the stack can reference :latest and the webhook just re-pulls it.
# Webhook vars are optional — without them the script only builds + pushes.
# Values can be kept in scripts/release.env (git-ignored, sourced if present).
set -eu
cd "$(dirname "$0")/.."

[ -f scripts/release.env ] && . scripts/release.env

: "${REGISTRY:?set REGISTRY, e.g. registry.example.org/rcare}"
TAG="${1:-$(git rev-parse --short HEAD)}"
FE="$REGISTRY/rcare-fe"
SB="$REGISTRY/rcare-supabase"

echo "==> build $SB:$TAG"
docker build --platform linux/amd64 -f docker/supabase/Dockerfile -t "$SB:$TAG" -t "$SB:latest" .
echo "==> build $FE:$TAG"
docker build --platform linux/amd64 -t "$FE:$TAG" -t "$FE:latest" .

for img in "$SB:$TAG" "$SB:latest" "$FE:$TAG" "$FE:latest"; do
  echo "==> push $img"
  docker push "$img"
done

# Supabase first: its migrations must run before the new FE goes live.
trigger() {
  name=$1 url=$2
  if [ -z "$url" ]; then
    echo "==> $name: no webhook set — redeploy manually in Portainer"
    return 0
  fi
  echo "==> trigger $name redeploy"
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$url")
  case "$code" in
    2*) echo "    ok ($code)" ;;
    *) echo "    ERROR: webhook returned HTTP $code" >&2; exit 1 ;;
  esac
}
trigger rcare-supabase "${PORTAINER_WEBHOOK_SUPABASE:-}"
trigger rcare-fe "${PORTAINER_WEBHOOK_FE:-}"

echo "==> released tag $TAG"
