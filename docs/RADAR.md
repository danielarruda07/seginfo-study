# Radar de Ataques

Transforma as tentativas de invasão contra o seu IP público em dados de estudo: o que
chega, de onde, contra qual serviço e com quais usuários.

```
Internet ─► 138.122.82.214 ─► FortiGate ─┬─ port-forward ─► VM sensor (DMZ isolada)
                                         │                   ├─ Cowrie      22/23  (SSH/Telnet)
                                         │                   ├─ OpenCanary  21/80/1433/3389
                                         │                   └─ shipper ◄── syslog UDP 514 (FortiGate)
                                         └─ RDP real (1401): tirar da WAN
                                                              │ HTTPS + Service Token + X-Ingest-Token
Servidores Windows (tarefa 4625/4740) ───────────────────────┤
                                                              ▼
                         estudo.criecom.ia.br/api/ingest ─► seginfo-api ─► Postgres (AtaqueEvento)
                                                                              ▼
                                                              tela "Radar" na SegInfo
```

## Princípios de segurança

- **O sensor é descartável e isolado.** Roda numa VM própria na DMZ, com saída para as
  redes internas bloqueada. Nunca no host do Coolify nem junto de servidores reais.
- **Ingestão em três camadas.** (1) Cloudflare Access com Service Auth, (2) a API
  revalida o JWT do Access (assinatura, emissor, AUD e `common_name`), (3) token próprio
  no header `X-Ingest-Token`, comparado em tempo constante. Sem a configuração completa,
  a API responde 503 (fail-closed).
- **Senhas tentadas: desligado por padrão.** Só são guardadas com `RADAR_GUARDAR_SENHAS=true`
  e só de honeypots (Cowrie/OpenCanary). São dado sensível: podem ser credenciais reais
  vazadas de terceiros. Não coloque em print, post de LinkedIn nem repositório.
- **Idempotente e limitada.** Reenvio não duplica (`dedupKey`); lote de até 500 eventos,
  1 MB por requisição, `detalhes` até 4 KB; retenção de `ATAQUES_RETENCAO_DIAS` (padrão 90).

## Antes de começar: autorização

Enviar logs de servidores ou do FortiGate **da empresa** (nomes de contas, IPs) para uma
aplicação hospedada fora do ambiente corporativo exige **autorização formal** do gestor e
da segurança. Sem ela, use só o honeypot, o seu FortiGate e o seu homelab.

Expor 21/22/23/80/1433/3389 no IP **atrai** varredura para a VM sensor. Garanta que
nenhum serviço real escute nessas portas e IPs.

## 1. Fazer primeiro: tirar o RDP real da WAN

O VIP `10.10.10.100:1401` publicado na WAN é o alvo real do brute force. Com o honeypot
absorvendo a varredura, o ideal é que o RDP real nem apareça na internet. Acesse-o pelo
`rdp.criecom.ia.br` (Cloudflare Access). Isso independe do sensor.

## 2. Cloudflare Access para a ingestão (só ADICIONAR)

Não edite a aplicação `estudo` (a de login por e-mail).

1. **Zero Trust → Access controls → Service credentials → Create Service Token**:
   nome `seginfo-sensor`. Guarde o **Client ID** (termina em `.access`) e o **Client
   Secret** (aparece uma vez só). Guarde ambos no Cofre.
2. **Access controls → Applications → Add → Self-hosted**: nome `estudo-ingest`,
   domínio `estudo.criecom.ia.br`, **path `api/ingest`**.
   Policy: **Action = Service Auth**, Include → **Service Token** = `seginfo-sensor`.
   O caminho mais específico tem prioridade sobre a aplicação `estudo`.
3. Abra a `estudo-ingest` → **Edit → Additional settings** e copie o **AUD**.

## 3. Variáveis no Coolify (`seginfo-api`, runtime, sem Build Variable)

