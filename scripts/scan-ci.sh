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
#   CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET
#                   Service Token do Cloudflare Access. Obrigatório quando a API está
#                   atrás do Access (caso do estudo.criecom.ia.br): sem ele a borda
#                   devolve 302 para a tela de login e a chamada nem chega no app.
#
# Requer: bash, curl, openssl. jq é opcional (só formata a saída).
set -euo pipefail

: "${SCAN_CI_SECRET:?defina SCAN_CI_SECRET}"
API="${SCAN_API:-https://estudo.criecom.ia.br}"
MAX_ALTA="${SCAN_MAX_ALTA:-0}"

so_inteiro() { [[ "$1" =~ ^[0-9]+$ ]] || { echo "Limite inválido: $1 (use inteiro >= 0)"; exit 2; }; }
# string JSON segura: escapa \ e " e recusa caracteres de controle
json_str() {
  local s="$1"
  [[ "$s" =~ [[:cntrl:]] ]] && { echo "URL com caractere de controle: recusada"; exit 2; }
  s="${s//\\/\\\\}"; s="${s//\"/\\\"}"
  printf '"%s"' "$s"
}
trim() { local s="$1"; s="${s#"${s%%[![:space:]]*}"}"; printf '%s' "${s%"${s##*[![:space:]]}"}"; }

# monta o campo de limites
so_inteiro "$MAX_ALTA"
if [ -n "${SCAN_MAX_MEDIA:-}" ]; then
  so_inteiro "$SCAN_MAX_MEDIA"
  LIM="{\"alta\":$MAX_ALTA,\"media\":$SCAN_MAX_MEDIA}"
else
  LIM="{\"alta\":$MAX_ALTA}"
fi

# monta o corpo (url única ou lista)
if [ -n "${SCAN_URLS:-}" ]; then
  LISTA=""
  IFS=',' read -ra PARTES <<< "$SCAN_URLS"
  for p in "${PARTES[@]}"; do
    p=$(trim "$p"); [ -z "$p" ] && continue
    LISTA="${LISTA:+$LISTA,}$(json_str "$p")"
  done
  [ -z "$LISTA" ] && { echo "SCAN_URLS vazio"; exit 2; }
  BODY="{\"urls\":[$LISTA],\"limites\":$LIM}"
else
  : "${SCAN_URL:?defina SCAN_URL ou SCAN_URLS}"
  BODY="{\"url\":$(json_str "$(trim "$SCAN_URL")"),\"limites\":$LIM}"
fi

TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SCAN_CI_SECRET" -r | cut -d' ' -f1)

# cabeçalhos do Service Token do Cloudflare Access (borda), se definidos
CF_HDRS=()
if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] && [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
  CF_HDRS=(-H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET")
fi

RESP=$(mktemp)
trap 'rm -f "$RESP"' EXIT

HTTP=$(curl -sS -o "$RESP" -w '%{http_code}' \
  -X POST "$API/api/scan/ci" \
  ${CF_HDRS[@]+"${CF_HDRS[@]}"} \
  -H "Content-Type: application/json" \
  -H "X-Scan-Timestamp: $TS" \
  -H "X-Scan-Signature: sha256=$SIG" \
  --data "$BODY")

echo "== Gate de higiene (HTTP $HTTP) =="
case "$HTTP" in
  200|422)
    jq -r '.resultados[] | "- \(.url): \(if .gate.passou then "OK" else "REPROVOU — " + (.gate.motivos | join("; ")) end)"' "$RESP" 2>/dev/null \
      || cat "$RESP" ;;
  302|403)
    echo "Barrado na borda pelo Cloudflare Access (a chamada nao chegou na API)."
    echo "Defina CF_ACCESS_CLIENT_ID e CF_ACCESS_CLIENT_SECRET de um Service Token autorizado para /api/scan/ci."
    exit 1 ;;
  *) head -c 500 "$RESP"; echo ;;
esac

case "$HTTP" in
  200) echo "Gate OK"; exit 0 ;;
  422) echo "Gate REPROVOU"; exit 1 ;;
  401) echo "Assinatura recusada: confira SCAN_CI_SECRET e o relógio do runner."; exit 1 ;;
  503) echo "Gate nao configurado na API: defina SCAN_CI_SECRET no Coolify."; exit 1 ;;
  *)   echo "Resposta inesperada."; exit 1 ;;
esac
