# Sugestões para o SegInfo Study

Este documento reúne melhorias que podem evoluir a aplicação sem perder o foco de
segundo cérebro de estudos em Segurança da Informação. As sugestões foram escritas
a partir da estrutura atual: React/Vite, persistência em `localStorage` e módulos
de trilhas, tópicos, inventário, labs, sessões, metas, posts e cofre.

## Prioridade alta — proteger e preservar os dados

1. **Criar backup e restauração dos dados do estudo.** Exportar e importar os dados
   do `localStorage` em JSON, com validação do formato e confirmação antes de
   substituir informações. O cofre já possui exportação do blob cifrado; a função
   de backup geral deve manter esse blob cifrado e nunca exportar segredos em texto
   puro. Isso reduz o risco de perda quando o navegador ou o perfil do usuário muda.
2. **Adicionar trava automática ao Cofre.** Permitir configurar um período de
   inatividade e travar o cofre quando ele expirar ou quando a aba for encerrada.
   Oferecer também um botão de trava sempre visível enquanto o cofre estiver aberto.
3. **Validar e versionar os dados locais.** Validar os registros ao ler e importar
   dados, e guardar uma versão do formato. Assim, mudanças futuras no modelo podem
   migrar dados antigos sem falhas silenciosas. Hoje `read()` retorna o valor
   padrão quando o JSON não pode ser lido, o que pode esconder uma corrupção.
4. **Facilitar a troca de dispositivo.** Documentar claramente que o MVP guarda
   dados apenas no navegador e oferecer um fluxo de backup/restauração simples.
   Sincronização com conta e API pode ser uma etapa futura, após definir autenticação,
   backup no servidor e proteção dos dados do Cofre.

## Prioridade média — transformar estudo em rotina

5. **Planejar a próxima sessão.** No Painel, mostrar uma recomendação curta, como
   revisar um tópico atrasado ou continuar uma trilha com baixo progresso. A
   recomendação pode usar metas e registros existentes, sem depender de IA.
6. **Relacionar sessões a tópicos e labs.** Ao registrar tempo, permitir escolher
   o tópico ou laboratório estudado e incluir uma nota breve. Isso conecta horas
   investidas ao progresso real e ajuda a identificar conteúdos que exigem revisão.
7. **Adicionar revisão espaçada.** Permitir marcar tópicos para revisão e sugerir
   datas de retorno após o estudo. Começar com intervalos simples e ajustáveis,
   sem apresentar o cálculo como avaliação de domínio.
8. **Mostrar consistência sem incentivar excesso.** Exibir dias ativos na semana e
   tempo por semana, com metas configuráveis e mensagens neutras quando houver
   pausas. O objetivo é ajudar a planejar, não premiar horas estudadas a qualquer
   custo.
9. **Acompanhar labs com evidências seguras.** Registrar status, data, aprendizado
   e evidência não sensível (por exemplo, uma nota ou caminho de arquivo). Exibir
   um lembrete para não registrar credenciais, tokens ou dados corporativos.

## Prioridade média — melhorar navegação e utilidade

10. **Filtros e busca consistentes.** Aplicar busca, filtros ativos e estados de
    carregamento, vazio e erro às listas de tópicos, inventário e labs. O padrão já
    está descrito em `docs/PATTERNS.md` e pode orientar a implementação das telas.
11. **Ações rápidas no Painel.** Oferecer atalhos para iniciar uma sessão, abrir a
    próxima meta ou retomar o último tópico. Isso reduz o caminho entre abrir a
    aplicação e começar a estudar.
12. **Busca global.** Pesquisar títulos de tópicos, trilhas, metas e labs em um
    único campo, com resultados que levam diretamente ao módulo correspondente.
13. **Melhorar acessibilidade e telas pequenas.** Verificar navegação por teclado,
    rótulos de campos e ícones, contraste de cores e comportamento do menu lateral
    em celular. Manter estado ativo e foco visíveis.

## Prioridade futura — amadurecer a plataforma

14. **Revisar documentação e implementação em conjunto.** A documentação cita
    convenções como paginação lazy, uso de `react-query` em todas as leituras e
    componentes compartilhados que ainda não aparecem em todas as telas. Manter
    essas páginas alinhadas ao código ajuda a evitar expectativas incorretas.
