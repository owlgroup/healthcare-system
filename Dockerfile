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

# Build arguments (passed at build time)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_SITE_URL
ARG VITE_STT_API_URL
ARG VITE_ENCRYPTION_SECRET_KEY
ARG RESEND_API_KEY
ARG SIGNUP_EMAIL_FROM
ARG SUPABASE_SERVICE_ROLE_KEY
ARG SMTP_USER
ARG SMTP_PASS
ARG EMAIL_FROM_NAME
ARG SITE_URL

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

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
