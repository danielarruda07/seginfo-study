# Pendências

Lista viva do que ficou combinado e ainda não foi feito. Marque `[x]` ao concluir.
Última atualização: 2026-11-10.

## Segurança (prioridade)

- [ ] **Ligar a IA do LinkedIn.** Criar a chave em console.anthropic.com (com limite de gasto
      mensal) e cadastrar como Secret `ANTHROPIC_API_KEY` no serviço `seginfo-api` do Coolify.
      Nunca colar a chave em chat, issue ou commit.

- [ ] **Tirar o RDP real da WAN.** O VIP `10.10.10.100:1401` publicado no IP público é o
      alvo do brute force. Acessar pelo `rdp.criecom.ia.br` (Cloudflare Access). Conferir nos
      logs do FortiGate se há tentativas contra a porta 1401. Relacionado ao lab
      "Hardening do FortiGate".
- [ ] **Rotacionar a senha do banco `seginfo_app`.** A senha atual apareceu no chat.
      No `psql` do container: `\password seginfo_app`, depois atualizar o Secret
      `DATABASE_URL` no Coolify e fazer redeploy.
- [ ] **Conferir se o Gitea corporativo (porta 3000, HTTP) é alcançável pela internet.**
      Teste pelo celular com dados móveis. Se abrir, está exposto sem TLS: colocar atrás de
      HTTPS (proxy ou Cloudflare Access) e fechar a porta. Tratar com a equipe da empresa.
- [ ] **Backup do banco `seginfo_study`.** Ele vive dentro do container Postgres 16 da
      CRIECOMIA. Se o recurso for recriado no Coolify, o banco some. Configurar backup agendado.
- [x] ~~Arquivo `t resolve 1 no alpine)` na raiz do projeto.~~ Era a tela de ajuda do `less`,
      sem dados sensíveis; apagado em 2026-11-10. Nunca entrou no repositório.
- [ ] **Decidir sobre o ChatGPT Codex Connector** no repositório `seginfo-study` (acesso de
      terceiro ao código com a topologia). Manter ou remover em Configure > Repository access.
- [ ] **Verificar com qual usuário a app CRIECOMIA conecta no Postgres 16.** Se for
      `postgres` (superusuário), trocar por usuário restrito.
- [ ] **Fixar por digest** as imagens do sensor (`cowrie/cowrie`, `thinkst/opencanary`).
- [ ] **MFA no Cloudflare Access** da aplicação `estudo` (aba MFA), se disponível na conta.

## Armazenamento externo (OneDrive) — ver docs/ARMAZENAMENTO.md

- [ ] Gerar o par de chaves RSA e guardar a **privada + senha fora do lab e fora da conta
      OneDrive dos backups** (pelo menos dois lugares).
- [ ] Registrar o app `SegInfo Storage` no Microsoft Entra (contas pessoais) e definir as
      variáveis no Coolify.
- [ ] Gerar a migration das tabelas `ArmazenamentoConta` e `BackupRegistro`.
- [ ] Conectar o OneDrive, rodar o primeiro backup e **testar a restauração** com a ferramenta.
- [ ] Anotar a data de expiração do `MS_CLIENT_SECRET` e renovar antes (senão o backup para).
- [ ] Ensaiar a restauração completa em banco descartável com `apps/api/src/tools/restore-backup.ts` e conferir contagens; `POST /api/import` continua sendo somente uma mesclagem das coleções locais.
- [ ] Upload em sessão para backups acima de 240 MB.
- [ ] **As telas ainda guardam no localStorage, então não entram no backup.** Migrar as telas
      para o PostgreSQL é o que faz o objetivo "nada só local" se cumprir de verdade.
- [ ] Conferir em produção que `PUBLIC_BASE_URL` corresponde à origem web publicada; as
      rotas de escrita agora exigem `Origin` correspondente em produção.

## Radar de Ataques

- [ ] Criar o Service Token `seginfo-sensor` e a aplicação Access `estudo-ingest`.
- [ ] Definir no Coolify: `INGEST_TOKEN`, `INGEST_OWNER_EMAIL`, `CF_ACCESS_INGEST_CLIENT_ID`,
      `CF_ACCESS_INGEST_AUD`; redeploy.
- [ ] Testar a ingestão com o `curl` do `docs/RADAR.md` (esperado: `inseridos: 1`).
- [ ] Subir a VM do sensor (DMZ isolada) e o port-forward só para ela.
- [ ] Validar o parser do FortiGate com 2 ou 3 linhas reais de log.
- [ ] Script do Windows (`windows/Send-LogonFailures.ps1`): só nos servidores com autorização.
- [ ] Enriquecimento GeoIP (hoje o campo país só aparece se o coletor enviar).
- [ ] Decidir se liga `RADAR_GUARDAR_SENHAS` (hoje desligado).

## Produto

- [ ] Aplicar a migration `20261110030000_sessao_lab` no PostgreSQL hospedado antes de
      usar `labId` via API. O cliente web ainda persiste sessões localmente.
- [ ] **Migrar as telas do localStorage para a API/PostgreSQL**, módulo a módulo, com
      `tsc` a cada passo. Ordem sugerida: Biblioteca, Arsenal, Sessões e Metas, Posts,
      Progresso e Tópicos, Cofre por último. Hoje Radar e Segundo Cérebro usam o servidor;
      a maioria das telas de estudo continua local.
- [ ] Mover dados já cadastrados no `localhost` para o domínio novo (Cofre > Exportar
      backup, depois Restaurar), enquanto as telas ainda usam localStorage.
- [ ] Embarcar o print "Ecossistema Python para Hackers Éticos" como tópico "Python para
      Segurança" (Scapy, Impacket, pwntools, Volatility 3, YARA, pefile, Bandit etc.).
