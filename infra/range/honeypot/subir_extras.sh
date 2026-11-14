#!/bin/bash
# Honeypots extras na VM do honeypot: Heralding (senhas em VNC, PostgreSQL, SMTP, POP3, IMAP)
# e iscas (Redis, Elasticsearch, API do Docker). Idempotente. Rodar como root.
#
# Complementa honeypot_setup.sh (Cowrie + Dionaea). Não expõe nenhuma porta UDP de propósito:
# a reflexão/amplificação (DNS, NTP, SSDP, memcached) fica a cargo do firewall, que registra
# e descarta sem nenhum serviço escutando (ver docs/RANGE.md "Reflexão UDP: estudar sem virar arma").
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
X=/opt/honeypot/extras
mkdir -p $X/heralding-logs $X/isca-logs
cp "$SCRIPT_DIR"/isca.py "$SCRIPT_DIR"/Dockerfile.heralding "$SCRIPT_DIR"/heralding_prepara.py $X/
cd $X
docker build -q -t range/heralding -f Dockerfile.heralding . >/dev/null
docker pull -q python:3.11-slim >/dev/null
docker rm -f heralding isca >/dev/null 2>&1 || true
docker run -d --name heralding --restart unless-stopped \
  -p 5900:5900 -p 5432:5432 -p 25:25 -p 110:110 -p 143:143 \
  -v $X/heralding-logs:/logs range/heralding >/dev/null
chown 65534:65534 $X/isca-logs
docker run -d --name isca --restart unless-stopped --read-only --cap-drop ALL --user 65534:65534 \
  -p 6379:6379 -p 9200:9200 -p 2375:2375 \
  -v $X/isca.py:/isca.py:ro -v $X/isca-logs:/logs python:3.11-slim python /isca.py >/dev/null
sleep 25
docker ps --format '{{.Names}} {{.Status}}'
docker logs heralding 2>&1 | grep -i -E "ligados|error|Traceback" | tail -5
docker logs isca 2>&1 | tail -2
ls -la $X/heralding-logs
