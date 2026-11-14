#!/bin/bash
# VM do honeypot: Cowrie (SSH/Telnet) + Dionaea (SMB, FTP, HTTP, MSSQL, MySQL...) com logs JSON.
# Idempotente. Rodar como root pelo agente QEMU.
set -e
# Parametros: HP_IP (IP do honeypot) obrigatorio; BACKEND_IP (Linux real do modo proxy) opcional.
: "${HP_IP:?defina HP_IP}"
BACKEND_IP="${BACKEND_IP:-}"
H=/opt/honeypot
mkdir -p $H/cowrie/log $H/dionaea/etc $H/dionaea/var

# --- SSH real desligado: a porta 22 passa a ser do Cowrie. Gerencia so pelo agente QEMU.
systemctl disable --now ssh.socket ssh.service 2>/dev/null || true

# --- Dionaea: copia a configuracao padrao uma unica vez e liga o log JSON
if [ ! -f $H/dionaea/etc/dionaea/dionaea.cfg ]; then
  docker run --rm -v $H/dionaea/etc:/opt/dionaea/etc -v $H/dionaea/var:/opt/dionaea/var \
    --entrypoint /bin/bash dinotools/dionaea:latest -c \
    'cd /opt/dionaea && cp -a template/etc/. etc/ && mkdir -p var && cp -a template/lib var/ && cp -a template/log var/'
fi
E=$H/dionaea/etc/dionaea
ln -sfn ../ihandlers-available/log_json.yaml $E/ihandlers-enabled/log_json.yaml
sed -i 's/^    # flat_data: true/    flat_data: true/' $E/ihandlers-available/log_json.yaml
# caminho relativo resolve errado dentro do container: usar absoluto
sed -i 's#- file://var/lib/dionaea/dionaea.json#- file:///opt/dionaea/var/lib/dionaea/dionaea.json#' $E/ihandlers-available/log_json.yaml
# sqlite trava ("database is locked") e nao e usado: desligado
rm -f $E/ihandlers-enabled/log_sqlite.yaml
# escutar so no IP da VM (getifaddrs abria tambem no docker0)
sed -i 's/^listen.mode=getifaddrs/listen.mode=manual/; s/^# listen.addresses=127.0.0.1/listen.addresses=${HP_IP}/' $E/dionaea.cfg

# --- Nivel 1 (disfarce): Cowrie se apresenta como um Ubuntu 24.04 real e so aceita senhas fracas plausiveis
#     (aceitar qualquer senha denuncia o honeypot). Formato: usuario:x:senha ; "!" nega ; "*" qualquer.
mkdir -p $H/cowrie/etc
cat > $H/cowrie/etc/userdb.txt <<'EOF'
root:x:!root
root:x:!toor
root:x:123456
root:x:12345678
root:x:password
root:x:admin
root:x:1234
root:x:root123
root:x:P@ssw0rd
admin:x:admin
admin:x:123456
admin:x:password
ubuntu:x:ubuntu
user:x:user
test:x:test
support:x:support
oracle:x:oracle
postgres:x:postgres
EOF

# --- Cowrie roda como uid 999
chown -R 999:999 $H/cowrie

# override do cowrie.cfg.dist (so as chaves que mudam)
cat > $H/cowrie/etc/cowrie.cfg <<'EOF'
[honeypot]
hostname = srv-arquivos01
backend = shell

[ssh]
version = SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.20

[shell]
kernel_version = 6.8.0-147-generic
kernel_build_string = #147-Ubuntu SMP PREEMPT_DYNAMIC Thu Sep 24 11:33:16 UTC 2026
hardware_platform = x86_64
operating_system = GNU/Linux

[telnet]
enabled = true
EOF
# --- Nivel 2: se existir a senha do Ubuntu real (VM 821), o Cowrie vira intermediario (proxy):
#     valida a senha do atacante pelo userdb, grava tudo e repassa a sessao ao Linux real.
if [ -n "$BACKEND_IP" ] && [ -s $H/cowrie/etc/backend_pass ]; then
sed -i 's/^backend = shell$/backend = proxy/' $H/cowrie/etc/cowrie.cfg
cat >> $H/cowrie/etc/cowrie.cfg <<EOF

[proxy]
backend = simple
backend_ssh_host = ${BACKEND_IP}
backend_ssh_port = 22
backend_telnet_host = ${BACKEND_IP}
backend_telnet_port = 23
backend_user = root
backend_pass = $(cat $H/cowrie/etc/backend_pass)
telnet_spoof_authentication = true
telnet_username_prompt_regex = (\n|^)srv-arquivos01 login: .*
telnet_password_prompt_regex = .*Password: .*
log_raw = false
EOF
fi
chmod 640 $H/cowrie/etc/cowrie.cfg
chown -R 999:999 $H/cowrie/etc

docker rm -f cowrie dionaea >/dev/null 2>&1 || true
docker run -d --name cowrie --restart unless-stopped \
  -p 22:2222 -p 23:2223 \
  -v $H/cowrie/log:/cowrie/cowrie-git/var/log/cowrie \
  -v $H/cowrie/etc/cowrie.cfg:/cowrie/cowrie-git/etc/cowrie.cfg:ro \
  -v $H/cowrie/etc/userdb.txt:/cowrie/cowrie-git/etc/userdb.txt:ro \
  cowrie/cowrie:latest >/dev/null
docker run -d --name dionaea --restart unless-stopped --network host \
  -v $H/dionaea/etc:/opt/dionaea/etc -v $H/dionaea/var:/opt/dionaea/var \
  dinotools/dionaea:latest >/dev/null

sleep 15
docker ps --format '{{.Names}} {{.Status}}'
ls $E/services-enabled $E/ihandlers-enabled | tr '\n' ' '; echo
ss -lntu | awk 'NR>1{print $1, $5}' | sort -u | tr '\n' ';'; echo

# --- Extras (Heralding + iscas Redis/Elasticsearch/Docker): script separado, chamado aqui
#     para o setup ficar num comando só. Pule com SEM_EXTRAS=true se quiser só Cowrie+Dionaea.
if [ "${SEM_EXTRAS:-}" != "true" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  bash "$SCRIPT_DIR/subir_extras.sh"
fi
