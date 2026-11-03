# ============================================
# Stage 1: Build
# ============================================
FROM --platform=linux/amd64 node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# NOTE: no .env / build args — VITE_* config is injected at container start
# (docker/env-config.sh -> /env-config.js). See .dockerignore.

# Build the app
RUN npm run build

# ============================================
# Stage 2: Production (Nginx)
# ============================================
FROM --platform=linux/amd64 nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Generate /env-config.js from container VITE_* env on every start
COPY docker/env-config.sh /docker-entrypoint.d/40-env-config.sh
RUN chmod +x /docker-entrypoint.d/40-env-config.sh

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