15. **Preparar testes para fluxos críticos.** Quando a estrutura de testes for
    adotada, começar por persistência local, cálculo de progresso, registro de
    sessão, importação/exportação e criação, desbloqueio e trava do Cofre.
16. **Definir limites para integração com o ambiente real.** Ao ampliar o
    inventário do homelab CRIECOMIA, manter dados mínimos e não sensíveis e evitar
    armazenar configurações que revelem segredos ou facilitem acesso indevido.
    *(Decisão de 09/11/2026: o inventário guarda só o homelab — nada da Alvoar.)*

## Sequência sugerida

1. Backup/restauração validada dos dados locais.
2. Trava automática e ação rápida para o Cofre.
3. Vínculo entre sessões, tópicos e labs.
4. Próxima ação recomendada no Painel e atalhos rápidos.
5. Alinhar as convenções da documentação com as telas existentes.

Essa sequência prioriza evitar perda de dados e reduzir riscos antes de ampliar as
funcionalidades de estudo.

## Atualização de 10/11/2026

- A importação local → API valida os registros e reaproveita seus IDs. Repeti-la
  atualiza as coleções correspondentes, em vez de criar novas sessões, metas, posts,
  itens do Arsenal ou da Biblioteca. Isso não remove cópias criadas por importações
  antigas.
- As rotas de escrita da API exigem a origem publicada em produção. Os campos de
  atualização de posts e da Biblioteca também passaram a ter validação explícita.
- O backup local avisa que o inventário contém topologia real em texto legível.
- A busca atual do Segundo Cérebro já usa BM25 e retorna trechos com a fonte. A
  busca híbrida, embeddings, respostas por LLM e ingestão do OneDrive seguem como
  etapas futuras, descritas em `docs/PENDENCIAS.md`.
- O layout ganhou navegação móvel, foco visível, filtros operáveis por teclado e
  atalhos de próxima ação no Painel.
- As telas agora são carregadas sob demanda. No build atual, o arquivo principal caiu
  de aproximadamente 999 KB para 400 KB (126 KB gzip); os módulos maiores viraram
  arquivos separados.
- O diretório tem repositório Git local, e o `.gitignore` bloqueia backups e a chave
  privada de restauração. O remoto `danielarruda07/seginfo-study` foi conferido em
  10/11/2026 e está como privado.

Ainda depende de operação no ambiente hospedado: conexão com OneDrive, backup real,
e ensaio do novo script de restauração em banco descartável. Não rodei esse ensaio
porque não tenho o arquivo `.sgb`, a chave privada nem um banco PostgreSQL de teste.

---

# Revisão de 09/11/2026 — o que já foi feito e novas sugestões

## Situação atual das sugestões 1–37 (10/11/2026)