- [ ] Colar o HTML completo do relatório de pentest do `gestao-ad` como artefato da skill
      `pentest-api` no Arsenal (hoje é placeholder).
- [ ] Biblioteca: limpar o resumo quando o título vaza para o corpo (`extract.ts`);
      resumo por IA (Opção C) se você topar o custo da chave de API.
- [ ] Itens ainda parciais de `docs/SUGESTOES.md`: auditoria completa de acessibilidade,
      uniformidade dos filtros, recomendação baseada em revisão vencida, vínculo de evidência
      em labs e cobertura de testes da UI/autotrava do Cofre. O estado detalhado de cada item
      está no quadro de execução da própria página.

## Do seu ambiente (de notas anteriores)

- [ ] FortiGate FG-LAB: substituir a policy 50 (all/all) por três policies de gerência
      escopadas; decidir sobre as policies 24, 11, 19, 22 e 23; acesso total das VLANs 60/70.
- [ ] Trocar as senhas `changeme*` da stack de observabilidade (CT102) e mover o
      `criecomia-credenciais.md` em texto puro para o Cofre ou gerenciador de senhas.
- [ ] Coolify: `RUN_SEED=false`; websocket do terminal.
- [ ] WARP: atualizar o Tunnel CIDR para `192.168.50.125/32`, se ainda não foi feito.
- [ ] Cluster Proxmox: QDevice ou tiebreaker de quorum; NFS soft mount do NAS; limpar a
      VM 101 órfã e o resource LINSTOR `pm-ef6857c4`.
- [ ] Zabbix: agent 2 nos hosts e datasources do Grafana.

## Ideias do texto de incrementos (2026-11-10)

- [ ] **Item 3, RAG: chatbot que responde com base nos seus documentos, citando as fontes.**
      Prioridade escolhida por você. Depende da conexão com o OneDrive (seção "Armazenamento
      externo"). Fases e decisões em aberto: ver a conversa de 2026-11-10 (stack, provedor de
      LLM/embeddings, política para material corporativo).
      **Plano em fases (2026-11-10):** F1 documentos no OneDrive + ingestão + busca BM25 com
      fontes + classificação pessoal/corporativo + exclusão agendada (carência de 7 dias);
      F2 servidor MCP (`POST /mcp`) somente leitura, tokens com perfil de ferramentas, o
      Claude do usuário gera as respostas (SegInfo sem chave de LLM); F3 embeddings e busca
      híbrida, com Postgres dedicado usando a imagem pgvector (resolve também o risco do banco
      viver no container da CRIECOMIA). Atenção: conteúdo capturado da web devolvido ao
      assistente é canal de prompt injection indireta; marcar como dado não confiável.
      **Andamento F1 (2026-11-10):** feito no código (falta validar): memórias com CRUD, busca
      BM25 por trechos com fonte, captura de URL, importação de notas .md/.txt, exclusão
      agendada com resgate, escopo corporativo fora do backup. Migration da tabela `Memoria` gravada
      (`20261110020000_memoria`). Falta: documentos (PDF/Word) vindos do OneDrive e conversor de arquivos; restauração das
      memórias pessoais a partir do backup com a ferramenta offline; o ensaio ainda está pendente.
- [ ] Criar ambiente de DEV separado do de produção na SegInfo, antes de guardar material mais sensível.
- [ ] Item 1, "segundo cérebro com IA" (Claude para desktop modo Cowork + Obsidian): pasta de
      contexto indexada e aberta como vault no Obsidian. Fica para depois do item 3.
- [ ] Item 2, assistente pessoal com agente (OpenClaw/NanoClaw em WhatsApp/Telegram/Gmail).
      Cuidado ao implantar: um agente com acesso a mensagens e e-mail é alvo de prompt
      injection; isolar, dar permissões mínimas e não ligar a contas corporativas.
- [ ] Item 4, IA local offline (Ollama + Open WebUI): sem prioridade por ora. Pode virar o
      provedor local de embeddings/respostas do item 3 (Fase 2) se o hardware permitir.

## Agents (ver docs/AGENTS.md)
- [x] Playground/execução de agentes (`agenteRuntime.ts`, só ferramentas de leitura; limites de 8 chamadas e 40 mil tokens de saída)
- [ ] Migration `20261113000000_agente_execucao` roda no próximo deploy (aditiva)
- [x] Testar o playground no ambiente publicado (funcionou em 13/11/2026)
- [x] Fase 2: ferramentas de leitura do Proxmox (funcionou contra o Proxmox real em 13/11/2026)
- [ ] Definir `PROXMOX_URL`, `PROXMOX_TOKEN` e `PROXMOX_CA_B64` no Coolify e testar o agente "Operador do Proxmox" contra o Proxmox real
- [x] Fase 3: tela de aprovação e escrita no Proxmox (energia e snapshots; fluxo testado com simulações)
- [ ] Testar a fase 3 contra o Proxmox real com o agente "Operador do Proxmox (com ações)", começando por criar e apagar um snapshot numa VM de teste
- [ ] Migration `20261113010000_agente_execucao_pendencia` roda no próximo deploy (aditiva)
- [ ] Trocar `PROXMOX_TLS_INSEGURO=true` por verificação do certificado (CA ou impressão digital), agora que o token faz escrita
- [ ] Ferramentas de criar, clonar e apagar VM
- [ ] Fase 4: FortiGate (API REST) e Catalyst 2960 (SSH)
- [ ] Incluir `AgenteExecucao` no backup
- [ ] Restaurar `agentes` e `agenteAvaliacoes` no `restore-backup.ts` (hoje só exporta)
- [ ] Migration `20261112000000_agentes` roda no próximo deploy (aditiva)
- [ ] RAG com embeddings (pgvector) para a base de conhecimento
