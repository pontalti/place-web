#!/bin/sh
# /docker/entrypoint.sh
set -e

export PORT="${PORT:-4000}"
export HOST="${HOST:-0.0.0.0}"

echo "[entrypoint] Iniciando SSR com Node (HOST=$HOST, PORT=$PORT)..."
# Sobe o SSR em background, deixando logs no stdout/stderr do container
node /app/dist/place-web/server/server.mjs &
SSR_PID=$!

# Aguarda o SSR responder (até 30s); se o processo cair, mostra erro e encerra
for i in $(seq 1 30); do
  if wget -q -O- "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    echo "[entrypoint] SSR respondeu na porta ${PORT}."
    break
  fi
  if ! kill -0 "$SSR_PID" 2>/dev/null; then
    echo "[entrypoint] SSR saiu antes de ficar pronto. Encerrando."
    wait "$SSR_PID" || true
    exit 1
  fi
  sleep 1
done

echo "[entrypoint] Iniciando Apache em foreground..."
exec httpd -D FOREGROUND
