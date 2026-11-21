# =============================================================================
# rcare-supabase — Edge Functions + DB migrations in ONE image.
# Drop-in replacement for the image of the `functions` service in the
# Supabase self-hosted stack. Deploy = push a new tag + trigger Portainer webhook.
#
# Build (from repo root):
#   docker build -f docker/supabase/Dockerfile -t <registry>/rcare-supabase:<tag> .
#
# On every container start (entrypoint.sh):
#   1. Run pending SQL migrations against SUPABASE_DB_URL      (MIGRATE=auto)
#   2. Upsert Vault secrets used by the pg_cron reminder job
#   3. Sync bundled functions into /home/deno/functions
#   4. exec edge-runtime (same CLI args as the upstream image)
# =============================================================================
ARG EDGE_RUNTIME_VERSION=v1.77.9
FROM --platform=linux/amd64 supabase/edge-runtime:${EDGE_RUNTIME_VERSION}

# psql for migrations (base image is debian:bookworm-slim)
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY supabase/functions /opt/rcare/functions
COPY supabase/migrations /opt/rcare/migrations
COPY docker/supabase/main /opt/rcare/main
COPY docker/supabase/entrypoint.sh docker/supabase/migrate.sh /opt/rcare/
RUN chmod +x /opt/rcare/*.sh \
 && find /opt/rcare -name '.env*' -delete \
 && find /opt/rcare -name .DS_Store -delete

ENTRYPOINT ["/opt/rcare/entrypoint.sh"]
CMD ["start", "--user-worker-request-idle-timeout", "150000", "--main-service", "/home/deno/functions/main"]
