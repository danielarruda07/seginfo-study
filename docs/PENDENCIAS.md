# Pendências

Lista viva do que ficou combinado e ainda não foi feito. Marque `[x]` ao concluir.
Última atualização: 2026-11-09.

## Segurança (prioridade)

- [ ] **Tirar o RDP real da WAN.** O VIP `10.10.10.100:1401` publicado no IP público é o
      alvo do brute force. Acessar pelo `rdp.criecom.ia.br` (Cloudflare Access). Conferir nos
      logs do FortiGate se há tentativas contra a porta 1401. Relacionado ao lab
      "Hardening do FortiGate".
- [ ] **Rotacionar a senha do banco `seginfo_app`.** A senha atual apareceu no chat.
      No `psql` do container: `\password seginfo_app`, depois atualizar o Secret
      `DATABASE_URL` no Coolify e fazer redeploy.
- [ ] **Backup do banco `seginfo_study`.** Ele vive dentro do container Postgres 16 da
      CRIECOMIA. Se o recurso for recriado no Coolify, o banco some. Configurar backup agendado.
- [ ] **Conferir o arquivo `t resolve 1 no alpine)` na raiz do projeto.** Parece resíduo de
      comando colado; ver o conteúdo e apagar. Não incluir no commit.
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
- [ ] Restauração completa: hoje `POST /api/import` não restaura `ataques` e duplica dados.
- [ ] Upload em sessão para backups acima de 240 MB.
- [ ] **As telas ainda guardam no localStorage, então não entram no backup.** Migrar as telas
      para o PostgreSQL é o que faz o objetivo "nada só local" se cumprir de verdade.
- [ ] Proteção CSRF (checagem de `Origin`) nas demais rotas que alteram dados; hoje só as de
      armazenamento têm.

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

- [ ] **Migrar as telas do localStorage para a API/PostgreSQL**, módulo a módulo, com
      `tsc` a cada passo. Ordem sugerida: Biblioteca, Arsenal, Sessões e Metas, Posts,
      Progresso e Tópicos, Cofre por último. Hoje só o Radar lê do servidor.
- [ ] Mover dados já cadastrados no `localhost` para o domínio novo (Cofre > Exportar
      backup, depois Restaurar), enquanto as telas ainda usam localStorage.
- [ ] Embarcar o print "Ecossistema Python para Hackers Éticos" como tópico "Python para
      Segurança" (Scapy, Impacket, pwntools, Volatility 3, YARA, pefile, Bandit etc.).
- [ ] Colar o HTML completo do relatório de pentest do `gestao-ad` como artefato da skill
      `pentest-api` no Arsenal (hoje é placeholder).
- [ ] Biblioteca: limpar o resumo quando o título vaza para o corpo (`extract.ts`);
      resumo por IA (Opção C) se você topar o custo da chave de API.
- [ ] Itens 5 a 16 do `docs/SUGESTOES.md` (próxima sessão, revisão espaçada, busca global,
      acessibilidade, testes dos fluxos críticos).

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
