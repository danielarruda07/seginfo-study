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
| Exposto | honeypot: Cowrie (SSH/Telnet) e Dionaea (FTP, HTTP/S, MSSQL, MySQL...) | Wazuh (agente), alvo real Linux (proxy) | não |
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

## Como operar
| Ação | Como |
|---|---|
| Encerrar a exposição antes do prazo | desativar as regras de entrada agendadas no FortiGate |
| Prorrogar | mudar o fim do agendamento da exposição |
| Limpar um alvo real agora | rodar o serviço de reset no Wazuh (ou rollback do snapshot `limpo`) |
| Ver ataques | app → Radar (tabela, ficha do evento) e Matriz ATT&CK (camada "Vistas no Radar") |
| Investigar a fundo | Wazuh (alertas), `cowrie.json`/`dionaea.json` no honeypot, logs do FortiGate |
