#!/bin/bash
# Isca web do range (VM propria, segmento isolado): WordPress antigo com plugins vulneraveis, DVWA e Juice Shop,
# atras de um nginx que grava TODAS as requisicoes em /var/log/isca-web/access.log (lido pelo Wazuh).
# Idempotente. Precisa de saida para a internet (regra temporaria) so durante a instalacao.
# Uso (dentro da VM, como root): bash isca_web_setup.sh <dominio> <senha-wp-admin-fraca-de-proposito>
set -euo pipefail
DOM="${1:?dominio}"; WPPASS="${2:?senha do admin do WordPress (fraca de proposito)}"
BASE=/opt/isca-web; LOGS=/var/log/isca-web; WP=/srv/isca/wp
export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq docker.io docker-compose-v2 qemu-guest-agent curl gnupg >/dev/null
systemctl enable --now docker qemu-guest-agent
# gestao so pelo agente QEMU: sem SSH real (o Cowrie ja cobre SSH)
systemctl disable --now ssh.socket ssh.service 2>/dev/null || true

mkdir -p "$BASE/nginx" "$BASE/certs" "$LOGS" "$WP"
# certificado provisorio (o Let's Encrypt entra depois que 80/443 apontarem para ca)
[ -f "$BASE/certs/fullchain.pem" ] || openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
  -subj "/CN=$DOM" -keyout "$BASE/certs/privkey.pem" -out "$BASE/certs/fullchain.pem" 2>/dev/null

