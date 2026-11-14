# Cyber range e honeypot exposto

Arquitetura do range do homelab como está construído, **sem dados reais** (endereços, IDs e senhas ficam
na documentação privada, fora do repositório). Scripts e regras reutilizáveis em [`infra/range/`](../infra/range/).

## Objetivo
O caminho é inverso ao usual: primeiro **ficar exposto à internet por decisão própria**, observar ataques reais
com honeypot e alvos reais isolados, e depois **reproduzir os mesmos ataques com a Kali** dentro do range
(red team) e treinar a detecção no Wazuh (blue team). Os eventos alimentam o Radar e a Matriz ATT&CK do app.

## Segmentos
| Segmento | Conteúdo | Pode falar com | Saída para a internet |
|---|---|---|---|
| Alvos internos | Windows vítima (Sysmon + Wazuh) e vagas para Linux/web vulneráveis | Kali (retorno), Wazuh (agente) | não |
| Atacante | Kali | alvos internos | não (janela temporária só para atualizar) |
| Exposto | honeypot: Cowrie (SSH/Telnet), Dionaea (FTP, HTTP/S, MSSQL, MySQL...), Heralding (VNC, PostgreSQL, SMTP, POP3, IMAP) e iscas próprias (Redis, Elasticsearch, API do Docker) | Wazuh (agente), alvo real Linux (proxy) | não |
| Alvos reais | Ubuntu real atrás do Cowrie; Windows Server real exposto (RDP, SMB) | Wazuh (só canal de eventos) | não |
| Servidores | Wazuh (SIEM), Proxmox, app | — | — |

Cada segmento é uma VLAN no switch e uma interface no FortiGate. Toda passagem entre segmentos atravessa o
firewall e gera log. Regras de bloqueio explícitas (com log) para "rede interna" e "internet" em cada segmento
do range; as permissões são pontuais e ficam acima delas.

## Fluxo da exposição
```
Internet ─► ONT da operadora (IP público, port mapping) ─► FortiGate (VIPs, regra agendada)
   SSH/Telnet (+ portas alternativas) ─► Cowrie ── valida a senha ──► Ubuntu REAL (proxy)
   FTP, web (+ portas alternativas), MSSQL, MySQL, SIP, PPTP, MQTT, impressora, MongoDB, memcached ─► Dionaea
   VNC, PostgreSQL, SMTP, POP3, IMAP ─► Heralding (captura de credenciais)
   Redis, Elasticsearch, API do Docker ─► iscas próprias (registram e respondem o mínimo; nada executa)
   RDP, SMB, RPC, NetBIOS ─► Windows Server REAL (NLA, compartilhamento isca)
   UDP de reflexão (DNS, NTP, SSDP, memcached) ─► o FIREWALL registra e DESCARTA (nada responde)
```
- A regra de entrada usa **agendamento com data de fim**: a exposição fecha sozinha (72 h por rodada).
- Os alvos reais voltam ao snapshot `limpo` **a cada 6 horas** (timer no Wazuh com token Proxmox mínimo:
  só auditoria, energia e rollback dessas VMs).
- Nenhum segmento exposto tem saída para a internet: malware que tente baixar a segunda etapa falha.

## Heralding e iscas próprias: mais superfície real, sem executar nada

Cowrie e Dionaea cobrem reconhecimento e acesso inicial muito bem, mas pouco das táticas
seguintes da cadeia (persistência, escalação, movimento lateral, exfiltração, impacto): um
atacante só chega lá se continuar agindo depois de entrar, e a maioria dos bots de varredura
não passa disso. Para aumentar a chance de observar essas táticas de verdade — sem criar um
serviço que de fato execute algo —, duas peças entram na mesma VM do honeypot
([`infra/range/honeypot/`](../infra/range/honeypot/)):

- **Heralding** (VNC, PostgreSQL, SMTP, POP3, IMAP): honeypot de credenciais dedicado,
  ligado só nos protocolos que Cowrie/Dionaea não cobrem (evita duas aplicações competindo
  pela mesma porta). Builda a própria imagem (não há imagem oficial mantida do projeto).
- **Iscas próprias** (Redis 6379, Elasticsearch 9200, API do Docker 2375): um servidor
  assíncrono pequeno que fala o protocolo mínimo de cada serviço, registra tudo que o
  atacante tenta (`AUTH` do Redis com usuário/senha, requisição HTTP do Elasticsearch,
  `POST /containers/create`, `/start`, `/exec` e `/images/create` da API do Docker) e devolve
  uma resposta plausível — sem nunca autenticar, criar container ou baixar imagem de verdade.
  É o tipo de serviço que um atacante que já tem acesso usaria para persistir (plantar uma
  chave SSH via `CONFIG SET` do Redis) ou escalar/minerar (subir um container via API do
  Docker exposta); a isca deixa a tentativa visível sem deixar nada acontecer.

Mapeamento MITRE das novas fontes (regras Wazuh 100223-100228): credenciais tentadas em
Heralding ou nas iscas → T1110 (Brute Force); `container_create`/`container_exec` na isca do
Docker → T1610 (Deploy Container); `image_pull` → T1204 (User Execution, pela tentativa de
trazer um artefato para execução). Essas técnicas entram no Radar e na Matriz ATT&CK do app
do mesmo jeito que Cowrie e Dionaea, pelo `sensor/wazuh-forwarder` (fontes `heralding` e `isca`).

Subir (idempotente, chamado também pelo final de `honeypot_setup.sh`):
```bash
bash /opt/honeypot/subir_extras.sh   # ou: HP_IP=... bash honeypot_setup.sh (já inclui os extras)
```

