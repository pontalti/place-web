# ---- build stage ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

# Angular 19/20: 'build:ssr' já gera browser + server
RUN npm run build:ssr

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app

# Apache + proxy + ferramentas de debug (curl)
RUN apk add --no-cache apache2 apache2-proxy curl

# Copia apenas o build e instala só deps de produção
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --omit=dev

# Configura o vhost e o entrypoint
COPY docker/apache-vhost.conf /etc/apache2/conf.d/zzz-place-web.conf
COPY docker/entrypoint.sh /docker/entrypoint.sh
RUN chmod +x /docker/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

EXPOSE 8080 4000
CMD ["/docker/entrypoint.sh"]