| # | Situação atual |
| --- | --- |
| 1 | **Implementado no app**: backup local validado, mesclagem/substituição e rollback best-effort. Ensaio integral do backup externo ainda pendente. |
| 2 | **Implementado**: timeout configurável, trava ao ocultar e ação manual. |
| 3, 33 | **Implementado no cliente**: schemas Zod registrados para coleções locais, versão local e validação de backup antes de importar; dados inválidos são preservados para recuperação. |
| 4 | **Parcial**: fluxo e instruções de backup/restauração existem; sincronização de conta não existe. |
| 5, 11 | **Implementado parcialmente**: próximo tópico/meta e atalho de sessão no Painel; ainda não escolhe recomendação com base em revisão vencida. |
| 6 | **Implementado localmente**: sessões aceitam tópico, lab e nota; não sincroniza esses novos campos com a API. |
| 7 | **Implementado**: agenda local de revisão com intervalos de 1/3/7/14/30 dias. |
| 8, 30 | **Implementado**: dias ativos, meta semanal configurável, horas por semana e por trilha. |
| 9, 27 | **Implementado**: status, data, aprendizado, evidência em nota/caminho local, MITRE e tópico relacionado nos labs; a UI lembra para não incluir credenciais ou dados corporativos. |
| 10 | **Parcial**: busca/filtros existem nas listas principais; os controles e estados não são totalmente uniformes. |
| 12 | **Implementado**: busca global (Ctrl+K) de tópicos, trilhas, metas e labs. |
| 13, 34 | **Implementado parcialmente**: menu móvel, foco e teclado nos controles interativos revisados; falta auditoria completa de contraste, rótulos e leitores de tela. |
| 14, 32 | **Atualizado parcialmente**: arquitetura e componentes planejados são identificados; ainda pode haver documentação histórica a reconciliar. |
| 15, 37 | **Parcial**: Vitest configurado; testes atuais cobrem storage, validação/restauração, agenda de revisão, progresso e cifragem. Faltam testes de UI, autotrava e fluxos completos do Cofre. |
| 16, 17 | **Parcial**: seed e labs agora usam dados demonstrativos, sem endereços/domínios reais. O `localStorage` e backups antigos foram preservados; revise-os manualmente e confirme que o remoto Git é privado antes de publicar. |
| 18 | **Resolvido**: dados da Alvoar removidos. |
| 19 | **Implementado**: revisão de riscos antes de copiar texto para publicação. |
| 20 | **Implementado**: senha-mestra de 12+, medidor, tentativa de limpeza da área de transferência, espera progressiva no desbloqueio e vínculo opcional entre credencial e ativo. |
| 21 | **Resolvido**: Git local, exclusões de backup configuradas e remoto `danielarruda07/seginfo-study` confirmado como privado em 10/11/2026. |
| 22 | **Resolvido**: datas usam o calendário local. |
| 23, 24 | **Implementado**: CRUD de ativos, schemas e ação explícita para incorporar novidades do seed sem sobrescrever edições. |
| 25 | **Parcial**: catálogo ampliado para OSINT, labs e domínios de certificação; requer seleção e curadoria contínua do conteúdo. |
| 26 | **Implementado como guia inicial**: Security+ SY0-701 com domínios e pesos publicados, ligado a progresso de tópicos. Não representa prontidão para aprovação; conferir a versão do edital antes de marcar prova. |
| 28 | **Implementado**: lab concluído pode gerar rascunho para LinkedIn; cópia passa pela revisão de segurança. |
| 29 | **Implementado**: página de portfólio imprimível/Salvar PDF sem dados do inventário. |
| 31 | **Implementado**: rascunhos editáveis e associáveis a tópico. |
| 35 | **Implementado**: carregamento de rotas sob demanda. |
| 36 | **Pendente no sistema operacional**: excluir `node_modules` da sincronização do OneDrive exige alterar a configuração/mover a pasta fora do workspace. |

## Dependências externas ainda abertas

- Anonimização do seed real (aguardando decisão do usuário), verificação do remoto Git e configuração OneDrive/backup real.
- Ensaio do script de restauração em PostgreSQL descartável com `.sgb` e chave privada reais.
- Migração das telas locais para API/PostgreSQL e validação de produção; a maioria das telas continua local.
- Configuração de `node_modules` fora da sincronização OneDrive e demais tarefas de infraestrutura em `docs/PENDENCIAS.md`.

## Prioridade alta — segurança dos seus próprios dados

17. **Tratar o inventário como dado sensível.** O seed em `data/inventario.ts`
    contém o IP público real do homelab, IPs internos, VIPs expostos e uma lista de fraquezas conhecidas ("RDP exposto", "policy all/ALL",
    "senhas changeme"). Para um atacante, isso é um relatório de reconhecimento
    pronto. Hoje ele fica em texto puro no código-fonte, no `localStorage`, no
    arquivo de backup e sincronizado pelo OneDrive. Sugestões:
    - tirar o seed real do código e deixar só um exemplo fictício (o inventário
      real entra pela tela ou pelo backup);
    - opcionalmente, guardar os campos de risco/`detalhes` dentro do Cofre cifrado;
    - avisar no card de Backup que o arquivo contém a topologia real;
    - nunca publicar o código com esse seed (nem como portfólio).
18. ~~Cuidado com os dados da Alvoar~~ — **resolvido**: os ativos corporativos
    foram removidos do inventário; o app guarda só o homelab.