| Variável | Valor |
|---|---|
| `INGEST_TOKEN` | `openssl rand -hex 32` (o mesmo vai no `.env` do sensor) |
| `INGEST_OWNER_EMAIL` | o e-mail com que você entra no Access (dono dos eventos) |
| `CF_ACCESS_INGEST_CLIENT_ID` | Client ID do Service Token |
| `CF_ACCESS_INGEST_AUD` | AUD da aplicação `estudo-ingest` |
| `RADAR_GUARDAR_SENHAS` | `false` (padrão). `true` só se decidir guardar senhas de honeypot |
| `ATAQUES_RETENCAO_DIAS` | opcional, padrão 90 |

`CF_ACCESS_TEAM` e `CF_ACCESS_AUD` (da app `estudo`) já existem. Depois de salvar, faça
redeploy.

## 4. Migration

O módulo adiciona a tabela `AtaqueEvento`. Gere a migration (sem banco) e comite:

```powershell
cd "C:\Users\eu\OneDrive\KIRO\CONTROLE DE ESTUDO"
git show HEAD:apps/api/prisma/schema.prisma | Out-File -Encoding ascii apps\api\prisma\old.prisma
cd apps\api
npx prisma migrate diff --from-schema prisma/old.prisma --to-schema prisma/schema.prisma --script
```

Salve a saída em `apps/api/prisma/migrations/<timestamp>_ataque_evento/migration.sql`
(sem BOM) e apague o `old.prisma`. O container aplica no start.

## 5. Teste da ingestão

De qualquer máquina, sem expor segredos no histórico:

```bash
read -rs CLIENT_SECRET; read -rs INGEST_TOKEN
curl -sS -X POST https://estudo.criecom.ia.br/api/ingest \
  -H "CF-Access-Client-Id: SEU_CLIENT_ID.access" \
  -H "CF-Access-Client-Secret: $CLIENT_SECRET" \
  -H "X-Ingest-Token: $INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventos":[{"fonte":"outro","ocorridoEm":"2026-11-10T12:00:00Z","ipOrigem":"203.0.113.10","acao":"scan","servico":"teste"}]}'
```

Esperado: `{"ok":true,"recebidos":1,"inseridos":1}`. Repetir devolve `"inseridos":0`
(deduplicação). `203.0.113.10` é endereço de documentação (RFC 5737).

| Resposta | Causa provável |
|---|---|
| 403 / página do Access | Service Token errado ou a app `estudo-ingest` sem policy Service Auth |
| 401 | `X-Ingest-Token` errado, ou `CF_ACCESS_INGEST_CLIENT_ID`/AUD não conferem com o JWT |
| 503 | alguma variável da seção 3 faltando |
| 400 | payload fora do formato (ver abaixo) |

Se der 401 mesmo com tudo certo, o claim `common_name` do JWT pode diferir do Client ID.
Capture o JWT (`Cf-Access-Jwt-Assertion`) e decodifique em jwt.io para ver o valor.

## 6. Sensor honeypot (VM)

**VM:** Debian 12, 2 vCPU, 2 GB RAM, 20 GB. Bridge/VLAN própria (DMZ), sem rota para as
redes internas. Aplique o firewall em dois lugares:

- **Firewall da VM (Proxmox):** IN `tcp 21,22,23,80,1433,3389` qualquer; IN `udp 514` só
  do IP do FortiGate; IN `tcp 22222` só da sua estação (SSH admin); OUT `tcp 443`, `udp/tcp 53`
  permitidos; **OUT para 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 bloqueado, acima da
  regra de 443**; política padrão DROP.
- **FortiGate:** policy **DMZ → redes internas = deny** (não dependa só do firewall da VM).

```bash
# na VM, como root: mover o SSH admin ANTES de subir o Cowrie na porta 22
sed -i 's/^#\?Port .*/Port 22222/' /etc/ssh/sshd_config && systemctl restart ssh
apt-get update && apt-get install -y docker.io docker-compose-plugin unattended-upgrades
mkdir -p /opt/seginfo-sensor        # copie a pasta sensor/ do repositório para cá
cd /opt/seginfo-sensor && cp .env.example .env && chmod 600 .env && nano .env
docker compose up -d --build
docker compose logs -f shipper
```

