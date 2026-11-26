# Scanner no pipeline — quality gate de higiene (rota HMAC)

A tela **Inteligência → Scanner de endpoints** é para o operador, atrás do Cloudflare Access.
Para a **CI/CD** (que não tem navegador nem sessão) existe uma rota irmã, autenticada por HMAC:

```
POST /api/scan/ci
```

Ela roda o mesmo motor **não destrutivo** (só GET/HEAD/OPTIONS), mede a higiene do alvo e
devolve um **veredito de gate**: `200` se passou, `422` se reprovou. Assim o job da esteira
falha sozinho quando um endpoint regride (perdeu HSTS, abriu CORS com credenciais, vazou `.env` etc.).

## Autenticação (HMAC-SHA256)

- Segredo compartilhado na variável de ambiente **`SCAN_CI_SECRET`** (no Coolify, no serviço `seginfo-api`).
  Sem ela a rota responde `503` (fail-closed).
- A CI envia dois cabeçalhos:
  - `X-Scan-Timestamp: <unix em segundos>`
  - `X-Scan-Signature: sha256=<hex>` onde `hex = HMAC_SHA256(SCAN_CI_SECRET, "<timestamp>.<corpo-cru>")`
- O servidor recusa requisição com mais de **300s** de diferença (proteção de replay) e compara em tempo constante.

## Corpo

```jsonc
{
  "url": "https://api.cliente.com/v1",      // ou "urls": ["...", "..."] (até 15)
  "exposicoes": true,                         // sondar .git/.env/swagger (padrão true)
  "openapi": true,                            // mapear superfície via spec (padrão true)
  "limites": { "alta": 0, "media": 5 }        // opcional; padrão: alta=0, médios/baixos não bloqueiam
}
```

O gate reprova quando a contagem de achados ultrapassa qualquer limite. Alvo inalcançável
também **reprova** (para a esteira não passar no verde por engano).

## Exemplo — bash (runner Linux com openssl + curl + jq)

```bash
#!/usr/bin/env bash
set -euo pipefail
API="https://estudo.criecom.ia.br"          # ajuste se a API tiver host próprio
URL_ALVO="https://api.cliente.com/v1"

BODY=$(jq -nc --arg u "$URL_ALVO" '{url:$u, limites:{alta:0}}')
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SCAN_CI_SECRET" -r | cut -d' ' -f1)

HTTP=$(curl -sS -o resposta.json -w '%{http_code}' \
  -X POST "$API/api/scan/ci" \
  -H "Content-Type: application/json" \
  -H "X-Scan-Timestamp: $TS" \
  -H "X-Scan-Signature: sha256=$SIG" \
  --data "$BODY")

jq '.resultados[] | {url, passou:.gate.passou, motivos:.gate.motivos}' resposta.json
[ "$HTTP" = "200" ] || { echo "Gate de higiene REPROVOU ($HTTP)"; exit 1; }
echo "Gate de higiene OK"
```

> O corpo assinado tem de ser **byte a byte** o mesmo enviado. Monte o JSON uma vez (variável `BODY`)
> e use a mesma string para assinar e para o `--data`.

## Exemplo — GitHub Actions

```yaml
- name: Gate de higiene de endpoint
  env:
    SCAN_CI_SECRET: ${{ secrets.SCAN_CI_SECRET }}
  run: ./scripts/scan-ci.sh
```

Guarde o `SCAN_CI_SECRET` como secret do repositório, com o **mesmo valor** da variável no Coolify.

## Como gerar o segredo

```bash
openssl rand -hex 32
```

Cole o valor na variável `SCAN_CI_SECRET` do serviço `seginfo-api` (Coolify) e no secret da CI.