19. **"Revisão de segurança" antes de copiar um post.** Os modelos de LinkedIn
    ligam sua infra real à segurança, o que facilita vazar detalhes sem querer.
    Antes de copiar, detectar no texto IPs, domínios internos, nomes de ativos do
    inventário e termos como "senha", "vulnerável", "exposto", e mostrar um aviso.
20. **Endurecer o Cofre.**
    - limpar a área de transferência ~30 s depois de copiar um segredo;
    - exigir senha-mestra mais forte que 8 caracteres (ex.: 12+ ou frase-senha),
      com medidor;
    - atrasar progressivamente após tentativas erradas de desbloqueio;
    - usar os campos `ambiente` e `ativoId` que já existem em `VaultEntry` para
      ligar a credencial ao ativo — o detalhe do ativo mostraria "há credencial no
      Cofre" sem revelar nada.
21. **Controle de versão.** O projeto já está em um repositório Git local. Com o
    OneDrive sincronizando, confirme que qualquer remoto está privado antes de enviar
    o código, pois o inventário contém topologia real. O `.gitignore` bloqueia agora
    arquivos `seginfo-backup-*.json`, `.sgb` e a chave privada padrão.

## Prioridade alta — correções rápidas

22. **Data de "hoje" errada à noite.** `todayISO()` usa `toISOString()`, que é
    UTC. No Brasil (UTC−3), depois das 21h a data vira o dia seguinte: uma sessão
    registrada às 22h fica com a data de amanhã e o "dias restantes" das metas se
    desloca. Usar a data local.
23. **O inventário diz "editável na UI", mas não é.** `saveAtivo`/`removeAtivo`
    existem em `services/inventario.ts`, mas nenhuma tela os usa. Adicionar
    criar/editar/excluir ativo no Drawer (`react-hook-form` + `AtivoSchema`).
24. **O seed nunca se atualiza.** Na primeira execução o inventário é copiado para
    o `localStorage` e o código passa a ser ignorado; melhorias no seed não chegam
    a quem já usa o app. Guardar a versão do seed e oferecer "incorporar
    novidades" (complementa a sugestão 3).

## Prioridade média — estudo e carreira

25. **Ampliar o catálogo.** São 23 tópicos para 11 trilhas; OSINT, Labs e
    Certificações têm só 1 cada. Priorizar a certificação-alvo, OSINT e tópicos
    que espelhem os labs já existentes (AD, Wazuh, segmentação).
26. **Trilha de certificação guiada pelo edital.** Para a certificação-alvo
    (ex.: Security+ SY0-701), cadastrar os domínios oficiais com o peso de cada
    um, ligar tópicos a eles e mostrar a "cobertura do edital" no Painel. Isso
    transforma progresso genérico em prontidão para a prova.
27. **Labs com status, evidência e MITRE ATT&CK.** Os labs não têm status
    (não iniciado / em andamento / concluído) nem registro do que foi aprendido.
    Adicionar status, data, notas e técnicas ATT&CK praticadas (ex.: T1110 —
    brute force, no lab de RDP). O campo `topicoId` do lab já existe e não aparece
    na tela: exibir e linkar o tópico relacionado.
28. **Lab concluído → rascunho de post.** Ao concluir um lab, gerar um rascunho
    no módulo LinkedIn com objetivo, o que foi feito e o resultado, já passando
    pela revisão da sugestão 19. Fecha o ciclo estudar → praticar → divulgar.
29. **Portfólio exportável.** Uma página (ou PDF) com trilhas concluídas, labs
    feitos e certificações, **sem** dados do inventário, para anexar ao
    LinkedIn/currículo.
30. **Gráficos no Painel.** O `chart.js` já está instalado e não é usado. Horas
    por semana (últimas 8–12 semanas) e horas por trilha respondem "estou mantendo
    o ritmo?" melhor que o total acumulado.
31. **Editar rascunhos de post.** Hoje um post salvo só pode ser copiado, marcado
    como publicado ou excluído. Permitir reabrir no editor e ligar a um tópico
    (`topicoId` já existe em `PostIdea`).

## Prioridade futura — qualidade técnica

