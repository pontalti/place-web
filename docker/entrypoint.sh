#!/bin/sh
# /docker/entrypoint.sh
set -e

export PORT="${PORT:-4000}"
export HOST="${HOST:-0.0.0.0}"

echo "[entrypoint] Starting SSR with Node (HOST=$HOST, PORT=$PORT)..."
# Start the SSR server in the background, leaving logs on the container's stdout/stderr
node /app/dist/place-web/server/server.mjs &
SSR_PID=$!

# Wait for the SSR server to respond (up to 30s); if the process dies, report and exit
for i in $(seq 1 30); do
  if wget -q -O- "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    echo "[entrypoint] SSR responded on port ${PORT}."
    break
  fi
  if ! kill -0 "$SSR_PID" 2>/dev/null; then
    echo "[entrypoint] SSR exited before becoming ready. Shutting down."
    wait "$SSR_PID" || true
    exit 1
  fi
  sleep 1
done

echo "[entrypoint] Starting Apache in foreground..."
exec httpd -D FOREGROUND
