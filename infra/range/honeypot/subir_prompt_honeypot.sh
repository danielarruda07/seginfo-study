#!/bin/bash
# Instala somente o prompt honeypot; não reinicia Cowrie, Dionaea ou as iscas existentes.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
X=/opt/honeypot/prompt
PROMPT_HP_HOST_PORT="${PROMPT_HP_HOST_PORT:-8088}"
PROMPT_HP_BIND_ADDRESS="${PROMPT_HP_BIND_ADDRESS:-127.0.0.1}"
case "$PROMPT_HP_HOST_PORT" in ''|*[!0-9]*) echo "PROMPT_HP_HOST_PORT precisa ser uma porta numérica" >&2; exit 1;; esac
case "$PROMPT_HP_BIND_ADDRESS" in 127.0.0.1|0.0.0.0) ;; *) echo "PROMPT_HP_BIND_ADDRESS aceita somente 127.0.0.1 ou 0.0.0.0" >&2; exit 1;; esac

mkdir -p "$X/logs"
cp "$SCRIPT_DIR/prompt_honeypot.py" "$X/prompt_honeypot.py"
chown -R 65534:65534 "$X/logs"
if ! docker image inspect python:3.11-slim >/dev/null 2>&1; then
  echo "A imagem python:3.11-slim precisa estar importada antes da instalação; este script não baixa imagens." >&2
  exit 1
fi
docker rm -f prompt-honeypot >/dev/null 2>&1 || true
docker run -d --name prompt-honeypot --restart unless-stopped --read-only --cap-drop ALL \
  --user 65534:65534 --pids-limit 48 --memory 96m --cpus 0.25 \
  --security-opt no-new-privileges --log-opt max-size=1m --log-opt max-file=2 \
  -p "$PROMPT_HP_BIND_ADDRESS:$PROMPT_HP_HOST_PORT:8088" -e PROMPT_HP_PORT=8088 -e PROMPT_HP_LOG=/logs/events.jsonl \
  -v "$X/prompt_honeypot.py:/app.py:ro" -v "$X/logs:/logs" \
  python:3.11-slim python -B /app.py >/dev/null
sleep 2
docker ps --filter name=prompt-honeypot --format '{{.Names}} {{.Status}}'
docker logs prompt-honeypot 2>&1 | tail -2