32. **Alinhar a documentação** (detalha a 14). `STACK.md` cita `apps/api`,
    `@xyflow/react`, `leaflet` e `@xterm/xterm`, que não existem no projeto;
    `PATTERNS.md` cita `DataTableWrapper` e `FormField`, que ainda não foram
    criados. Marcar como "planejado" ou remover.
33. **Validar com Zod ao ler e importar.** Os schemas de `packages/shared` não são
    usados em tempo de execução. Aplicar `safeParse` na leitura de cada chave e na
    restauração do backup (concretiza a sugestão 3).
34. **Acessibilidade de teclado.** `Chip` (`<span onClick>`) e os cards de
    Trilhas/Labs (`<div onClick>`) não recebem foco nem respondem a Enter. Usar
    `<button>` ou `role="button"` + `tabIndex`, como já é feito no `Kpi`.
35. ~~Dividir o bundle por tela~~ — **feito em 10/11/2026** com carregamento sob demanda.
    O bundle inicial caiu para aproximadamente 396 KB (124 KB gzip).
36. **Tirar `node_modules` da sincronização do OneDrive.** Milhares de arquivos
    sincronizando deixam o `npm install` lento e podem corromper pacotes. Mover o
    projeto para fora do OneDrive (com git como backup do código) ou excluir a
    pasta da sincronização.
37. **Testes dos fluxos críticos** (complementa a 15): começar por `crypto.ts`
    (cifrar/decifrar, senha errada), backup/restauração e cálculo de progresso,
    com Vitest, que integra direto com o Vite.

## Sequência sugerida (atualizada)

1. Correções rápidas: data local (22) e git privado (21).
2. Proteger o inventário real do homelab (17).
3. Revisão de segurança dos posts e endurecimento do Cofre (19, 20).
4. Edição do inventário e versão do seed (23, 24).
5. Labs com status e evidência → rascunho de post (27, 28).
6. Trilha da certificação-alvo e gráficos no Painel (26, 30).

---

# Revisão de 10/11/2026 (noite): API, deploy e Segundo Cérebro

Ideias de painéis, assuntos, labs (range vulnerável, Red, Blue e Purple Team) estão em
[`docs/IDEIAS_LAB.md`](IDEIAS_LAB.md).

Esta rodada leu `apps/api`, o Nginx, os Dockerfiles e os serviços do front ligados à
API. Os itens 38 a 41 corrigem defeitos confirmados no código. Os demais propõem
evoluções.

## Prioridade alta: correções confirmadas

38. **O filtro anti-SSRF do extrator deixa passar alvos internos.** `isBlockedHost()` em
    `apps/api/src/extract.ts` compara só o texto do hostname e não verifica o IP para o
    qual o nome resolve. Conferido com o parser de URL do Node:
    - `new URL('http://[::1]/').hostname` é `[::1]`, com colchetes. Por isso as checagens
      `=== '::1'`, `startsWith('fc'|'fd'|'fe80')` nunca casam, e `[::ffff:7f00:1]`
      (127.0.0.1 em IPv6) passa;
    - nomes de container sem ponto passam, como `http://seginfo-api:3001/` ou o host do
      Postgres. A API está na rede `coolify`, junto com outros serviços do lab;
    - qualquer domínio público que resolva para `10.x`/`192.168.x` também passa. Isso
      inclui serviços de DNS curinga (`10.10.10.99.nip.io`) e DNS rebinding;
    - com `redirect: 'follow'`, os redirecionamentos intermediários já são requisitados
      antes da checagem do host final. Essa checagem impede ler a resposta, mas não
      impede a requisição;
    - falso positivo: `startsWith('fd')` bloqueia domínios legítimos como `fdic.gov`.

    **Correção sugerida:** resolver o nome com `dns.lookup(host, { all: true })` e
    recusar se *qualquer* endereço for privado, loopback, link-local, CGNAT
    (`100.64.0.0/10`), multicast ou IPv4 mapeado em IPv6. Fixar o IP resolvido na
    conexão (`undici` Agent com `connect.lookup`) para impedir rebinding. Seguir
    redirecionamentos manualmente (`redirect: 'manual'`, no máximo 5), validando cada
    salto. Ler o corpo em stream e abortar ao passar de 2 MB, em vez de `arrayBuffer()`
    seguido da checagem de tamanho. Hoje a rota exige login, mas a fase F2 (MCP)
    planeja expor capturas a um assistente, e aí a prompt injection pode disparar
    `capturar-url`. Escrever testes Vitest com a lista de URLs acima.