No `.env`: `INGEST_URL`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `INGEST_TOKEN`,
`SENSOR_NAME` e `SYSLOG_ALLOW` (IP do FortiGate; vazio desliga o syslog).

Conferências: `docker compose ps` (3 serviços de pé), `docker compose logs opencanary`
(sem erro de config) e `docker compose logs shipper` ("shipper iniciado"). Teste local
com `ssh -p 22 root@IP_DA_VM` e veja `login_falha` aparecer no Radar. Não coloque a porta
22222 no port-forward. Depois do primeiro `pull`, fixe as imagens por digest
(`docker compose images`).

Observações: a imagem Docker do OpenCanary **não tem portscan** (exige iptables). O
Dionaea/SMB ficou de fora de propósito, para reduzir a superfície do sensor.

## 7. Port-forward no FortiGate (só para a VM sensor)

VIP por porta, repetindo para `21, 22, 23, 80, 1433, 3389`:

```
config firewall vip
    edit "HP-3389"
        set extip 138.122.82.214
        set extintf "wan"
        set portforward enable
        set mappedip "IP_DA_VM_SENSOR"
        set extport 3389
        set mappedport 3389
    next
end
```

Ajuste `extintf` para a sua interface WAN real. Crie a policy WAN → DMZ com esses VIPs,
`logtraffic all`, **sem** perfis de segurança que descartem (o objetivo é deixar chegar).
Audite com `show firewall vip` antes: nenhuma porta pode apontar para um host real.

## 8. Syslog do FortiGate para o shipper

Use um slot livre (`syslogd2`/`syslogd3`) para não mexer no que já envia ao Zabbix:

```
config log syslogd2 setting
    set status enable
    set server "IP_DA_VM_SENSOR"
    set mode udp
    set port 514
end
config log syslogd2 filter
    set severity information
    set forward-traffic enable
    set local-traffic enable
    set anomaly enable
end
```

O shipper só aproveita: tráfego **negado** com origem **pública**, eventos de IPS, e falhas
de login (admin/VPN). O parser segue o formato `chave=valor` documentado do FortiOS e
**precisa ser validado com linhas reais**; se algo não aparecer no Radar, envie 2 ou 3
linhas de log (sem dados sensíveis) para ajustar.

## 9. Windows (servidores RDP e DC)

Auditoria necessária (GPO): *Advanced Audit Policy → Logon/Logoff → Audit Logon = Failure*;
no DC, *Account Management → Audit User Account Management = Success* (gera o 4740).

```powershell
# PowerShell como Administrador, na pasta windows\
.\Send-LogonFailures.ps1 -Install        # pergunta Client ID, Secret e token (sem exibir)
Start-ScheduledTask 'SegInfo - Falhas de Logon'
Get-ScheduledTaskInfo 'SegInfo - Falhas de Logon'   # LastTaskResult = 0
```

Os segredos ficam em `C:\ProgramData\SegInfo\ingest.json`, legível só por SYSTEM e
Administradores. Mapeamento: 4625 vira `login_falha` (LogonType 10 = `rdp`, 3 = `rede`),
4740 vira `lockout` (sem IP). Remover: `.\Send-LogonFailures.ps1 -Uninstall`.
Lembre da seção "Antes de começar: autorização".

## 10. O que aparece no Radar

KPIs (eventos, IPs únicos, falhas de login, contas bloqueadas), linha do tempo, IPs mais
ativos, serviços visados, usuários tentados, países, técnicas MITRE ATT&CK (T1110 brute
force, T1046 discovery, T1078, T1059) e a tabela de eventos com filtros. Países só
aparecem se o coletor enviar `paisOrigem` (enriquecimento GeoIP é um próximo passo).
