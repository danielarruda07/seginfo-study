#!/usr/bin/env bash
# Quality gate de higiene de endpoint (SegInfo) para a CI/CD.
# Chama POST /api/scan/ci assinando o corpo com HMAC-SHA256 (SCAN_CI_SECRET).
# Sai 0 se o gate passou (HTTP 200), 1 se reprovou (HTTP 422) ou em erro.
#
# Variáveis:
#   SCAN_CI_SECRET  (obrigatória) mesmo valor da variável no Coolify (seginfo-api)
#   SCAN_API        URL base da API         (padrão: https://estudo.criecom.ia.br)
#   SCAN_URL        alvo único              (ou use SCAN_URLS separado por vírgula)
#   SCAN_URLS       vários alvos "a,b,c"    (até 15)
#   SCAN_MAX_ALTA   limite de achados altos (padrão 0)
#   SCAN_MAX_MEDIA  limite de médios        (padrão: sem limite)
#
# Requer: bash, curl, jq, openssl.
set -euo pipefail

: "${SCAN_CI_SECRET:?defina SCAN_CI_SECRET}"
API="${SCAN_API:-https://estudo.criecom.ia.br}"
MAX_ALTA="${SCAN_MAX_ALTA:-0}"

# monta o campo de limites
if [ -n "${SCAN_MAX_MEDIA:-}" ]; then
  LIM=$(jq -nc --argjson a "$MAX_ALTA" --argjson m "$SCAN_MAX_MEDIA" '{alta:$a, media:$m}')
else
  LIM=$(jq -nc --argjson a "$MAX_ALTA" '{alta:$a}')
fi

# monta o corpo (url única ou lista)
if [ -n "${SCAN_URLS:-}" ]; then
  URLS=$(printf '%s' "$SCAN_URLS" | jq -Rc 'split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))')
  BODY=$(jq -nc --argjson u "$URLS" --argjson l "$LIM" '{urls:$u, limites:$l}')
else
  : "${SCAN_URL:?defina SCAN_URL ou SCAN_URLS}"
  BODY=$(jq -nc --arg u "$SCAN_URL" --argjson l "$LIM" '{url:$u, limites:$l}')
fi

TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SCAN_CI_SECRET" -r | cut -d' ' -f1)

HTTP=$(curl -sS -o /tmp/scan-ci-resp.json -w '%{http_code}' \
  -X POST "$API/api/scan/ci" \
  -H "Content-Type: application/json" \
  -H "X-Scan-Timestamp: $TS" \
  -H "X-Scan-Signature: sha256=$SIG" \
  --data "$BODY")

echo "== Gate de higiene (HTTP $HTTP) =="
jq -r '.resultados[] | "- \(.url): \(if .gate.passou then "OK" else "REPROVOU — " + (.gate.motivos | join("; ")) end)"' /tmp/scan-ci-resp.json 2>/dev/null \
  || cat /tmp/scan-ci-resp.json

case "$HTTP" in
  200) echo "Gate OK"; exit 0 ;;
  422) echo "Gate REPROVOU"; exit 1 ;;
  401) echo "Assinatura recusada: confira SCAN_CI_SECRET e o relógio do runner."; exit 1 ;;
  503) echo "Gate nao configurado na API: defina SCAN_CI_SECRET no Coolify."; exit 1 ;;
  *)   echo "Resposta inesperada."; exit 1 ;;
esac