39. **O botão "Fazer backup agora" pode falhar com 504.** O front espera até 6 min
    (`runBackup`), mas o Nginx corta em `proxy_read_timeout 30s` (`apps/web/nginx.conf`),
    e o Cloudflare Tunnel corta perto de 100 s. Com upload grande, a tela mostra erro
    enquanto o backup segue no servidor. Sugestão: responder `202` com o `id` do
    registro, rodar o backup em segundo plano e consultar o estado via
    `/api/storage/status`, que a tela já carrega. Isso evita mexer em timeouts.
40. **A importação local → API descarta o `labId` das sessões.** Em `POST /api/import`,
    o schema aceita `labId`, mas o objeto `data` gravado só leva
    `data, minutos, trilhaId, topicoId, nota`. Incluir `labId: s.labId`. Ainda em
    `/api/import`, o `progresso` é `z.array(z.any())`: um item sem `topicoId` gera 500.
    Usar o mesmo schema de `ProgressoBody`.
41. **Os cabeçalhos de segurança somem em `/assets/`.** No Nginx, um `add_header` dentro
    de um `location` anula todos os `add_header` herdados do `server`. Os arquivos JS e
    CSS saem sem `nosniff`, `X-Frame-Options` e `Referrer-Policy`. Repetir os cabeçalhos
    no bloco ou usar um `include` comum. Aproveitar para adicionar uma
    **Content-Security-Policy**. O app não carrega scripts de terceiros, então algo como
    `default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`
    deve servir; validar o `style-src` com o PrimeReact. A CSP reduz o estrago de um
    XSS, que é a principal ameaça a um Cofre que decifra os segredos no navegador.

## Prioridade alta: integridade dos dados

42. **O Cofre não detecta conflito de versão.** `PUT /api/cofre` e `/api/import`
    sobrescrevem o blob do servidor sem conferir versão. Quando o Cofre migrar para a
    API, um navegador com cópia antiga, ao importar ou salvar, apaga segredos criados em
    outro dispositivo, e nada avisa. Sugestão: devolver `atualizadoEm` (ou um contador)
    no `GET` e exigir o valor no `PUT` (`If-Match`), respondendo `409` quando divergir.
    Na importação, nunca sobrescrever um cofre do servidor que já existe: pedir
    confirmação explícita na tela.
43. **A retenção só guarda os backups mais recentes.** `aplicarRetencao` mantém só os 14
    mais recentes. Se um dado se corromper ou for apagado por engano e isso só for notado
    15 dias depois, nenhum backup terá a versão boa. Sugestão: retenção avô-pai-filho, com
    7 diários, 4 semanais (o de domingo) e 6 mensais (o do dia 1). Cabe na mesma função,
    olhando a data no nome do arquivo.
44. **Vincular o cabeçalho do `.sgb` à cifra.** Em `cifrarBackup`, o cabeçalho
    (`SGB1` + tamanho) não entra como AAD no AES-GCM. Usar
    `c.setAAD(Buffer.concat([MAGIC, len]))`, criando o formato `SGB2` e mantendo a
    leitura de `SGB1`. O custo é pequeno e protege futuras mudanças de formato.
45. **Lembrete do ensaio de restauração.** O servidor não consegue decifrar os backups
    (isso é intencional), então só um ensaio prova que eles funcionam. Sugestão: guardar
    `ultimoEnsaioRestauracaoEm` e mostrar um aviso na tela Armazenamento depois de 90
    dias sem ensaio. A ferramenta `restore-backup.ts` poderia registrar a data
    automaticamente ao terminar com sucesso.

## Prioridade média: endurecimento da API e do deploy

