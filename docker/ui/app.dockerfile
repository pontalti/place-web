# ---- build stage ----
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

# Angular 17+ with "outputMode": "server": a single build produces browser + server.
# The build:ssr script is just an alias for `ng build`.
RUN npm run build:ssr

# ---- runtime stage ----
FROM node:24-alpine AS runtime
WORKDIR /app

# Apache + proxy + mod_headers (for the X-Forwarded-*) + curl (healthcheck)
RUN apk add --no-cache apache2 apache2-proxy apache2-utils curl

# Copy only the build output and install production dependencies only
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev

# Set up the vhost and the entrypoint
COPY docker/apache-vhost.conf /etc/apache2/conf.d/zzz-place-web.conf
COPY docker/entrypoint.sh /docker/entrypoint.sh
RUN chmod +x /docker/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

EXPOSE 8080 4000
CMD ["/docker/entrypoint.sh"]