## Reflexão UDP: estudar sem virar arma
Expor serviços UDP que respondem (DNS, NTP, SSDP, memcached) transformaria o IP em refletor de DDoS contra
terceiros. Aqui as portas são encaminhadas até o firewall e caem numa **regra de bloqueio com registro**:
o pacote é logado e descartado, nenhum serviço recebe e nada é respondido. Como a origem desse tráfego é
falsificada, o "IP de origem" registrado é a **vítima** pretendida. O Wazuh classifica como T1498.002 e o
Radar mostra a ação `reflexao` com esse aviso.

## Por que Cowrie em modo proxy + Linux real
Um bot real fez checagem anti-honeypot logo após o login (aritmética no shell, `$$`, funções, subshell,
`/proc/self/stat`). O shell emulado do Cowrie falha nesses testes e o bot vai embora sem mostrar o ataque.
Solução em dois níveis:
1. **Disfarce:** banner e kernel de um Ubuntu 24.04 atual, hostname plausível e `userdb` que aceita só
   senhas fracas comuns (aceitar qualquer senha denuncia o honeypot).
2. **Alta interação:** o Cowrie vira intermediário e repassa a sessão para um Ubuntu real descartável;
   continua gravando senhas e comandos. O Linux real passa em todos os testes.
O Ubuntu real não tem agente de monitoração (para não denunciar) e não guarda rastros da instalação.

## Blue team (Wazuh)
- Entradas: agentes (Windows vítima, honeypot, Windows exposto), syslog do FortiGate, JSON do Cowrie e do Dionaea.
- Regras próprias com MITRE ([`infra/range/wazuh/range_honeypot_rules.xml`](../infra/range/wazuh/range_honeypot_rules.xml)):
  login falho/aceito, comando, força bruta e transferência de arquivo no Cowrie; conexão, credenciais e
  payload no Dionaea; logon falho do Windows como T1110.001 e logon RDP aceito como alerta alto (T1078, T1021.001).
- Coletor `sensor/wazuh-forwarder` leva os alertas ao app (`/api/ingest`) por Cloudflare Access + token próprio.
  O honeypot continua sem saída; quem fala com o app é a VM do Wazuh.

## Decisões e lições
- **Fechar a WAN antes de abrir qualquer porta:** administração do firewall e RDP antigos estavam acessíveis
  pela WAN e foram fechados; DMZ do ONT nunca é usada (exporia o firewall).
- **Isolamento no firewall, não na VM:** um invasor com root nos alvos reais não consegue desligar a regra
  que o prende. Por isso cada alvo real fica num segmento próprio atrás do FortiGate.
- **Login "aceito" em honeypot é isca, não invasão.** O Radar marca como "login aceito (isca)".
- **Enrollment do Wazuh fechado depois de registrar os agentes** dos alvos reais (só o canal de eventos fica aberto).
- **Memória curta:** não fazer rodízio de liga/desliga de VMs; ajustar a memória delas.
- **Instalação sem console:** Linux por ISO de seed do cloud-init e Windows por `autounattend.xml` + script
  de primeiro logon (rede, RDP/NLA, SMB, auditoria, agente QEMU), ambos gerados e enviados por API.

## Laudo antes do reset
Logo antes de cada reset, `seginfo-pericia` (na VM do Wazuh, [`infra/range/pericia/`](../infra/range/pericia/)) examina
cada alvo real **pelo agente QEMU via API do Proxmox**, sem instalar nada no alvo:
- arquivos criados ou alterados desde o snapshot `limpo` (tipo ELF/PE/script, SHA-256);
- persistência: cron, systemd, chaves SSH, perfis de shell, `ld.so.preload`, contas; no Windows, tarefas,
  serviços (7045), contas e grupos (4720/4732), chaves Run e assinaturas WMI;
- processos iniciados depois do boot e conexões abertas;
- amostras dos executáveis copiadas em pedaços para `/var/lib/seginfo-pericia/amostras/<sha256>.bin` (0400,
  nunca executadas, nunca enviadas ao app; o app guarda só o hash);
- saídas bloqueadas pelo firewall na janela (regra 100260, uma por tentativa).

O token do reset ganhou um papel extra só nas VMs dos alvos reais: `VM.GuestAgent.Audit`, `VM.GuestAgent.FileRead`
e `VM.GuestAgent.Unrestricted` (executar comandos pelo agente). O laudo roda como o usuário do coletor (grupo `wazuh`),
não como root; se falhar, o reset acontece mesmo assim. No app: Inteligência → **Laudos dos alvos**.

Limite conhecido: um rootkit de espaço de usuário (`/etc/ld.so.preload`) pode esconder arquivos e processos da própria
coleta; o laudo avisa quando encontra um.

## Como operar
| Ação | Como |
|---|---|
| Encerrar a exposição antes do prazo | desativar as regras de entrada agendadas no FortiGate |
| Prorrogar | mudar o fim do agendamento da exposição |
| Limpar um alvo real agora | rodar o serviço de reset no Wazuh (ou rollback do snapshot `limpo`) |
| Ver ataques | app → Radar (tabela, ficha do evento) e Matriz ATT&CK (camada "Vistas no Radar") |
| Laudo agora (sem esperar o reset) | `systemctl start seginfo-pericia` na VM do Wazuh; `DRY_RUN=true` no env gera só o arquivo local |
| Investigar a fundo | Wazuh (alertas), `cowrie.json`/`dionaea.json` no honeypot, logs do FortiGate |
