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

---

# Revisão de 09/11/2026 — o que já foi feito e novas sugestões

## Situação das sugestões 1–16

| # | Sugestão | Situação |
| --- | --- | --- |
| 1 | Backup e restauração | **Feito** — `services/backup.ts` + card no Cofre (substituir/mesclar). |
| 2 | Trava automática do Cofre | **Feito** — inatividade configurável, trava ao ocultar a aba, botão "Travar agora". |
| 3 | Validar e versionar dados locais | **Parcial** — JSON corrompido gera aviso no Painel, mas os registros ainda não são validados com os schemas Zod nem têm versão de formato. |
| 10 | Filtros consistentes | **Parcial** — Tópicos e Inventário seguem o padrão; Labs tem filtro simples, sem busca. |
| demais | — | Pendentes. |

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
21. **Controle de versão.** O projeto não está em um repositório git. Com o
    OneDrive sincronizando, um arquivo sobrescrito por engano não tem histórico
    confiável. Criar um repositório git **privado**, com `.gitignore` que bloqueie
    os arquivos `seginfo-backup-*.json`.

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
35. **Dividir o bundle por tela.** O build gera um JS de 878 KB. Carregar cada
    rota sob demanda (`lazy()`) reduz o tempo de abertura, principalmente no celular.
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
