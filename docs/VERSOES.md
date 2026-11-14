# Versões

A versão aparece no rodapé do menu lateral (`v0.13.0 · build dd/mm hh:mm`) e em `/api/health`. Ela fica em `packages/shared/src/versao.ts`, lida pelo front e pela API.

**Como conferir se você está na versão certa:** compare o número do rodapé com o da publicação mais recente abaixo. Se o rodapé mostrar um aviso "API em vX", o front e a API estão em versões diferentes: espere o deploy terminar ou recarregue com Ctrl+F5.

**Regra:** toda publicação na `main` aumenta a versão e ganha uma linha aqui. Último número para correção ou ajuste; número do meio para funcionalidade nova.

| Versão | Data | O que entrou |
|---|---|---|
| 0.14.0 | 14/11/2026 | Radar: resumo agregado no banco (sem limite de linhas), origem Internet × Range, atualização a cada minuto, retenção menor para conexões simples; coletor com país (GeoIP DB-IP), lote recusado dividido ao meio e leitura completa na rotação do arquivo; IP público retirado do inventário documentado |
| 0.13.0 | 14/11/2026 | Radar com mais fontes do range: Heralding (credenciais em VNC, PostgreSQL, SMTP, POP3, IMAP), iscas de Redis/Elasticsearch/API do Docker e a ação "reflexão" (T1498.002) para tentativas de usar o IP como refletor de DDoS, com aviso de que a origem é a vítima falsificada; coletor do Wazuh atualizado |
| 0.12.0 | 14/11/2026 | Radar mostra a sessão do atacante: na ficha do evento, a linha do tempo da sessão do honeypot (do primeiro contato ao último comando), cada comando classificado pela intenção (reconhecimento, privilégio, download, execução, persistência, limpeza, mineração, teste anti-honeypot), os arquivos enviados com SHA-256 e link do VirusTotal, e a nova ação "túnel" (SSH usado como proxy, T1090) trazida pelo coletor do Wazuh |
| 0.11.2 | 14/11/2026 | Documentação para análise por IAs: `AGENTS.md`/`CLAUDE.md` na raiz (mapa, comandos, regras), `docs/RANGE.md` (arquitetura do range e do honeypot, sem dados reais) e `infra/range/` (scripts e regras do Wazuh reutilizáveis); IP público retirado do `docs/RADAR.md` |
| 0.11.1 | 13/11/2026 | Radar no horário local (tabela, ficha e linha do tempo; a ficha mostra também o UTC); coluna "Detalhe" com o comando ou arquivo; login aceito por honeypot aparece como "login aceito (isca)" com explicação na ficha |
| 0.11.0 | 13/11/2026 | Radar recebe os ataques do range via Wazuh: fontes novas (Dionaea, ação "download"), técnica MITRE vinda da regra do Wazuh alimentando a camada "Vistas no Radar" do ATT&CK, ficha do evento com técnica, comando executado e regra; coletor `sensor/wazuh-forwarder` |
| 0.10.0 | 13/11/2026 | Cofre com segundo fator (Google Authenticator): o servidor confere o código de 6 dígitos antes de entregar o Cofre, que continua cifrado com a senha-mestra; Cofre sincronizado entre aparelhos; 10 códigos de recuperação de uso único; bloqueio após 5 erros; registro de acessos |
| 0.9.1 | 13/11/2026 | Meu Ambiente: "Acessos e integrações" saiu do meio da página e virou uma barra de uma linha; o detalhe abre numa ficha lateral, com cartões por integração e variáveis faltantes marcadas |
| 0.9.0 | 13/11/2026 | Agents: cartões com ciclo de vida (projeto → execução → avaliação → ativo) e próximo passo clicável; aprovações pendentes no topo com link direto para a execução; busca e filtro por status; modelos no diálogo "Novo agente"; onboarding na tela vazia |
| 0.8.1 | 13/11/2026 | Meu Ambiente: o gráfico "Ativos por tipo" e o seletor de tipo viraram um painel de cartões agrupados (computação, rede e segurança, estações e dispositivos, serviços), clicáveis para filtrar |
| 0.8.0 | 13/11/2026 | Tipos novos no inventário (servidor físico, ponto de acesso, estação, dispositivo) para receber a descoberta da rede real |
| 0.7.0 | 13/11/2026 | Versão no rodapé do menu; painel "Acessos e integrações" em Meu Ambiente; erros do Proxmox resumidos com dica |
| 0.6.0 | 13/11/2026 | FortiGate e Catalyst 2960 nos agentes, controle de custo diário, auditoria das ações (publicado por outra sessão, sem número na época) |
| 0.5.0 | 13/11/2026 | Tela de aprovação e ações de escrita no Proxmox (sem número na época) |
| 0.4.0 | 13/11/2026 | Leitura do Proxmox pelos agentes (sem número na época) |
| 0.3.0 | 13/11/2026 | Playground: execução de agentes (sem número na época) |

As versões anteriores à 0.7.0 foram numeradas depois, para referência; o app só mostra versão a partir da 0.7.0.