46. **Rodar a API sem root.** `apps/api/Dockerfile` não define `USER`; a imagem
    `node:22-alpine` já tem o usuário `node`. Adicionar `USER node`, com `chown` do
    `/repo` se preciso. No compose, considerar `read_only: true` com `tmpfs: /tmp`,
    `cap_drop: [ALL]` e `security_opt: [no-new-privileges:true]` nos dois serviços.
47. **IP real nos logs.** Sem `trustProxy`, o `req.ip` que aparece nos avisos de
    ingestão e de token inválido é o IP do Nginx. Configurar
    `Fastify({ trustProxy: ... })` com o IP da rede do compose. Para o IP do visitante
    atrás do Cloudflare, usar o header `CF-Connecting-IP`. Assim os próprios logs da API
    alimentam o Radar.
48. **Limite de requisições por usuário.** O Access protege a borda, mas as rotas
    `/api/extract`, `capturar-url` e `/api/ingest` fazem trabalho caro (fetch externo,
    escrita em lote). Usar `@fastify/rate-limit` com limites baixos nessas rotas, por
    exemplo 30 capturas por minuto. A intenção é conter um script com defeito ou um
    coletor em loop.
49. **Healthcheck que testa o banco.** O `/health` responde `ok` mesmo com o PostgreSQL
    fora, e o front usa esse resultado para escolher o modo servidor. Criar
    `/api/health/ready` com `SELECT 1` (protegido ou sem detalhes) para o healthcheck do
    container e para o aviso de "servidor indisponível" na tela.
50. **Quem pode virar usuário.** `resolveUsuario` cria um usuário para *qualquer* e-mail
    aceito pelo Access. Se a política do Access um dia incluir um grupo ou domínio, cada
    pessoa ganha uma conta vazia sem aviso. Sugestão: variável `ALLOWED_EMAILS` (lista) e
    recusa com 403 fora dela. É uma segunda camada caso alguém mude a política do Access.
51. **CI mínima no GitHub.** O repositório não tem workflow. Um job com
    `npm ci && npm run typecheck && npm test` para web e API, mais o `npm audit --omit=dev`
    e o Dependabot, pega regressões antes do deploy no Coolify. As imagens base
    (`node:22-alpine`, `nginx:1.27-alpine`) também podem ser fixadas por digest, como já
    está previsto para o sensor.

## Prioridade média: produto

52. **Segundo Cérebro: ligar memórias ao resto do app.** As memórias ainda não se ligam
    aos tópicos, labs e itens da Biblioteca. Um campo opcional `topicoId`/`labId` e um
    bloco "Notas relacionadas" no detalhe do tópico e do lab tornariam a busca BM25 útil
    durante o estudo, e não só na tela Cérebro. A Biblioteca e o Cérebro também se
    sobrepõem, já que os dois capturam URLs. Avaliar unificar o fluxo: "salvar na
    Biblioteca" cria também uma memória pesquisável.
53. **Busca: tolerância a variações.** O stemming atual só tira o `s` final. Um stemmer
    leve de português (RSLP simplificado) e a busca por prefixo no último termo digitado
    (`firewa` encontra `firewall`) melhoram bastante a busca enquanto os embeddings (F3)
    não chegam.
54. **Radar → estudo.** O Radar já mapeia técnicas MITRE. Cada técnica observada pode
    sugerir o tópico ou lab relacionado ("T1110 apareceu 3.200 vezes nesta semana →
    lab Hardening de RDP"). Isso fecha o ciclo observar → estudar → praticar e alimenta
    a "próxima ação" do Painel (item 5).
55. **Revisão espaçada nas memórias.** Reaproveitar a agenda de 1/3/7/14/30 dias dos
    tópicos para memórias marcadas como "para fixar", com um cartão diário no Painel.

## Sequência sugerida para esta rodada

1. Corrigir o SSRF (38) com testes; é a única falha explorável a partir de um dado
   externo.
2. Correções rápidas: `labId` na importação (40), cabeçalhos e CSP no Nginx (41).
3. Backup assíncrono (39) e retenção avô-pai-filho (43), antes de ativar
   `BACKUP_AUTOMATICO`.
4. Controle de versão do Cofre (42), antes de migrar o Cofre para a API.
5. `USER node`, `trustProxy`, rate limit e CI (46 a 51).
