#!/usr/bin/env bash
# Instala o worker da revisão de código (claude-security) numa VM Linux (Ubuntu 24.04+).
# Rode como root, a partir desta pasta:   sudo bash install.sh
# Idempotente: rodar de novo atualiza o worker e o plugin (na versão fixada abaixo).
#
# O que faz:
#  - cria o usuário sem login seginfo-codescan (sem sudo amplo)
#  - instala git/python3/curl e o Claude Code (instalador oficial) para esse usuário
#  - baixa o plugin oficial claude-security numa versão FIXA, em pasta do root e só-leitura
#  - libera via sudoers SÓ o comando que o sandbox do plugin roda como root (sandbox_keeper.py)
#  - cria /etc/seginfo-codescan/worker.env (0640) se não existir, e o serviço systemd
set -euo pipefail

PLUGIN_REPO="https://github.com/anthropics/claude-plugins-official"
PLUGIN_COMMIT="${PLUGIN_COMMIT:-0fbfda5a91f4adc311daca25acc99132f40f0b6e}"   # versão validada; troque de propósito
USUARIO="seginfo-codescan"
BASE="/opt/seginfo-codescan"
DADOS="/var/lib/seginfo-codescan"
CONF="/etc/seginfo-codescan"
AQUI="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "rode como root (sudo bash install.sh)"; exit 1; }
[ "$(uname -s)" = "Linux" ] || { echo "o sandbox do plugin só roda em Linux"; exit 1; }
KERNEL_OK=$(python3 -c 'import platform;M,m=map(int,platform.release().split(".")[:2]);print(int((M,m)>=(5,19)))' 2>/dev/null || echo 0)
[ "$KERNEL_OK" = "1" ] || { echo "kernel Linux 5.19+ necessário"; exit 1; }

echo "==> pacotes"
apt-get update -qq
apt-get install -y -qq git python3 curl ca-certificates sudo >/dev/null

echo "==> usuário $USUARIO"
id "$USUARIO" >/dev/null 2>&1 || useradd --system --create-home --home-dir "$DADOS" --shell /usr/sbin/nologin "$USUARIO"
install -d -o "$USUARIO" -g "$USUARIO" -m 0700 "$DADOS" "$DADOS/work"

echo "==> Claude Code (instalador oficial) para $USUARIO"
if [ ! -x "$DADOS/.local/bin/claude" ]; then
  sudo -u "$USUARIO" -H bash -c 'curl -fsSL https://claude.ai/install.sh | bash' >/dev/null
fi
"$DADOS/.local/bin/claude" --version || { echo "Claude Code não instalou"; exit 1; }

echo "==> plugin claude-security @ ${PLUGIN_COMMIT:0:12} (root, só-leitura)"
TMP=$(mktemp -d)
git clone -q --filter=blob:none "$PLUGIN_REPO" "$TMP/cpo"
git -C "$TMP/cpo" -c advice.detachedHead=false checkout -q "$PLUGIN_COMMIT"
rm -rf "$BASE/plugin.novo"
install -d -o root -g root -m 0755 "$BASE"
cp -a "$TMP/cpo/plugins/claude-security" "$BASE/plugin.novo"
rm -rf "$TMP"
chown -R root:root "$BASE/plugin.novo"
chmod -R u=rwX,go=rX "$BASE/plugin.novo"
rm -rf "$BASE/plugin" && mv "$BASE/plugin.novo" "$BASE/plugin"
echo "$PLUGIN_COMMIT" > "$BASE/plugin.versao"

echo "==> worker"
install -o root -g root -m 0755 "$AQUI/worker.py" "$BASE/worker.py"

echo "==> sudoers: só o keeper do sandbox"
cat > /etc/sudoers.d/seginfo-codescan <<EOF
# O sandbox do plugin claude-security (sandbox.py --sudo) monta o ambiente isolado como root
# rodando APENAS este programa. A pasta $BASE/plugin é do root e só-leitura para $USUARIO.
$USUARIO ALL=(root) NOPASSWD: /usr/bin/python3 -ISB -X utf8 $BASE/plugin/scripts/sandbox_keeper.py *
EOF
chmod 0440 /etc/sudoers.d/seginfo-codescan
visudo -cf /etc/sudoers.d/seginfo-codescan >/dev/null

echo "==> configuração"
install -d -o root -g "$USUARIO" -m 0750 "$CONF"
if [ ! -f "$CONF/worker.env" ]; then
  install -o root -g "$USUARIO" -m 0640 "$AQUI/worker.env.exemplo" "$CONF/worker.env"
  echo "    criei $CONF/worker.env: PREENCHA os segredos antes de iniciar"
fi

echo "==> serviço systemd"
install -o root -g root -m 0644 "$AQUI/seginfo-codescan.service" /etc/systemd/system/seginfo-codescan.service
systemctl daemon-reload
systemctl enable seginfo-codescan >/dev/null

echo "==> teste do sandbox (--check)"
if sudo -u "$USUARIO" -H /usr/bin/python3 -IS "$BASE/plugin/scripts/sandbox.py" --sudo --check "$DADOS/work"; then
  echo "    sandbox OK"
else
  echo "    ATENÇÃO: o --check do sandbox falhou; veja a mensagem acima antes de iniciar o worker"
fi

echo
echo "Pronto. Próximos passos:"
echo "  1. edite $CONF/worker.env (chave da API, token do worker, Service Token do Access)"
echo "  2. systemctl restart seginfo-codescan && journalctl -u seginfo-codescan -f"
