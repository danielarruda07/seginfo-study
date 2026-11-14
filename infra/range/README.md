# infra/range

Peças reutilizáveis do cyber range descrito em [`docs/RANGE.md`](../../docs/RANGE.md), em versão genérica
(endereços viram variáveis; nenhum segredo). O ambiente real e seus valores ficam fora do repositório.

| Pasta | Conteúdo | Onde roda |
|---|---|---|
| `honeypot/honeypot_setup.sh` | sobe Cowrie (disfarce de Ubuntu 24.04, `userdb` com senhas fracas plausíveis, modo proxy opcional para um Linux real) e Dionaea (escuta só no IP da VM, log JSON). Idempotente. `HP_IP=... BACKEND_IP=... bash honeypot_setup.sh`; a senha do Linux real vai em `/opt/honeypot/cowrie/etc/backend_pass` (600) | VM do honeypot (Ubuntu + Docker) |
| `wazuh/range_honeypot_rules.xml` | regras próprias com MITRE (Cowrie 100200-100205, Dionaea 100220-100222, Windows 100240-100241) | `/var/ossec/etc/rules/` do manager |
| `wazuh/agent.conf.*.xml` | configuração centralizada dos grupos `range-windows` e `range-honeypot` | `/var/ossec/etc/shared/<grupo>/agent.conf` |
| `wazuh/ossec.conf.syslog-remote.xml` | bloco para receber o syslog do firewall | `ossec.conf` do manager |
| `wazuh/range_saida_rules.xml` | regra 100260: cada saída bloqueada de um alvo real vira alerta (a padrão do FortiGate só resume rajadas) | `/var/ossec/etc/rules/` do manager |
| `pericia/` | laudo antes do reset: inspeciona os alvos reais pelo agente QEMU (arquivos novos com SHA-256, persistência, processos, conexões), guarda amostras inertes e soma as saídas bloqueadas; envia ao app (`/api/ingest/pericia`). Service + drop-in que o encaixa antes do reset + modelo de env | VM do Wazuh |
| `reset/` | volta os alvos reais ao snapshot `limpo` a cada 6 h com token Proxmox mínimo (script + service + timer + modelo de env) | VM do Wazuh |

O coletor que leva os alertas do Wazuh ao app está em [`sensor/wazuh-forwarder`](../../sensor/wazuh-forwarder/).
