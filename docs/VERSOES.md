# Versões

A versão aparece no rodapé do menu lateral (`v0.17.0 · build dd/mm hh:mm`) e em `/api/health`. Ela fica em `packages/shared/src/versao.ts`, lida pelo front e pela API.

**Como conferir se você está na versão certa:** compare o número do rodapé com o da publicação mais recente abaixo. Se o rodapé mostrar um aviso "API em vX", o front e a API estão em versões diferentes: espere o deploy terminar ou recarregue com Ctrl+F5.

**Regra:** toda publicação na `main` aumenta a versão e ganha uma linha aqui. Último número para correção ou ajuste; número do meio para funcionalidade nova.

| Versão | Data | O que entrou |
|---|---|---|
| 0.20.0 | 14/11/2026 | Carreira: Estúdio do LinkedIn gera roteiro de carrossel, direção visual e texto alternativo persistidos no servidor; checklist abandona tamanho/hashtags como regras universais; estratégia editorial e orientações oficiais reunidas em `docs/LINKEDIN.md` |
| 0.19.0 | 14/11/2026 | Carreira: LinkedIn ganhou kit editável de headline e Sobre, checklist de perfil, ritmo editorial e briefings por pilar; modelos usam campos de confirmação e a IA é orientada a não inventar fatos de carreira. Meu Ambiente deixou de iniciar com exemplos e remove itens demonstrativos antigos, preservando ativos reais cadastrados pelo usuário |
| 0.18.0 | 14/11/2026 | Iscas (honeytokens) no Windows real: arquivo isca com credenciais falsas e conta isca, auditoria de arquivo, regras 100270-100272 do Wazuh (nível 12 a 14); seção "Iscas" no `docs/RANGE.md` com as armadilhas de configuração (filtro 4663 do agente, posição do log após rollback, snapshot limpo) |
| 0.17.0 | 14/11/2026 | Todas as telas: cartões e linhas abrem uma ficha lateral com detalhe, relações e ações (↑/↓ entre itens); indicadores viram filtros; cores por tokens; menu lateral sempre recolhido; prévia de artefatos HTML isolada; senha do Cofre só com "Revelar" |
| 0.16.1 | 14/11/2026 | Painel Wazuh: corrigido `GET /agents` que devolvia HTTP 400 nesta versão do Wazuh (4.14.10 rejeita `select=os`; precisa dos subcampos `os.name,os.version`) |
| 0.16.0 | 14/11/2026 | Painel Wazuh: estado do manager e agentes via API somente leitura, alertas encaminhados com busca e detalhe, integração documentada e campos sensíveis redigidos. Mais superfície real na Matriz ATT&CK: Heralding (VNC, PostgreSQL, SMTP, POP3, IMAP) e iscas de Redis/Elasticsearch/API do Docker trazidas da infraestrutura real do range para `infra/range/honeypot/`, com `T1610` (Deploy Container) adicionado ao catálogo e regras novas no Wazuh (100223-100228) |
| 0.15.1 | 14/11/2026 | Coletor do laudo pré-reset em `infra/range/pericia/` (script, service, drop-in antes do reset, modelo de env), regra 100260 do Wazuh para saídas bloqueadas dos alvos reais e seção "Laudo antes do reset" no `docs/RANGE.md` |
| 0.15.0 | 14/11/2026 | Laudos dos alvos reais: antes de cada reset, a VM do Wazuh inspeciona os alvos reais do honeypot pelo agente QEMU (arquivos criados ou alterados com SHA-256, persistência, processos e conexões do invasor) e soma as saídas que o firewall bloqueou; o laudo chega por `POST /api/ingest/pericia` e aparece na tela nova "Laudos dos alvos", cruzado com quem entrou no alvo naquela janela |
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
