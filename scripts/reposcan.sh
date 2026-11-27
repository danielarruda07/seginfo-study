#!/usr/bin/env bash
# Analise estatica de um repositorio clonado (DevSecOps) — segredos, dependencias,
# Docker/IaC/CI e padroes de codigo perigosos. So LE arquivos; nao instala nem executa nada.
#
# Uso (na raiz do SegInfo):
#   scripts/reposcan.sh <pasta-do-repo>            # analisa uma pasta ja clonada
#   scripts/reposcan.sh <url-git>                  # clona raso num temp, analisa e apaga
#   scripts/reposcan.sh <alvo> --json              # saida JSON
#   scripts/reposcan.sh <alvo> --fail-on media     # reprova a partir de "media"
#
# Sai 0 se nada atingir o limiar (padrao: alta), 1 se reprovar, 2 em erro de uso.
# Requer: node, git (so para o modo URL). Usa o tsx do proprio repo.
set -euo pipefail

ALVO="${1:-}"
shift || true
[ -z "$ALVO" ] && { echo "Uso: scripts/reposcan.sh <pasta-ou-url-git> [--json] [--fail-on alta|media|baixa]"; exit 2; }

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
TMP=""
cleanup() { [ -n "$TMP" ] && rm -rf "$TMP"; }
trap cleanup EXIT

if printf '%s' "$ALVO" | grep -qE '^(https?|git|ssh)://|^git@'; then
  TMP="$(mktemp -d)"
  echo "Clonando (raso) $ALVO ..."
  # clone nao executa codigo do repo; --depth 1 e sem submodulos para ser rapido/seguro
  git clone --depth 1 --no-single-branch "$ALVO" "$TMP/repo" >/dev/null 2>&1 || { echo "Falha ao clonar."; exit 2; }
  DIR="$TMP/repo"
else
  DIR="$ALVO"
fi

node "$RAIZ/node_modules/tsx/dist/cli.mjs" "$RAIZ/apps/api/src/reposcanCli.ts" "$DIR" "$@"