cat > "$BASE/nginx/default.conf" <<EOF
log_format isca '\$remote_addr - \$remote_user [\$time_local] "\$request" \$status \$body_bytes_sent "\$http_referer" "\$http_user_agent" host=\$host scheme=\$scheme';
access_log /var/log/isca-web/access.log isca;
client_max_body_size 64m;
server { listen 80 default_server; server_name _;
  location /.well-known/acme-challenge/ { root /var/www/acme; }
  location / { proxy_pass http://wp:80; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; } }
server { listen 443 ssl default_server; server_name $DOM www.$DOM _;
  ssl_certificate /certs/fullchain.pem; ssl_certificate_key /certs/privkey.pem;
  location / { proxy_pass http://wp:80; proxy_set_header Host \$host; proxy_set_header X-Forwarded-For \$remote_addr; proxy_set_header X-Forwarded-Proto https; } }
server { listen 80; listen 443 ssl; server_name dvwa.$DOM;
  ssl_certificate /certs/fullchain.pem; ssl_certificate_key /certs/privkey.pem;
  location /.well-known/acme-challenge/ { root /var/www/acme; }
  location / { proxy_pass http://dvwa:80; proxy_set_header Host \$host; } }
server { listen 80; listen 443 ssl; server_name shop.$DOM;
  ssl_certificate /certs/fullchain.pem; ssl_certificate_key /certs/privkey.pem;
  location /.well-known/acme-challenge/ { root /var/www/acme; }
  location / { proxy_pass http://juice:3000; proxy_set_header Host \$host; } }
EOF

cat > "$BASE/compose.yaml" <<EOF
services:
  proxy:
    image: nginx:1.27-alpine
    ports: ["80:80", "443:443"]
    volumes: ["./nginx:/etc/nginx/conf.d:ro", "./certs:/certs:ro", "$LOGS:/var/log/isca-web", "./acme:/var/www/acme:ro"]
    depends_on: [wp, dvwa, juice]
    restart: unless-stopped
  db:
    image: mariadb:10.6
    environment: { MARIADB_ROOT_PASSWORD: root, MARIADB_DATABASE: wordpress, MARIADB_USER: wordpress, MARIADB_PASSWORD: wordpress }
    volumes: ["db:/var/lib/mysql"]
    restart: unless-stopped
  wp:
    image: wordpress:5.8.1-php7.4-apache
    environment: { WORDPRESS_DB_HOST: db, WORDPRESS_DB_USER: wordpress, WORDPRESS_DB_PASSWORD: wordpress, WORDPRESS_DB_NAME: wordpress }
    volumes: ["$WP:/var/www/html"]
    depends_on: [db]
    restart: unless-stopped
  dvwa:
    image: vulnerables/web-dvwa:latest
    restart: unless-stopped
  juice:
    image: bkimminich/juice-shop:v15.0.0
    restart: unless-stopped
volumes: { db: {} }
EOF
mkdir -p "$BASE/acme"
cd "$BASE" && docker compose pull -q && docker compose up -d

# WordPress: instala, cria admin fraco e plugins com falhas conhecidas (versoes antigas)
WPCLI="docker run --rm --network isca-web_default -v $WP:/var/www/html --user 33:33 -e WORDPRESS_DB_HOST=db -e WORDPRESS_DB_USER=wordpress -e WORDPRESS_DB_PASSWORD=wordpress -e WORDPRESS_DB_NAME=wordpress wordpress:cli"
for i in $(seq 1 30); do $WPCLI wp core is-installed 2>/dev/null && break; \
  $WPCLI wp core install --url="https://$DOM" --title="${TITULO_SITE:-Empresa}" --admin_user=admin --admin_password="$WPPASS" \
  --admin_email="contato@$DOM" --skip-email 2>/dev/null && break; sleep 5; done
# versoes com falhas conhecidas (RCE, SQLi, path traversal); baixadas e descompactadas direto (o wp-cli recusa alguns zips antigos)
command -v unzip >/dev/null || apt-get install -y -qq unzip >/dev/null
for p in wp-file-manager:6.0 duplicator:1.3.24 contact-form-7:5.3.1 social-warfare:3.5.2 loginizer:1.6.3 wpdiscuz:7.0.4 wp-statistics:13.0.7; do
  n=${p%%:*}; v=${p##*:}
  if [ ! -d "$WP/wp-content/plugins/$n" ]; then
    curl -fsSL -o "/tmp/$n.zip" "https://downloads.wordpress.org/plugin/$n.$v.zip"
    unzip -q -o "/tmp/$n.zip" -d "$WP/wp-content/plugins/"
    # o wp-file-manager 6.0 vem com um zip dentro do zip
    interno=$(ls "$WP/wp-content/plugins/$n/"*.zip 2>/dev/null | head -1 || true)
    if [ -n "$interno" ]; then rm -rf /tmp/zi && mkdir /tmp/zi && unzip -q -o "$interno" -d /tmp/zi && rm -rf "$WP/wp-content/plugins/$n" && mv /tmp/zi/"$n" "$WP/wp-content/plugins/$n"; fi
    chown -R 33:33 "$WP/wp-content/plugins/$n"
  fi
  $WPCLI wp plugin activate "$n" 2>&1 | tail -1 || true
done
$WPCLI wp option update blog_public 1
$WPCLI wp user create editor "editor@$DOM" --role=editor --user_pass=editor123 2>/dev/null || true
# atualizacoes automaticas desligadas (a isca precisa continuar vulneravel)
grep -q AUTOMATIC_UPDATER_DISABLED "$WP/wp-config.php" || \
  sed -i "/That's all, stop editing/i define('AUTOMATIC_UPDATER_DISABLED', true);\ndefine('WP_AUTO_UPDATE_CORE', false);" "$WP/wp-config.php"

# agente Wazuh (mesma versao do manager)
if ! dpkg -s wazuh-agent >/dev/null 2>&1; then
  curl -fsSL https://packages.wazuh.com/key/GPG-KEY-WAZUH | gpg --dearmor -o /usr/share/keyrings/wazuh.gpg
  echo "deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main" > /etc/apt/sources.list.d/wazuh.list
  apt-get update -qq
  WAZUH_MANAGER="${WAZUH_MANAGER:?defina WAZUH_MANAGER (IP do manager)}" WAZUH_AGENT_NAME=range-isca-web WAZUH_AGENT_GROUP=range-isca-web \
    apt-get install -y -qq wazuh-agent=4.14.10-1 >/dev/null
  apt-mark hold wazuh-agent
  systemctl enable --now wazuh-agent
fi
echo "OK isca-web: $(docker compose -f $BASE/compose.yaml ps --format '{{.Service}}={{.State}}' | tr '\n' ' ')"
