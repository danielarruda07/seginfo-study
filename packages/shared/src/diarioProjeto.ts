/**
 * Diário de construção da SegInfo Study — matéria-prima para o post (ou série)
 * sobre o projeto no LinkedIn.
 *
 * COMO MANTER: a cada mudança relevante no app, acrescente uma entrada no topo da
 * lista (quem estiver desenvolvendo — você ou um assistente de IA). Entradas criadas
 * pela tela ficam no navegador e se somam a estas.
 *
 * REGRA: escreva como se fosse público. Nada de IPs, hostnames, domínios internos,
 * credenciais ou fraquezas ainda abertas — conte a lição, não o mapa do ambiente.
 */

export type CategoriaDiario = 'funcionalidade' | 'seguranca' | 'infra' | 'decisao' | 'aprendizado' | 'plano';

export interface EntradaDiario {
  id: string;
  /** YYYY-MM-DD */
  data: string;
  titulo: string;
  descricao: string;
  categoria: CategoriaDiario;
  tags: string[];
  /** projeto do LinkedIn a que o marco pertence (só marcos criados pela tela) */
  projetoId?: string | null;
}

export const DIARIO_PROJETO: EntradaDiario[] = [
  {
    id: 'proj-2026-11-27-ajuda',
    data: '2026-11-27',
    titulo: 'Ajuda e guia de uso: ferramenta boa que ninguem sabe usar nao serve',
    descricao:
      'Depois de uma leva grande de entregas (scanner, testes ativos, JWT, reposcan, revisao com IA), o Daniel ' +
      'disse que nao sabia como usar tudo. Virou uma tela de Ajuda com roteiros de teste por cenario e, em cada ' +
      'ferramenta, um selo honesto de quanto de IA ela usa. Licao: deixar claro o que e deterministico e o que e ' +
      'raciocinio de modelo muda o que voce promete ao cliente no laudo.',
    categoria: 'decisao',
    tags: ['ux', 'documentacao', 'ia', 'pentest'],
  },
  {
    id: 'proj-2026-11-27-revisao-codigo-ia',
    data: '2026-11-27',
    titulo: 'Revisao de codigo com IA: plugin oficial claude-security embarcado via worker',
    descricao:
      'O scanner de padroes achou 1 vulnerabilidade num repo onde um pentest humano achou 9 — as falhas ' +
      'reais eram de autenticacao, autorizacao e logica, que regex nao enxerga. O Daniel pediu a analise ' +
      'profunda dentro do app usando o plugin oficial claude-security. Como o plugin so roda no Claude Code ' +
      'em sandbox Linux, o app enfileira o pedido e um worker na VM do Coolify clona, roda o plugin no ' +
      'sandbox oficial (rede so para o modelo, chave fora) e devolve SARIF e patches. Licao: o ponto ' +
      'sensivel nao era a IA, era o git clone — URL de repositorio pode executar comando (ext::), entao ' +
      'a validacao e a primeira linha de defesa.',
    categoria: 'seguranca',
    tags: ['claude-security', 'sast', 'devsecops', 'worker', 'sandbox'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-27-modo-profissional',
    data: '2026-11-27',
    titulo: 'Modo profissional: estudo ocultado, Central de Seguranca e export HTML/PDF',
    descricao:
      'O Daniel ja usa a plataforma no trabalho de DevSecOps e pediu que ela deixasse de parecer ferramenta ' +
      'de estudo. Ocultei o modulo de Estudo por um interruptor (some do menu, da busca e dos links; URLs ' +
      'redirecionam) sem apagar dados nem codigo, e a pagina inicial virou uma Central de Seguranca. Todo ' +
      'teste agora exporta HTML autocontido e PDF (impressao do navegador), com o gerador no pacote ' +
      'compartilhado para servir tambem o CLI do reposcan. Licao: conteudo do alvo vai parar dentro do ' +
      'relatorio, entao o exportador escapa tudo — um laudo nao pode virar vetor de XSS.',
    categoria: 'funcionalidade',
    tags: ['profissional', 'relatorio', 'html', 'pdf', 'devsecops'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-27-reposcan-fp',
    data: '2026-11-27',
    titulo: 'Reposcan: menos falso positivo (arquivos .example e ${VAR} no compose)',
    descricao:
      'Rodei o proprio reposcan no repo do SegInfo (531 arquivos): 0 vulnerabilidade real — os altos eram ' +
      'fixtures de teste e um prisma.$queryRaw parametrizado; o ruido vinha de arquivos .env.example e de ' +
      'referencias ${VAR} no docker-compose. Ajustei: arquivos de exemplo/template nao disparam as ' +
      'heuristicas genericas de segredo (chave de provedor real ainda dispara), e compose-segredo ignora ' +
      'comentario e ${VAR}. Medios caíram de 90 para 21. Licao: rodar a ferramenta no proprio codigo e o ' +
      'melhor jeito de achar e cortar falso positivo antes de usar em cliente.',
    categoria: 'seguranca',
    tags: ['reposcan', 'devsecops', 'falso-positivo', 'sast'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-27-doc-seguranca',
    data: '2026-11-27',
    titulo: 'Documentacao consolidada das ferramentas de seguranca (docs/SEGURANCA.md)',
    descricao:
      'Reuni num so documento tudo que foi implantado a nivel de seguranca (v0.49-0.57): Scanner de endpoints ' +
      'e seus testes ativos benignos, analisador de JWT offline, gate de CI por HMAC, Reposcan estatico e Caca ' +
      'ao ARTEX — com para-que-serve, como usar e a fronteira (autorizado, nao destrutivo). Respondi tambem se ' +
      'da para varrer repo do GitHub: sim, estatico via reposcan (publico direto, privado com git autenticado), ' +
      'faltando so a checagem de CVE via OSV. Indexei no AGENTS.md. Licao: ferramenta de seguranca sem doc de ' +
      'escopo e fronteira e meio caminho para uso errado.',
    categoria: 'infra',
    tags: ['documentacao', 'devsecops', 'seguranca'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-27-scanner-injecao-jwt',
    data: '2026-11-27',
    titulo: 'Scanner: sinais ativos benignos de SQLi/prompt + analisador de JWT offline',
    descricao:
      'Completa o pedido de testar injecao e JWT, respeitando a fronteira de transacao (so estatico/staging): ' +
      'no Scanner, dois sinais ativos BENIGNOS e opt-in, so em GET de leitura — SQLi por erro (uma aspa simples ' +
      'faz o banco mostrar erro) e canario de prompt injection (instrucao inofensiva ve se o modelo obedece), ' +
      'ambos como a confirmar, sem explorar. E uma caixa que analisa um JWT colado, no proprio navegador, sem ' +
      'rede e sem a chave: aponta alg none, HS simetrico, falta de exp, validade longa, claim sensivel. Licao: ' +
      'da pra dar sinal de injecao sem disparar exploit — a aspa e o canario sao inofensivos, e o resto fica no ' +
      'estatico do reposcan.',
    categoria: 'funcionalidade',
    tags: ['scanner', 'sqli', 'prompt-injection', 'jwt', 'devsecops'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-27-reposcan-injecao',
    data: '2026-11-27',
    titulo: 'Reposcan detecta injecao (SQL/NoSQL/SSTI/cmd/prompt) e fragilidade de JWT',
    descricao:
      'Daniel quer testar injecao (SQLi, prompt injection, etc., principalmente em transacao) e fragilidade ' +
      'de JWT. Como payload ativo em endpoint de transacao e destrutivo, a cobertura entra no lado ESTATICO: ' +
      'o reposcan agora acha SQL montado por concatenacao, req.body direto em consulta NoSQL, SSTI, command ' +
      'injection por linguagem, prompt do LLM montado com entrada do usuario, e JWT fraco (alg none, decode ' +
      'sem verificar, verify=False, segredo embutido). Licao: para transacao, o teste seguro e ler o codigo, ' +
      'nao disparar o ataque — o ativo (benigno, por sinal) fica so em rota de leitura no Scanner.',
    categoria: 'seguranca',
    tags: ['devsecops', 'sast', 'sqli', 'jwt', 'prompt-injection', 'reposcan'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-27-reposcan',
    data: '2026-11-27',
    titulo: 'Analise estatica de repositorio clonado (CLI DevSecOps)',
    descricao:
      'Nova missao do Daniel: clonar repositorios e rodar testes neles localmente. Fiz uma CLI de analise ' +
      'ESTATICA (le arquivos, nunca instala nem roda a suite do repo — isso executaria codigo nao confiavel): ' +
      'segredos, dependencias, Docker/IaC/CI e padroes de codigo perigosos. Roda na maquina do operador sobre ' +
      'a pasta clonada (ou clona raso de uma URL), com saida texto/JSON e codigo de saida para virar gate. ' +
      'Licao: testar repo de terceiro e, por padrao, LER e nao EXECUTAR; manter a fronteira (autorizado, ' +
      'estatico, nada sai para fora).',
    categoria: 'funcionalidade',
    tags: ['devsecops', 'sast', 'reposcan', 'segredos', 'supply-chain'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-27-artex-caca',
    data: '2026-11-27',
    titulo: 'Caca ao ARTEX: deteccao e hunting defensivo mapeado ao ATT&CK',
    descricao:
      'Daniel pediu as tecnicas do ARTEX (framework ofensivo agentico adotado por atacantes). Em vez de ' +
      'embutir o framework, trouxe o lado DEFENSIVO do relatorio de deteccao/hunting: sinais ' +
      'comportamentais por camada (loop do agente, web, identidade, host, nuvem), cada um com dica de caca ' +
      'e tecnicas MITRE, mais marcadores tratados como indicio (UAs/headers/IPs mudam). Consenso das fontes: ' +
      'cacar por comportamento, nao por IOC. Licao: a melhor forma de usar um framework ofensivo e aprender ' +
      'a detecta-lo — vira capacidade defensiva sem o risco de rodar o atacante em casa.',
    categoria: 'seguranca',
    tags: ['artex', 'deteccao', 'hunting', 'attack', 'devsecops'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-27-scanner-ativo',
    data: '2026-11-27',
    titulo: 'Scanner ganha testes ativos seguros (reflexo, open-redirect, autorizacao)',
    descricao:
      'O scanner era so passivo. Daniel pediu testes de ataque; implementei a camada ATIVA mantendo a ' +
      'fronteira: cada teste e uma requisicao GET a mais com um marcador inofensivo, nunca explora. ' +
      'Reflexo (candidato a XSS refletido), open redirect (olha o Location sem seguir) e autorizacao nao ' +
      'forcada (compara com e sem credencial de prova). E opt-in (toggle na tela, flag ativos na API) e os ' +
      'achados saem como a confirmar. Licao: da pra cobrir tecnica ofensiva de verdade sem sair do ' +
      'nao destrutivo — o segredo e sinalizar o candidato, nao disparar o exploit.',
    categoria: 'funcionalidade',
    tags: ['pentest', 'scanner', 'api', 'xss', 'open-redirect', 'devsecops'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-26-scan-ci-borda',
    data: '2026-11-26',
    titulo: 'Gate de CI precisa de duas chaves: borda (Access) e app (HMAC)',
    descricao:
      'Ao testar a rota /api/scan/ci de fora, a resposta foi 302 da Cloudflare: o dominio inteiro esta ' +
      'atras do Access, entao o HMAC nem chegava a ser avaliado. A solucao segue o padrao dos coletores ' +
      'do Radar: um Service Token do Access numa aplicacao restrita ao path api/scan/ci, mais o HMAC no ' +
      'app. O script da CI passou a enviar o token e a explicar o bloqueio de borda, e deixou de depender ' +
      'de jq. Licao: autenticacao no app nao basta quando ha uma camada de borda na frente; testar de fora ' +
      'antes de declarar pronto.',
    categoria: 'seguranca',
    tags: ['scanner', 'cicd', 'cloudflare-access', 'hmac'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-26-scan-ci-env',
    data: '2026-11-26',
    titulo: 'Compose passa o segredo do gate de CI ao container',
    descricao:
      'A rota /api/scan/ci (v0.52.0) le process.env.SCAN_CI_SECRET, mas o docker-compose nao repassava ' +
      'essa variavel ao servico da API, entao ela nunca chegava ao container (ficaria sempre em 503). ' +
      'Adicionei a linha no compose. Falta o Daniel definir o valor no Coolify. Licao: variavel de ' +
      'ambiente nova so vale de ponta a ponta quando o compose a lista explicitamente.',
    categoria: 'infra',
    tags: ['scanner', 'cicd', 'coolify', 'config'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-26-scanner-ci-hmac',
    data: '2026-11-26',
    titulo: 'Scanner vira quality gate: rota HMAC chamavel pela CI/CD',
    descricao:
      'O scanner so rodava no navegador, atras do Access. Para fechar o ciclo de DevSecOps (analise ' +
      'de vulnerabilidade integrada ao pipeline) criei uma rota irma, POST /api/scan/ci, que a esteira ' +
      'chama sem navegador. Como nao ha sessao, a auth e por HMAC-SHA256 sobre o corpo cru com o segredo ' +
      'SCAN_CI_SECRET, com janela anti-replay de 300s e comparacao em tempo constante — mesmo padrao da ' +
      'ingestao de coletores. Ela roda o mesmo motor nao destrutivo e devolve veredito de gate (200 passou, ' +
      '422 reprovou) com limites configuraveis. Acompanha doc e um script pronto. Licao: a fronteira muda ' +
      'com o chamador (operador = Access; maquina = HMAC), mas a regra de ouro continua: passivo, com escopo ' +
      'e segredo, e fail-closed se faltar config.',
    categoria: 'funcionalidade',
    tags: ['pentest', 'scanner', 'devsecops', 'cicd', 'hmac', 'quality-gate'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-26-scanner-ampliado',
    data: '2026-11-26',
    titulo: 'Scanner de endpoints vira teste de API: CORS, tecnologia, OpenAPI, lote e export',
    descricao:
      'O scanner de higiene passou a cobrir o que um teste de API precisa, mantendo a regra de so ' +
      'ler (GET/HEAD/OPTIONS): detecta CORS que reflete a origem ou libera credenciais, faz ' +
      'fingerprint da tecnologia pelos cabecalhos, acha erro verboso no corpo (stack trace, SQL, ' +
      'caminho ou IP interno), mostra se ha rate-limit e Cache-Control, pega cookie SameSite=None ' +
      'sem Secure e mapeia a superficie lendo a spec OpenAPI/Swagger (conta rotas e operacoes). O ' +
      'front ganhou modo lote (ate 15 URLs) e exportacao do laudo em Markdown e JSON, para anexar ao ' +
      'relatorio do pentest. Licao: da para ampliar muito a cobertura sem sair do passivo; cada ' +
      'analisador novo e uma funcao pura testada, o que mantem o risco baixo e o laudo auditavel.',
    categoria: 'funcionalidade',
    tags: ['pentest', 'scanner', 'api', 'cors', 'openapi', 'devsecops'],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-26-scanner-endpoints',
    data: '2026-11-26',
    titulo: 'Scanner de endpoints: a primeira ferramenta que testa, nao so ensina',
    descricao:
      'A Metodologia organiza o metodo; faltava executar. Criei um scanner de higiene de endpoint ' +
      'server-side na API: recebe uma URL (interna ou externa) e, de forma nao destrutiva (so ' +
      'GET/HEAD/OPTIONS), reporta TLS, cabecalhos de seguranca, metodos expostos, exposicoes comuns ' +
      '(.git/.env/swagger), flags de cookie e se ha autenticacao. Roda no servidor porque o navegador ' +
      'esbarra em CORS e nao alcanca rede interna; fica atras do Access e so bate no alvo que o ' +
      'operador digita. Licao: capacidade ofensiva de verdade exige fronteira (autorizacao, escopo e ' +
      'operacao reversivel), senao vira o problema que ela deveria achar.',
    categoria: 'funcionalidade',
    tags: ['pentest', 'scanner', 'api', 'endpoints', 'devsecops'],
    projetoId: null,
  },
  {
    id: "proj-2026-11-26-metodologia-pentest",
    data: "2026-11-26",
    titulo: "Metodologia de Pentest: ferramentas e técnicas na mesma espinha",
    descricao:
      "O Arsenal já listava ferramentas por fase e a Matriz já trazia o ATT&CK, mas faltava a " +
      "espinha que liga os dois ao fluxo real de um teste autorizado. Criei a tela Metodologia de " +
      "Pentest (base PTES + OWASP WSTG) com 7 fases, cada uma cruzando técnicas MITRE e ferramentas " +
      "do arsenal, com checklist e uma tarja de cuidados. A fase 1 é o portão de autorização: nada " +
      "toca o alvo sem escopo por escrito, janela acordada e operação reversível e auditável. Lição: " +
      "uma ferramenta de ataque só vira trabalho profissional quando emoldurada por metodologia e " +
      "autorização — o resto é risco.",
    categoria: "funcionalidade",
    tags: ["pentest", "metodologia", "mitre-attack", "ferramentas", "ptes"],
    projetoId: null,
  },
  {
    id: 'proj-2026-11-17-fase5-filtro-tecnica',
    data: '2026-11-17',
    titulo: 'Fase 5 (parte 3): filtrar o Radar por técnica MITRE',
    descricao:
      'Faltava conectar a seção de técnicas ATT&CK observadas à tabela de eventos: agora dá para filtrar ' +
      'os eventos por técnica. Para não cair na armadilha de escolher uma técnica e ver a tela vazia, o ' +
      'seletor só oferece técnicas que têm eventos correspondentes, e técnica e ação se excluem no filtro. ' +
      'Precisou de um pequeno acréscimo na API (traduzir a técnica para as ações equivalentes, comparando ' +
      'pelo id base para casar sub-técnicas). Lição: um filtro bom é o que nunca frustra — melhor oferecer ' +
      'só o que retorna resultado do que deixar o usuário tentar e não achar nada.',
    categoria: 'funcionalidade',
    tags: ['radar', 'filtros', 'mitre-attack', 'ux', 'api'],
  },
  {
    id: 'proj-2026-11-17-fase5-investigacoes-didaticas',
    data: '2026-11-17',
    titulo: 'Fase 5 (parte 2): o laudo que qualquer um entende',
    descricao:
      'Levei a camada didática do Radar para as Investigações (os dossiês). Cada evento da linha do ' +
      'tempo agora tem a frase em linguagem popular, e o dossiê abre com um organograma do caminho do ' +
      'ataque montado a partir das ações que de fato apareceram naquela janela: reconhecimento, acesso, ' +
      'ação por dentro e impacto. Em vez de uma lista técnica de eventos, o relatório conta a história de ' +
      'como o ataque começou e até onde foi. A lição: o mesmo dicionário didático serve a telas diferentes ' +
      '(Radar e Investigações) — centralizar o conteúdo uma vez e reusar é o que mantém a didática coerente.',
    categoria: 'funcionalidade',
    tags: ['investigacoes', 'laudos', 'didatica', 'ux', 'mitre-attack', 'plataforma-de-estudo'],
  },
  {
    id: 'proj-2026-11-17-fase5-radar-didatico',
    data: '2026-11-17',
    titulo: 'Fase 5 (parte 1): traduzir o Radar para quem não é da área',
    descricao:
      'Até aqui o Radar mostrava o que aconteceu de forma técnica (ação, serviço, técnica MITRE). ' +
      'Comecei a camada didática: cada evento agora tem uma frase em linguagem popular na tabela e, ' +
      'na ficha, uma explicação simples do ataque, uma comparação com o mundo real (o que isso seria ' +
      'numa empresa de verdade, não numa simulação) e um organograma de como o ataque começa, se amplia ' +
      'por dentro e qual o impacto. A ideia é que alguém sem base de segurança entenda a gravidade só de ' +
      'olhar. A lição: a detecção já estava pronta; o valor que faltava era a tradução — dado técnico vira ' +
      'aprendizado quando conta a história em linguagem de gente. Centralizei o conteúdo num dicionário por ' +
      'tipo de ataque, reaproveitado pela tabela, pela ficha e pelo organograma.',
    categoria: 'funcionalidade',
    tags: ['radar', 'didatica', 'ux', 'mitre-attack', 'blue-team', 'plataforma-de-estudo'],
  },
  {
    id: 'proj-2026-11-17-fase4-persistencia-endpoint',
    data: '2026-11-17',
    titulo: 'Fase 4: persistência e execução no endpoint, e ler o que o SIEM já sabe',
    descricao:
      'Saí da cadeia de AD e fui para o endpoint: execução via WMI, proxy por binário confiável (LOLBin), ' +
      'persistência por assinatura de evento WMI e chave Run no registro — quatro técnicas novas na Matriz, ' +
      'todas confirmadas no indexer. A lição desta fase foi de telemetria e de SIEM, não de ataque. ' +
      'Primeira: a detecção só existe se o dado chega — o agente não encaminhava o canal do Sysmon, então ' +
      'nenhuma regra de processo/registro/WMI podia disparar; habilitar o encaminhamento foi o passo que ' +
      'desbloqueou tudo. Segunda: antes de escrever regra, veja o que o conjunto de regras já cobre — metade ' +
      'das técnicas já tinha detecção nativa (assinatura WMI e chave Run), e insistir em regra própria só ' +
      'competia com a nativa. Terceira, a mais cara: uma regra encadeada só vence se ancora no nó certo da ' +
      'árvore — ancorar no pai genérico não basta quando o evento já se compromete com uma sub-árvore mais ' +
      'específica; a regra tem de ser filha desse nó. Fechei limpando o que criei (assinatura WMI e chaves Run).',
    categoria: 'aprendizado',
    tags: ['cyber-range', 'sysmon', 'wazuh', 'lolbin', 'wmi', 'persistencia', 'mitre-attack', 'blue-team'],
  },
  {
    id: 'proj-2026-11-17-fase3-cadeia-ad',
    data: '2026-11-17',
    titulo: 'Fase 3: a cadeia de ataque de AD, e detectar onde dá',
    descricao:
      'Com o domínio de pé, percorri a cadeia que um ataque real faz depois do foothold: AS-REP Roasting, ' +
      'DCSync (direitos de replicação), movimento lateral por serviço remoto e escalada por adição a grupo ' +
      'privilegiado — cada um virou alerta no Wazuh com regra e técnica MITRE. Duas lições honestas. ' +
      'Primeira: o que o laboratório não deixa fazer também ensina — a extração do DCSync exige um binário ' +
      'ofensivo que a rede isolada bloqueia, então detectei o passo anterior (a concessão dos direitos de ' +
      'replicação), que é o ponto de detecção mais precoce e confiável. Segunda: o ambiente endurecido muda o ' +
      'caminho — a vítima barra conexão de administração de entrada, então o movimento lateral teve de ir pelo ' +
      'controlador de domínio, que aceita; o firewall de host é, ele mesmo, um controle. ' +
      'Fechei limpando os backdoors que criei (direitos de replicação, conta sem pré-autenticação, grupo privilegiado).',
    categoria: 'seguranca',
    tags: ['cyber-range', 'active-directory', 'dcsync', 'movimento-lateral', 'wazuh', 'mitre-attack', 'blue-team'],
  },
  {
    id: 'proj-2026-11-17-fase2-ad-deteccoes',
    data: '2026-11-17',
    titulo: 'Fase 2: montar o alvo e a detecção juntos',
    descricao:
      'Diminuir pendência não é acrescentar vulnerabilidade solta — é entregar alvo, ataque e detecção no mesmo movimento. ' +
      'Para seis técnicas sem sinal, montei o que faltava: um domínio Active Directory inteiro do zero (para viabilizar o ' +
      'Kerberoasting, que só existe com AD), a vítima ingressada nele, e então ataques controlados de dump de credenciais, ' +
      'tarefa agendada, inibição de recuperação, ransomware (simulado numa pasta-isca monitorada pelo FIM) e exfiltração. ' +
      'Cada um virou alerta no Wazuh com regra própria e técnica MITRE. Lição técnica mais cara: uma regra encadeada no ' +
      'pai errado nunca dispara — um evento de Kerberos parava numa regra de nível 0 e a minha, ancorada na regra seguinte, ' +
      'não era avaliada; ancorar no pai certo (o nó que o evento comprovadamente alcança) resolveu. ' +
      'Lição de método: adicionar vulnerabilidade sem adicionar a detecção junto só aumenta a fila; o par alvo+regra é a unidade de trabalho.',
    categoria: 'infra',
    tags: ['cyber-range', 'active-directory', 'kerberoasting', 'wazuh', 'mitre-attack', 'blue-team'],
  },
  {
    id: 'proj-2026-11-17-documentacao-ambiente',
    data: '2026-11-17',
    titulo: 'Documentar o ambiente dentro do próprio app',
    descricao:
      'Um ambiente de estudo só ensina se dá para explicar como foi montado. Criei um menu de Documentação que ' +
      'descreve o range no nível de arquitetura — rede e VLANs, regras de firewall, criação das VMs, configuração do ' +
      'switch e as formas de abrir cada porta para ataque — e um índice de testes por tipo, cada um com âncora própria: ' +
      'o que abre a superfície, como é atacada e como o Wazuh detecta. Desafio central: escrever para um repositório ' +
      'público sem virar um mapa do alvo — nada de IPs, domínio ou senhas, só nome de segmento e técnica. ' +
      'Lição: a documentação do que está exposto é, ela mesma, superfície de ataque; descrever o método sem o mapa é o equilíbrio certo.',
    categoria: 'funcionalidade',
    tags: ['documentacao', 'cyber-range', 'mitre-attack', 'blue-team'],
  },
  {
    id: 'proj-2026-11-17-importar-exercicios',
    data: '2026-11-17',
    titulo: 'Fechar a fila de pendências sem digitar 21 vezes',
    descricao:
      'A Matriz mostrava dezenas de técnicas com alerta real do Wazuh, mas todas presas na etapa "aguardando ' +
      'validação": a detecção existe, falta registrar o exercício que prova que a regra pega o ataque certo. ' +
      'Registrar isso à mão, uma a uma, era o gargalo. A solução foi um importador: um botão que lê um JSON de ' +
      'exercícios Red × Blue e só acrescenta — de-duplica pela assinatura (lab + título + técnicas) e nunca apaga ' +
      'o que já está lá. Cada exercício cita a regra e o agente que detectaram de verdade, com a resposta do Blue. ' +
      'Lição: quando a evidência já existe, a ferramenta tem que deixar você colher em lote, não recadastrar; e o ' +
      'importador aditivo evita o medo de perder o que foi feito à mão.',
    categoria: 'funcionalidade',
    tags: ['mitre-attack', 'purple-team', 'wazuh', 'produtividade'],
  },
  {
    id: 'proj-2026-11-16-ponto-cego-t1046',
    data: '2026-11-16',
    titulo: 'O ponto cego que o SIEM não via: varredura de portas',
    descricao:
      'Com os alertas reais na Matriz, sobrou uma técnica em vermelho: T1046. O honeypot recebe varreduras o dia ' +
      'todo, mas cada conexão aceita pelo firewall é só uma linha de log, sem alerta. A varredura só aparece ' +
      'olhando o conjunto: o mesmo IP em muitas portas em pouco tempo. Uma regra de correlação no Wazuh (frequência, ' +
      'mesmo IP, portas diferentes) transformou isso em alerta. Lição: algumas técnicas não estão em nenhum evento ' +
      'isolado, só no padrão entre eventos; e a lista de pendências foi agrupada por tipo para mostrar primeiro o ' +
      'ponto cego, não a fila de validações.',
    categoria: 'seguranca',
    tags: ['mitre-attack', 'wazuh', 'deteccao', 'fortigate', 'blue-team'],
  },
  {
    id: 'proj-2026-11-16-isca-web',
    data: '2026-11-16',
    titulo: 'Um site de verdade para ser atacado, longe do app',
    descricao:
      'A ideia inicial era abrir o próprio app de estudo para ver ataques web. Ele guarda tokens do firewall, do ' +
      'hipervisor e do SIEM: invadido, entregaria a chave do homelab inteiro. A saída foi um domínio separado, sem ' +
      'proxy, apontando para uma VM num segmento só dela, com WordPress antigo e plugins vulneráveis, DVWA e Juice ' +
      'Shop. Sem saída para a internet, para que um invasor com shell não use o IP de casa contra terceiros, e com ' +
      'reset diário. Minutos depois de abrir a porta, um scanner já procurava /sse, o endpoint típico de servidor ' +
      'MCP: os robôs já caçam agentes de IA expostos. Lição: o alvo de estudo e o painel de controle nunca são a ' +
      'mesma máquina.',
    categoria: 'infra',
    tags: ['honeypot', 'wordpress', 'wazuh', 'blue-team', 'range'],
  },
  {
    id: 'proj-2026-11-16-attack-alertas-wazuh',
    data: '2026-11-16',
    titulo: 'A matriz dizia "sem alerta" com centenas de milhares de alertas no SIEM',
    descricao:
      'A Matriz ATT&CK pedia um registro manual de exercício para cada técnica antes de admitir que havia alerta, ' +
      'enquanto o Wazuh já disparava regras com o ID MITRE em quase todas elas. Agora a etapa "Alerta" lê o SIEM: ' +
      'agrega os alertas por técnica, mostra quais regras dispararam e em quais agentes, e separa produção de ' +
      'laboratório. A validação continua manual de propósito: alerta disparando prova que a regra existe, não que ' +
      'ela está certa. No caminho apareceu outra lição: na instalação all-in-one o indexador só escuta localmente, ' +
      'e o dashboard já oferece uma ponte autenticada até ele, sem abrir porta nova.',
    categoria: 'funcionalidade',
    tags: ['mitre-attack', 'wazuh', 'siem', 'deteccao', 'blue-team'],
  },
  {
    id: 'proj-2026-11-16-linkedin-projetos-andamento',
    data: '2026-11-16',
    titulo: 'Projetos com marcos e informes para comunicar entregas reais',
    descricao:
      'A aba Projetos do LinkedIn passou a registrar resultado esperado, escopo, critérios de sucesso, marcos e informes de andamento. ' +
      'A condição e o avanço refletem o informe ativo mais recente; editar ou excluir um informe recalcula a visão sem apagar o histórico. ' +
      'Um informe escolhido pode virar uma ideia de post editável, ligando entrega, resultado e aprendizado à comunicação profissional.',
    categoria: 'funcionalidade',
    tags: ['linkedin', 'projetos', 'marcos', 'andamento'],
  },
  {
    id: 'proj-2026-11-15-linkedin-perfil-blocos-recolhidos',
    data: '2026-11-15',
    titulo: 'O perfil profissional cabe melhor na tela',
    descricao:
      'Os blocos do perfil profissional no LinkedIn agora começam recolhidos: dados do perfil e importação, headline e Sobre, ' +
      'certificações, cursos, experiência, projetos e vagas. Os títulos e as contagens permanecem visíveis; cada seção abre ' +
      'quando é hora de revisar ou editar, reduzindo a rolagem sem remover conteúdo.',
    categoria: 'funcionalidade',
    tags: ['linkedin', 'perfil-profissional', 'interface'],
  },
  {
    id: 'proj-2026-11-15-inteligencia-ui',
    data: '2026-11-15',
    titulo: 'Tela de inteligência que responde ao clique',
    descricao:
      'Na área de inteligência, parte dos cartões parecia botão e não fazia nada, e as tabelas não tinham ordenação: ' +
      'a seta de ordenar só aparecia no hover e, nas tabelas paginadas no servidor, ordenar a página atual seria enganoso. ' +
      'Agora a ordenação acontece no servidor, com uma lista fixa de colunas, e a seta fica sempre visível. Cada cartão ' +
      'que parece filtro filtra de fato ou abre o detalhe do que ele resume. Lição: se um elemento tem cara de botão, o ' +
      'clique precisa produzir alguma coisa; e ordenar tabela paginada é uma questão de dados, não de visual.',
    categoria: 'funcionalidade',
    tags: ['ui', 'ux', 'inteligencia', 'tabelas', 'wazuh'],
  },
  {
    id: 'proj-2026-11-15-linkedin-certificacoes-recolhiveis',
    data: '2026-11-15',
    titulo: 'Um perfil profissional mais compacto',
    descricao:
      'Na aba Perfil profissional do LinkedIn, a lista de certificações agora começa recolhida e mostra quantas estão cadastradas. ' +
      'Assim, cursos, experiências, projetos e vagas-alvo ficam mais próximos sem remover nenhuma informação; basta expandir ' +
      'a seção para revisar ou editar certificações.',
    categoria: 'funcionalidade',
    tags: ['linkedin', 'perfil-profissional', 'interface'],
  },
  {
    id: 'proj-2026-11-15-exposicao-fontes',
    data: '2026-11-15',
    titulo: 'O que eu publiquei de propósito × o que a internet realmente vê',
    descricao:
      'A pergunta mais útil sobre exposição não é "o que está aberto", é "o que está aberto SEM eu ter decidido". ' +
      'A Minha exposição passou a ler as VIPs do FortiGate e comparar com o que o Shodan enxerga: porta vista e não ' +
      'publicada vira alerta alto. Em volta disso entraram fontes plugáveis (cada uma um arquivo com coleta, comparação ' +
      'e exibição genérica): listas de bloqueio, AbuseIPDB e GreyNoise para a reputação do IP do honeypot, TLS, ' +
      'cabeçalhos e Observatory para o site, domínios parecidos registrados, URLs antigas do Wayback, urlscan, ' +
      'VirusTotal, vazamentos de e-mail e código no GitHub. As mudanças chegam ao Wazuh por syslog com regras próprias ' +
      'e as graves ao Telegram; no Radar, o GreyNoise separa robô que varre a internet inteira de ataque direcionado.',
    categoria: 'funcionalidade',
    tags: ['osint', 'exposicao', 'wazuh', 'fortigate', 'greynoise', 'threat-intel'],
  },
  {
    id: 'proj-2026-11-15-minha-exposicao',
    data: '2026-11-15',
    titulo: 'Minha exposição: a fotografia vira filme',
    descricao:
      'Consultar uma vez o que a internet sabe sobre mim é útil; saber o que MUDOU é o que pega um problema cedo. A tela ' +
      'Minha exposição guarda cada varredura passiva (certificados, Shodan, DNS público) e compara com a anterior: ' +
      'subdomínio novo, porta aberta, CVE nova, aviso de DNS. Cada mudança também sai como uma linha JSON no log, pronta ' +
      'para o Wazuh. Para ir além das três fontes, o SpiderFoot (o "Maltego open source") passou a rodar num container ' +
      'LXC no Proxmox e virou ferramenta dos agentes: varredura passiva roda direto, as que tocam o alvo pedem clique.',
    categoria: 'funcionalidade',
    tags: ['osint', 'exposicao', 'spiderfoot', 'proxmox', 'agentes'],
  },
  {
    id: 'proj-2026-11-15-osint-passivo',
    data: '2026-11-15',
    titulo: 'O que a internet já sabe sobre mim',
    descricao:
      'Inspirado no Maltego, mas começando pelo básico que mais revela: três consultas passivas que qualquer atacante ' +
      'faz antes do primeiro pacote. Os logs de Certificate Transparency entregam todo subdomínio que já ganhou ' +
      'certificado; o Shodan InternetDB mostra as portas e as versões que o mundo vê no IP de casa; o DNS público expõe ' +
      'SPF, DMARC e CAA mal configurados. Nada varre o alvo nem precisa de credencial, então as ferramentas rodam sem ' +
      'aprovação, no agente ou pelo MCP. É também a base para acompanhar o honeypot: ver o domínio-isca aparecer no ' +
      'crt.sh e, logo depois, os ataques chegando.',
    categoria: 'funcionalidade',
    tags: ['agentes', 'osint', 'recon', 'exposicao'],
  },
  {
    id: 'proj-2026-11-15-guia-agents',
    data: '2026-11-15',
    titulo: 'Um manual que mora na própria tela e aprende com o uso',
    descricao:
      'A seção de agentes tinha capacidade demais para ser entendida só olhando. Cada tela ganhou uma barra discreta ' +
      '"Como usar" que abre o passo a passo, exemplos de pedido, o que já funciona no servidor e o que falta configurar. ' +
      'A parte mais útil é "Melhorar com o tempo": em vez de dicas genéricas, ela lê a auditoria e as avaliações e aponta ' +
      'o que mudar, como uma ferramenta que sempre falha com o mesmo erro, uma ação que você nega toda vez ou cliques ' +
      'que o modo autônomo dispensaria. Regras simples, sem IA, para cada sugestão dizer exatamente de onde veio.',
    categoria: 'funcionalidade',
    tags: ['agentes', 'ux', 'documentacao', 'aprendizado'],
  },
  {
    id: 'proj-2026-11-15-linkedin-arte',
    data: '2026-11-15',
    titulo: 'Arte de post sem depender de IA de imagem para o texto',
    descricao:
      'IA de imagem erra acento e palavra, o que é inaceitável numa capa profissional. A decisão foi separar as tarefas: ' +
      'a IA de texto projeta os slides, um template em canvas desenha tudo no navegador (sempre com o texto certo e ' +
      'legível no celular) e a IA de imagem só entra, sob demanda e com limite diário, para uma ilustração de fundo sem ' +
      'letras. O PDF do carrossel é montado à mão, sem biblioteca, com uma imagem por página. Testar o desenho em um ' +
      'navegador sem interface achou texto invadindo o rodapé e itens sumindo em formato baixo, que um teste de tipos ' +
      'não pegaria.',
    categoria: 'decisao',
    tags: ['linkedin', 'imagem', 'canvas', 'custo'],
  },
  {
    id: 'proj-2026-11-15-linkedin-perfil-voz',
    data: '2026-11-15',
    titulo: 'A IA do LinkedIn passou a conhecer quem escreve',
    descricao:
      'Os rascunhos saíam corretos e genéricos, porque a IA só tinha uma descrição de voz fixa e nenhum fato verificável ' +
      'sobre a carreira. Agora há um perfil profissional estruturado (certificação obtida, em andamento ou planejada), ' +
      'posts e perfis que inspiram, e um perfil de voz aprendido dos próprios posts. O texto gerado passa por um filtro ' +
      'anti-genérico, e a regra de produto ficou explícita: a IA só afirma como conquista o que está marcado como obtido. ' +
      'O nome do empregador ficou de fora do modelo de dados de propósito.',
    categoria: 'decisao',
    tags: ['linkedin', 'ia', 'voz', 'carreira'],
  },
  {
    id: 'proj-2026-11-15-linkedin-conexao',
    data: '2026-11-15',
    titulo: 'Conectar ao LinkedIn sem caça ao tesouro',
    descricao:
      'Um teste de ponta a ponta mostrou que a conexão com o LinkedIn falhava em silêncio: o botão ficava escondido ' +
      'no fim da aba de marca, e quando o retorno do LinkedIn dava erro, a tela só dizia "não foi possível" sem motivo. ' +
      'Agora o retorno explica o que aconteceu (recusa, código ausente, estado expirado), o motivo fica salvo na conta ' +
      'e a tela de publicação avisa quando a conexão está desligada, com atalho direto. Lição: uma integração que depende ' +
      'de um redirecionamento precisa dizer o motivo quando falha, senão quem testa fica sem nada para investigar.',
    categoria: 'funcionalidade',
    tags: ['linkedin', 'oauth', 'ux', 'erro'],
  },
  {
    id: 'proj-2026-11-15-operador-homelab-mcp',
    data: '2026-11-15',
    titulo: 'Operar o homelab de qualquer lugar, sem aprovar cada clique',
    descricao:
      'A central de operações ganhou autonomia com limite claro. Ações leves e reversíveis, como ligar uma VM, criar ' +
      'snapshot ou criar uma VLAN, passaram a rodar direto; apagar, reverter, desligar à força e comando livre dentro ' +
      'de uma VM continuam pedindo um clique. A decisão de onde traçar essa linha veio de um detalhe: o login com ' +
      'código no e-mail protege quem entra no app, mas os honeypots e os alertas trazem texto escrito por atacantes, ' +
      'e é isso que chega ao modelo. Também entraram consultas dentro das VMs pelo agente QEMU, sem senha nem rede, ' +
      'alertas do Wazuh, o Coolify, um botão que testa cada conexão de verdade e um servidor MCP que leva as mesmas ' +
      'ferramentas ao Claude Code em qualquer computador.',
    categoria: 'funcionalidade',
    tags: ['agentes', 'mcp', 'homelab', 'automacao', 'seguranca'],
  },
  {
    id: 'proj-2026-11-15-linkedin-midia',
    data: '2026-11-15',
    titulo: 'Imagem, PDF e um "desfazer" de verdade na publicação automática',
    descricao:
      'A publicação pelo servidor passou a levar imagem e PDF, que o LinkedIn mostra como documento. Duas decisões ' +
      'de segurança vieram juntas. O tipo do arquivo é conferido pelos primeiros bytes, não pelo nome nem pelo que o ' +
      'navegador declara, então um arquivo disfarçado não passa. E anexar, trocar ou tirar o arquivo desfaz a aprovação, ' +
      'como já acontecia com o texto: a aprovação vale para o conteúdo inteiro. Também entraram a opção de publicar só ' +
      'para conexões, útil para o primeiro teste real, e o botão que apaga do perfil um post publicado pelo servidor. ' +
      'Uma referência pronta, escrita para outro framework, serviu de base: em vez de instalar uma segunda versão do ' +
      'módulo, só a lógica que faltava foi portada para o que já estava no ar.',
    categoria: 'funcionalidade',
    tags: ['linkedin', 'api', 'upload', 'seguranca'],
  },
  {
    id: 'proj-2026-11-15-agente-homelab-visivel',
    data: '2026-11-15',
    titulo: 'O operador do homelab ficou visível na central de Agents',
    descricao:
      'O operador integrado era um modelo escondido dentro do fluxo de criação, e isso parecia que ele não existia. ' +
      'A central agora mostra um atalho quando ainda não há um operador com esse nome e cria o agente como rascunho, ' +
      'para revisar ferramentas e limites antes de ativá-lo.',
    categoria: 'funcionalidade',
    tags: ['agents', 'homelab', 'experiencia'],
  },
  {
    id: 'proj-2026-11-15-ambientes-monitoramento',
    data: '2026-11-15',
    titulo: 'Laboratório e produção ganharam visões próprias no monitoramento',
    descricao:
      'O ambiente passou a acompanhar cada evento no banco, com filtros no Radar, nos agentes e alertas do Wazuh e nas ' +
      'observações da matriz. Labels e grupos orientam a classificação, enquanto eventos ambíguos ficam sem atribuição. ' +
      'Um IP privado não significa laboratório. A coleta de produção conserva metadados para análise e não envia ' +
      'conteúdo automaticamente para a biblioteca forense do ambiente controlado.',
    categoria: 'funcionalidade',
    tags: ['monitoramento', 'wazuh', 'producao', 'laboratorio'],
  },
  {
    id: 'proj-2026-11-15-agente-operacao-homelab',
    data: '2026-11-15',
    titulo: 'Agentes passam a operar mais partes da infraestrutura com aprovação',
    descricao:
      'O operador integrado ganhou ferramentas para ajustar CPU e memória de VMs desligadas, migrar VMs entre nós, consultar o Wazuh e solicitar reinícios aprovados, além de consultar e administrar hosts, templates e itens simples no Zabbix. ' +
      'As credenciais continuam no servidor, os parâmetros são validados e cada escrita exige aprovação. A experiência reforça que autonomia útil começa com inventário e plano, e termina com verificação do estado. O roteador, regras do Wazuh, triggers e discovery rules do Zabbix ainda exigem integrações próprias.',
    categoria: 'funcionalidade',
    tags: ['agents', 'proxmox', 'wazuh', 'zabbix', 'aprovacao', 'homelab'],
  },
  {
    id: 'proj-2026-11-15-linkedin-pipeline',
    data: '2026-11-15',
    titulo: 'O módulo de conteúdo virou um pipeline: do projeto ao post agendado',
    descricao:
      'Rascunho e post publicado eram duas listas que não se conheciam, e as ideias que a IA tirava de cada post ' +
      'se perdiam. Agora o conteúdo anda por um caminho só: projeto, ideia no backlog, rascunho com versões, ' +
      'aprovação, agendamento e publicação. A decisão central foi tratar a publicação como ação externa e ' +
      'irreversível: nada sai sem aprovação explícita, a aprovação vale para um texto (editar desfaz), e o servidor ' +
      'refaz a verificação antes de enviar, com a mesma regra que a tela mostra. Essa verificação barra campos ' +
      'que a IA deixou entre colchetes para confirmar e qualquer endereço ou domínio do ambiente. Para nunca ' +
      'publicar duas vezes, o rascunho é reservado numa atualização condicional antes da chamada; se o serviço ' +
      'reiniciar no meio, o post fica como falha e ninguém o reenvia sozinho. O agendador nasceu independente da ' +
      'API da rede: sem conexão, ele funciona como lembrete. Lição de pesquisa: a API oficial publica texto no ' +
      'perfil, mas não agenda nem devolve métricas de posts pessoais, então o desenho precisou assumir isso desde o início.',
    categoria: 'funcionalidade',
    tags: ['linkedin', 'pipeline', 'agendamento', 'ia', 'seguranca'],
  },
  {
    id: 'proj-2026-11-14-biblioteca-artefatos',
    data: '2026-11-14',
    titulo: 'Uma biblioteca permanente para estudar os rastros dos ataques',
    descricao:
      'Arquivos, comandos e trechos dos laudos ganharam armazenamento independente da retenção de eventos. ' +
      'Cada ocorrência conserva o alvo, o horário e a origem. Amostras são verificadas por SHA-256, exibidas como texto ' +
      'ou prévia estática e entram no backup cifrado, junto das anotações de estudo. Repetir a importação do histórico ' +
      'não duplica ocorrências; padrões reconhecidos ajudam a triagem sem afirmar que um ataque teve sucesso.',
    categoria: 'funcionalidade',
    tags: ['pericia', 'artefatos', 'estudo', 'backup'],
  },
  {
    id: 'proj-2026-11-14-dossies-investigacao',
    data: '2026-11-14',
    titulo: 'Dossiês reúnem a linha do tempo e as evidências dos ataques',
    descricao:
      'Uma nova área de Inteligência reúne os laudos por janela, eventos correlacionados do Radar, arquivos, persistência, ' +
      'processos e conexões. A Matriz ATT&CK separa o que veio do Radar das técnicas sugeridas pelos tipos de persistência ' +
      'coletados, para que uma hipótese de mapeamento não pareça confirmação automática.',
    categoria: 'funcionalidade',
    tags: ['investigacao', 'pericia', 'mitre-attack', 'radar'],
  },
  {
    id: 'proj-2026-11-14-prompt-honeypot',
    data: '2026-11-14',
    titulo: 'Um canário HTTP para observar automação que lê páginas',
    descricao:
      'O honeypot de rede já mostrava conexões a serviços; um experimento separado agora observa leitores automatizados ' +
      'de uma página HTTP. Um canário pede uma consulta apenas ao mesmo host e usa credenciais falsas que nunca autenticam. ' +
      'O serviço não pede prompts ou segredos, não executa entrada recebida, grava apenas nomes de campos e indicadores, ' +
      'e limita o tamanho dos logs. O Wazuh e o Radar recebem sinais como uso do canário, mudança de User-Agent e pausas ' +
      'entre rajadas. A classificação continua deliberadamente modesta: esses padrões indicam automação para investigar, ' +
      'mas não provam que uma IA esteja por trás do acesso.',
    categoria: 'seguranca',
    tags: ['honeypot', 'wazuh', 'prompt-injection', 'deception'],
  },
  {
    id: 'proj-2026-11-14-agentes-vm-sync-backup',
    data: '2026-11-14',
    titulo: 'Agentes cuidam do ciclo de vida das VMs e o inventário se atualiza sozinho',
    descricao:
      'Os agentes passaram a criar, clonar e apagar VMs no Proxmox. Apagar é a ação mais perigosa, então além da tela de ' +
      'aprovação o servidor confere no momento de executar: a VM precisa estar desligada, o nome precisa bater, a proteção do ' +
      'Proxmox precisa estar desligada e o VMID não pode estar na lista de protegidas (a VM do próprio app). Meu Ambiente ganhou ' +
      'o botão Sincronizar com o ambiente: o servidor lê Proxmox, FortiGate e switch e mostra uma prévia do que entra e do que ' +
      'muda, sem apagar nada e sem pisar no que foi escrito à mão. As execuções dos agentes passaram a entrar no backup cifrado. ' +
      'Lição: a segurança de uma ação destrutiva fica no servidor, conferindo o estado real, e não no que o modelo afirmou.',
    categoria: 'funcionalidade',
    tags: ['agentes', 'proxmox', 'inventario', 'backup'],
  },
  {
    id: 'proj-2026-11-14-linkedin-timeout',
    data: '2026-11-14',
    titulo: 'A geração de conteúdo precisava de mais tempo que as rotas comuns',
    descricao:
      'O proxy do web encerrava todas as respostas da API após 30 segundos, inclusive pedidos de geração por IA. ' +
      'Aumentamos esse limite para a geração de conteúdo e deixamos a mensagem de timeout compreensível, sem depender do formato do post.',
    categoria: 'aprendizado',
    tags: ['linkedin', 'ia', 'timeout', 'experiencia-de-uso'],
  },
  {
    id: 'proj-2026-11-14-linkedin-estudio-visual',
    data: '2026-11-14',
    titulo: 'O Estúdio do LinkedIn prepara texto e material visual no mesmo rascunho',
    descricao:
      'Rascunhos de imagem e carrossel agora podem guardar direção visual, texto alternativo e roteiro de slides junto do texto no servidor. ' +
      'O checklist deixa de tratar quantidade fixa de caracteres, hashtags ou link como fórmula de alcance: a orientação é publicar algo útil e original, ' +
      'e usar os próprios dados para comparar temas e formatos ao longo do tempo.',
    categoria: 'funcionalidade',
    tags: ['linkedin', 'carrossel', 'acessibilidade', 'conteudo'],
  },
  {
    id: 'proj-2026-11-14-carreira-inventario-real',
    data: '2026-11-14',
    titulo: 'Meu Ambiente só mostra ativos cadastrados; LinkedIn ganha uma central de posicionamento',
    descricao:
      'O inventário deixou de preencher a tela com registros demonstrativos ou inferidos de documentação: agora começa vazio e mantém o que o usuário cadastra ou importa. ' +
      'Na área de carreira, headline, texto Sobre, checklist do perfil e briefings ajudam a contar a transição entre infraestrutura, DevOps, virtualização e Segurança da Informação com evidências. ' +
      'Os modelos usam campos de confirmação, e as instruções da IA separam experiência profissional, estudo e laboratório e evitam afirmar certificações ou resultados sem evidência.',
    categoria: 'funcionalidade',
    tags: ['linkedin', 'carreira', 'inventario', 'posicionamento'],
  },
  {
    id: 'proj-2026-11-14-iscas',
    data: '2026-11-14',
    titulo: 'Isca dentro da rede: quem mexer no arquivo errado se denuncia',
    descricao:
      'O honeypot exposto pega quem bate na porta. Mas um atacante que já entrou por outro caminho passa direto por ele. ' +
      'Para cobrir isso, o Windows real ganhou iscas: um arquivo com credenciais falsas e uma conta sem uso legítimo. Qualquer ' +
      'leitura do arquivo ou tentativa de entrar com a conta vira alerta no Wazuh e sobe ao Radar. Montar a isca levou ' +
      'menos tempo que descobrir por que ela não alertava. Três armadilhas: o agente do Windows exclui por padrão o evento ' +
      'de acesso a arquivo (4663), sem regra o manager descarta o evento em silêncio, e o rollback do snapshot deixa o agente ' +
      'com a posição antiga do log de segurança. Lição: uma isca só vale depois de ver o alerta chegar de ponta a ponta.',
    categoria: 'seguranca',
    tags: ['honeytoken', 'wazuh', 'blue-team', 'windows'],
  },
  {
    id: 'proj-2026-11-14-cartoes-ficha',
    data: '2026-11-14',
    titulo: 'Todo cartão abre uma ficha lateral',
    descricao:
      'Revisão de UX da aplicação inteira com uma regra só: nenhum cartão "morto". Três peças comuns (cartão clicável ' +
      'acessível, ficha lateral com navegação ↑/↓ e um hook de seleção) e cada tela passou a abrir detalhe útil que ' +
      'não cabe no cartão: relações entre labs, ferramentas, alvos do range e técnicas ATT&CK; histórico de sessões; ' +
      'execuções e pendências dos agentes; agentes que consultam cada tag do Segundo Cérebro. No caminho, cores fixas ' +
      'viraram tokens, indicadores viraram filtros, telas grandes foram quebradas em componentes, a prévia de ' +
      'artefatos HTML passou a abrir isolada sem scripts e a senha do cofre só aparece com um "Revelar" explícito que ' +
      'volta a mascarar sozinho. O trabalho foi dividido entre seis agentes em paralelo, cada um com um grupo de telas.',
    categoria: 'funcionalidade',
    tags: ['ux', 'acessibilidade', 'agentes', 'segredos'],
  },
  {
    id: 'proj-2026-11-14-menu-recolhido',
    data: '2026-11-14',
    titulo: 'Menu lateral sempre recolhido',
    descricao:
      'As seções do menu passaram a começar sempre recolhidas e só abrem por clique; a seção da tela atual mostra um ' +
      'ponto para não perder a orientação.',
    categoria: 'decisao',
    tags: ['ux', 'navegacao'],
  },
  {
    id: 'proj-2026-11-14-painel-wazuh',
    data: '2026-11-14',
    titulo: 'Wazuh: saúde do manager e alertas no mesmo lugar',
    descricao:
      'A aplicação já recebia alertas selecionados do Wazuh pelo forwarder, mas não mostrava se o manager e os agentes ' +
      'estavam saudáveis. O novo painel consulta a API REST com uma identidade somente leitura e reúne estado dos serviços, ' +
      'agentes e os alertas encaminhados. A investigação continua ligada ao Radar, enquanto a tela explica que esse recorte ' +
      'não substitui a busca completa no Indexer. Credenciais ficam no servidor e campos sensíveis dos detalhes são redigidos.',
    categoria: 'funcionalidade',
    tags: ['wazuh', 'radar', 'monitoramento', 'segurança'],
  },
  {
    id: 'proj-2026-11-14-honeypots-extras',
    data: '2026-11-14',
    titulo: 'Ampliando a Matriz ATT&CK com honeypots extras',
    descricao:
      'A Matriz ATT&CK do app mostrava cobertura concentrada em reconhecimento e acesso inicial, com táticas como ' +
      'persistência, escalação e exfiltração zeradas. Em vez de simular esses ataques, trouxe para o repositório ' +
      'público o código de honeypots extras que já roda na infraestrutura real: Heralding (expõe VNC, PostgreSQL, ' +
      'SMTP, POP3 e IMAP, capturando credenciais sem aceitar nenhuma) e três iscas próprias que respondem como Redis, ' +
      'Elasticsearch e a API do Docker, sempre registrando o comando tentado sem executar nada de verdade. Isso abre ' +
      'a técnica de implantação de container (T1610) na matriz. Lição: ampliar a superfície observável de um jeito ' +
      'seguro significa responder o suficiente para o atacante se revelar, nunca o bastante para ele conseguir algo real.',
    categoria: 'funcionalidade',
    tags: ['honeypot', 'mitre-attack', 'range'],
  },
  {
    id: 'proj-2026-11-14-laudo-alvos-reais',
    data: '2026-11-14',
    titulo: 'Laudo antes do reset: o que o malware deixou e para onde quis ligar',
    descricao:
      'Os alvos reais do honeypot voltam ao estado limpo a cada 6 horas, e com isso a evidência sumia. Agora, logo antes ' +
      'do reset, a VM do Wazuh examina cada alvo pelo agente do hipervisor (nada é instalado dentro, para o invasor não ' +
      'perceber) e monta um laudo: arquivos criados ou alterados desde o snapshot limpo, com hash; cron, chaves SSH, ' +
      'serviços e outros pontos de persistência; processos e conexões ainda vivos; e as conexões de saída que o firewall ' +
      'barrou. Para essa última parte, uma regra nova no Wazuh transforma cada bloqueio de saída dos alvos em alerta, ' +
      'já que a regra padrão só registrava um resumo de vez em quando. O primeiro dado foi eloquente: o Linux real, ' +
      'infectado, tentava falar com dois servidores HTTP e com um DNS público cerca de uma vez por segundo, o batimento ' +
      'típico de um malware procurando o próximo estágio ou o servidor de comando. Lição: sem saída, o malware não causa ' +
      'dano, mas denuncia para onde iria.',
    categoria: 'funcionalidade',
    tags: ['honeypot', 'wazuh', 'forense', 'malware', 'fortigate'],
  },
  {
    id: 'proj-2026-11-14-radar-escala',
    data: '2026-11-14',
    titulo: 'Radar aguenta o honeypot exposto e separa internet de laboratório',
    descricao:
      'Com o honeypot na internet o volume virou centenas de milhares de eventos por dia, e o resumo, que carregava ' +
      'as linhas na memória com teto de 100 mil, passaria a cobrir só as últimas horas. A agregação foi para o ' +
      'PostgreSQL (GROUP BY com índice). Cada evento agora sabe se veio da internet ou da rede interna, para os ' +
      'exercícios da Kali não inflarem os números de ataque real. O coletor ganhou país por IP com base local ' +
      '(DB-IP), passou a isolar só o evento inválido de um lote recusado e não perde mais o fim do arquivo na ' +
      'rotação da meia-noite. Lição: dado de segurança cresce rápido; agregue onde o dado mora.',
    categoria: 'funcionalidade',
    tags: ['radar', 'postgresql', 'wazuh', 'geoip'],
  },
  {
    id: 'proj-2026-11-14-honeypot-amplo',
    data: '2026-11-14',
    titulo: 'Mais portas abertas, com uma linha que não se cruza',
    descricao:
      'O honeypot passou a responder em dezenas de serviços: SSH e Telnet em portas alternativas, painéis web, VoIP, ' +
      'MQTT, impressora, bancos de dados, e-mail e VNC, além de iscas próprias de Redis, Elasticsearch e da API do ' +
      'Docker, que registram exatamente o que o atacante tenta rodar (o container do minerador, o CONFIG SET do Redis ' +
      'para plantar chave SSH). Um Windows Server real e um Ubuntu real atrás do SSH falso dão alta interação, isolados ' +
      'e restaurados a cada seis horas. A linha que não se cruza: serviços UDP de reflexão. Responder a eles faria do ' +
      'homelab uma arma de DDoS contra terceiros. Em vez disso, o firewall registra e descarta esses pacotes, e o app ' +
      'mostra a tentativa, lembrando que a origem é falsificada e aponta para a vítima. Estudar o ataque não exige ' +
      'participar dele.',
    categoria: 'seguranca',
    tags: ['honeypot', 'ddos', 'reflexao', 'heralding', 'blue-team'],
  },
  {
    id: 'proj-2026-11-14-sessao-atacante',
    data: '2026-11-14',
    titulo: 'Ver o ataque inteiro, não só o login',
    descricao:
      'Com o honeypot repassando o SSH para um Linux real, os bots passaram a mostrar o ataque completo, mas o Radar ' +
      'exibia cada evento solto. Agora a ficha de qualquer evento conta a sessão inteira: quanto tempo ficou, quantas senhas ' +
      'tentou, como entrou e cada comando classificado pela intenção. O padrão que apareceu nos dados reais é quase um ' +
      'roteiro: reconhecimento (uname, nproc, contagem de CPUs), teste de sudo com a senha recém-descoberta, envio de um ' +
      'binário por SCP, permissão de execução, execução com sudo e, por fim, apagar o arquivo. Alguns bots ainda tentam usar ' +
      'o próprio SSH como túnel para a internet, só para saber se a máquina tem saída. Lição: o login é o começo; a ' +
      'sequência de comandos é que revela o objetivo (aqui, cara de minerador) e o hash do binário leva à família do malware.',
    categoria: 'aprendizado',
    tags: ['honeypot', 'cowrie', 'radar', 'mitre', 'malware'],
  },
  {
    id: 'proj-2026-11-13-bot-testa-honeypot',
    data: '2026-11-13',
    titulo: 'O bot que testou se o honeypot era de verdade',
    descricao:
      'Um "login aceito" no Radar assusta, mas no honeypot ele é a isca funcionando: a senha é aceita de propósito e o ' +
      'atacante cai num shell simulado. O interessante foi o que veio depois. Um dos bots não rodou nenhum malware: ' +
      'disparou dezenas de comandos de verificação (contas aritméticas no shell, PID do processo, funções, subshells, ' +
      'leitura de /proc/self/stat) e conferiu as respostas. É uma checagem anti-honeypot: se o shell não se comporta como ' +
      'um Linux real, o bot vai embora sem entregar o payload. Lição para o blue team: o comportamento pós-login diz mais ' +
      'do que o login em si, e um honeypot de baixa interação mostra o reconhecimento, mas nem sempre o ataque completo. ' +
      'No app, o Radar passou a mostrar o horário local, o comando de cada evento e a marcação de isca.',
    categoria: 'aprendizado',
    tags: ['honeypot', 'cowrie', 'anti-honeypot', 'blue-team'],
  },
  {
    id: 'proj-2026-11-13-radar-wazuh',
    data: '2026-11-13',
    titulo: 'Honeypot exposto de propósito, e o Radar aprendendo com o Wazuh',
    descricao:
      'O caminho foi inverso ao de costume: primeiro ficar exposto à internet, estudar os ataques reais e só depois ' +
      'reproduzi-los no range. O honeypot (Cowrie e Dionaea) ganhou uma VLAN própria sem nenhuma saída, nem para a ' +
      'internet nem para a rede interna, e a entrada fecha sozinha por um agendamento no firewall. O primeiro bot chegou em ' +
      'cerca de dois minutos, entrou por Telnet com admin/admin e testou os comandos típicos de botnet de IoT. Como o ' +
      'honeypot não pode falar com o app, o Wazuh virou o ponto central: recebe honeypot, firewall e Sysmon do Windows, ' +
      'aplica regras próprias com a técnica MITRE e um coletor leva os alertas ao Radar. O Radar passou a usar a técnica ' +
      'que vem da regra, e não só um mapeamento fixo por tipo de ação, então a matriz ATT&CK mostra o que de fato foi visto. ' +
      'Antes de abrir qualquer porta, foi preciso fechar a administração do firewall e o RDP que estavam acessíveis pela WAN.',
    categoria: 'seguranca',
    tags: ['honeypot', 'wazuh', 'mitre-attack', 'blue-team', 'radar'],
  },
  {
    id: 'proj-2026-11-13-cofre-2fa',
    data: '2026-11-13',
    titulo: 'Segundo fator no Cofre, conferido pelo servidor',
    descricao:
      'O Cofre vivia só no navegador, protegido pela senha-mestra. Para abrir em qualquer aparelho sem enfraquecer nada, ' +
      'ganhou um segundo fator TOTP (Google Authenticator). A lição: 2FA só no front é teatro, porque o segredo do código ' +
      'ficaria no mesmo lugar que o cofre. Quem confere o código é o servidor, que só então entrega o blob, ainda cifrado; ' +
      'a senha-mestra nunca sai do navegador. São três camadas independentes: identidade no proxy, código no celular e ' +
      'senha-mestra. Ativar e enviar o cofre acontecem numa única operação atômica, o mesmo código não vale duas vezes, ' +
      'cinco erros bloqueiam com espera crescente, os códigos de recuperação ficam só como hash e todo acesso vira evento ' +
      'de auditoria. O TOTP foi implementado com a biblioteca de criptografia nativa e validado contra os vetores da RFC 6238.',
    categoria: 'seguranca',
    tags: ['2fa', 'totp', 'cofre', 'zero-knowledge'],
  },
  {
    id: 'proj-2026-11-13-acessos-ficha',
    data: '2026-11-13',
    titulo: 'Acessos e integrações saem do caminho do inventário',
    descricao:
      'O mapa de onde ficam endereços e credenciais abria por padrão, com duas tabelas largas, entre o cabeçalho e os ' +
      'indicadores do inventário. Virou uma barra de uma linha com o essencial (integrações prontas, estado do cofre, ' +
      'variáveis preenchidas), que fica destacada só quando há algo a resolver; o detalhe abre numa ficha lateral, com ' +
      'cartões por integração e as variáveis faltantes marcadas.',
    categoria: 'funcionalidade',
    tags: ['ux', 'inventario', 'segredos'],
  },
  {
    id: 'proj-2026-11-13-agents-ciclo',
    data: '2026-11-13',
    titulo: 'Home de Agents guiada pelo ciclo de vida',
    descricao:
      'A lista de agentes mostrava contagens, mas não dizia o que fazer. Cada cartão agora traz a trilha projeto → ' +
      'execução → avaliação → ativo e um próximo passo clicável (decidir uma ação pendente, resolver pendência grave, ' +
      'testar no playground, registrar casos de teste, ativar). Ações de escrita esperando aprovação sobem para o topo ' +
      'e abrem direto a execução parada. Modelos viraram um diálogo de criação, a tela vazia virou um onboarding, e ' +
      'entraram busca, filtro por status e os tetos diários de execução.',
    categoria: 'funcionalidade',
    tags: ['ux', 'agentes', 'human-in-the-loop'],
  },
  {
    id: 'proj-2026-11-13-filtro-tipos',
    data: '2026-11-13',
    titulo: 'Filtro por tipo de ativo em cartões',
    descricao:
      'Com a rede real importada, o gráfico de barras por tipo ficou dominado pelas regras do firewall e escondia o ' +
      'resto. Virou um painel de cartões agrupados por família (computação, rede e segurança, estações e dispositivos, ' +
      'serviços), com ícone, contagem e barra proporcional; um clique filtra a lista e o seletor duplicado saiu da barra.',
    categoria: 'funcionalidade',
    tags: ['ux', 'inventario'],
  },
  {
    id: 'proj-2026-11-13-descoberta-rede',
    data: '2026-11-13',
    titulo: 'O inventário passou a vir da própria rede',
    descricao:
      'Em vez de digitar o ambiente, o inventário agora nasce dos equipamentos, só com leitura: concessões DHCP, tabela ' +
      'ARP e detecção de dispositivos do firewall, tabela MAC do switch e configuração das máquinas virtuais. Juntando ' +
      'tudo pelo MAC apareceram coisas que não estavam documentadas: um servidor físico com placa de gerência ligada à ' +
      'rede errada, um equipamento embarcado sem nome, o ponto de acesso fora da porta reservada para ele e descrições ' +
      'de porta desatualizadas. O inventário ganhou tipos novos (servidor físico, ponto de acesso, estação e ' +
      'dispositivo), e os dados reais entram por arquivo, sem passar pelo repositório público. Lição: o que a rede vê ' +
      'é o inventário de verdade; a documentação é só a intenção.',
    categoria: 'funcionalidade',
    tags: ['inventario', 'descoberta', 'rede', 'gestao-de-ativos'],
  },
  {
    id: 'proj-2026-11-13-mapa-acessos',
    data: '2026-11-13',
    titulo: 'Primeira ação real do agente, recusada pelo armazenamento, e um mapa de onde ficam os segredos',
    descricao:
      'O primeiro pedido de snapshot passou pela tela de aprovação e chegou ao hipervisor, que recusou: uma das réplicas ' +
      'do disco não estava sincronizada, e o armazenamento replicado só tira snapshot com todas em dia. O fluxo do agente ' +
      'funcionou; o que falhou foi a infraestrutura, e de um jeito seguro, desfazendo tudo sozinha. O erro chegava como ' +
      'um bloco enorme, então a ferramenta passou a extrair a mensagem que importa e a sugerir o próximo passo. Na mesma ' +
      'rodada, a tela do ambiente ganhou um painel que diz onde fica cada endereço e cada credencial (inventário, cofre ' +
      'cifrado, variáveis do laboratório e segredos do servidor) e como cada integração se conecta, sem mostrar nenhum ' +
      'segredo, com teste automatizado garantindo isso. Lições: testar escrita numa máquina descartável, nunca na que ' +
      'hospeda o próprio sistema; e saber onde mora cada segredo é metade da gestão de acesso.',
    categoria: 'seguranca',
    tags: ['agentes', 'armazenamento', 'gestao-de-acesso', 'incidente'],
  },
  {
    id: 'proj-2026-11-13-agents-aprovacao',
    data: '2026-11-13',
    titulo: 'O agente ganhou mãos, e cada gesto passa por uma tela de consentimento',
    descricao:
      'O agente do hipervisor leu o laboratório de verdade pela primeira vez, e em seguida ganhou ações: ligar, desligar ' +
      'e reiniciar máquinas, criar, reverter e apagar snapshots. Nenhuma roda direto. Quando o modelo pede uma ação de ' +
      'escrita, o servidor valida os parâmetros, monta um resumo em uma frase a partir deles, grava o pedido e para. A ' +
      'tela mostra o resumo e os parâmetros; só a minha decisão retoma a execução, e o que roda é o que o servidor ' +
      'guardou, não o que o navegador mandou de volta. Dois cliques não executam duas vezes, ação negada volta ao modelo ' +
      'como recusa, e cada passo registra quem decidiu e quando. O fluxo ganhou testes automatizados com banco, modelo ' +
      'e hipervisor simulados. Lição: aprovação humana só vale se for o servidor que a impõe; um botão na tela, sozinho, ' +
      'não protege nada.',
    categoria: 'seguranca',
    tags: ['agentes', 'aprovacao-humana', 'virtualizacao', 'testes'],
  },
  {
    id: 'proj-2026-11-13-agents-proxmox-leitura',
    data: '2026-11-13',
    titulo: 'O agente aprendeu a ler o hipervisor',
    descricao:
      'O primeiro teste do playground em produção funcionou, e veio a segunda etapa: cinco ferramentas de leitura do ' +
      'hipervisor (hosts, máquinas virtuais, configuração, snapshots e armazenamento) e um agente modelo que responde ' +
      'sobre o laboratório consultando na hora. O modelo só enxerga nome, descrição e parâmetros de cada ferramenta; o ' +
      'token de API e o endereço ficam no servidor. Os parâmetros que entram no caminho da consulta têm formato ' +
      'restrito, e a conexão confia na autoridade certificadora do próprio cluster em vez de desligar a verificação. ' +
      'Lição: várias funções estreitas, cada uma com uma descrição clara, valem mais que uma ferramenta genérica.',
    categoria: 'funcionalidade',
    tags: ['agentes', 'virtualizacao', 'tool-use', 'tls'],
  },
  {
    id: 'proj-2026-11-13-origem-csrf',
    data: '2026-11-13',
    titulo: 'A proteção contra CSRF que bloqueou o próprio dono',
    descricao:
      'No primeiro teste do playground em produção, criar um agente devolveu "Origem não permitida". A checagem de ' +
      'origem das rotas de gravação comparava o cabeçalho do navegador com uma variável de ambiente por igualdade ' +
      'exata, então qualquer diferença de formato na variável derrubava todas as gravações. A comparação passou a ser ' +
      'feita com as origens normalizadas e também aceita a mesma origem do próprio pedido, o que continua barrando ' +
      'sites externos. Cada recusa agora fica registrada com a origem recebida e as esperadas. Lição: um controle de ' +
      'segurança que falha fechado precisa dizer por que falhou, senão o diagnóstico vira adivinhação.',
    categoria: 'seguranca',
    tags: ['csrf', 'api', 'diagnostico', 'producao'],
  },
  {
    id: 'proj-2026-11-13-agents-playground',
    data: '2026-11-13',
    titulo: 'Os agentes saíram do papel: playground que mostra cada volta do laço',
    descricao:
      'O menu Agents só projetava; agora executa. O servidor roda o laço (o modelo pede uma ferramenta, o servidor ' +
      'valida os parâmetros, executa e devolve o resultado como dado) em segundo plano e grava cada passo, e a tela ' +
      'mostra o raciocínio resumido, a ferramenta chamada, o que voltou e quantos tokens custou. Começa só com ' +
      'ferramentas de leitura e com teto de chamadas e de tokens por execução. Decisão: no laboratório os agentes vão ' +
      'operar o hipervisor, o firewall e o switch com permissão ampla, mas toda ação de escrita vai passar por uma tela ' +
      'de aprovação validada no servidor. Lição: um agente é um laço simples; a segurança está em quem executa as ' +
      'ferramentas, e esse alguém nunca é o modelo.',
    categoria: 'funcionalidade',
    tags: ['agentes', 'ia', 'tool-use', 'automacao'],
  },
  {
    id: 'proj-2026-11-12-confirmado-em',
    data: '2026-11-12',
    titulo: 'Inventário com prazo de validade: toda informação tem data de confirmação',
    descricao:
      'Ativos do ambiente e credenciais do cofre passaram a registrar quando foram conferidos pela última vez e de onde ' +
      'veio a confirmação. Depois de 90 dias o registro aparece como "vale conferir de novo". O inventário, as variáveis ' +
      'do laboratório e o cofre ganharam importação por arquivo, o que permite carregar o que foi lido direto dos ' +
      'equipamentos por um acesso somente leitura, sem que nenhum dado real passe pelo repositório. Lição: documentação ' +
      'de rede sem data envelhece em silêncio; com data, dá para saber em que confiar.',
    categoria: 'funcionalidade',
    tags: ['inventario', 'cofre', 'documentacao', 'automacao'],
  },
  {
    id: 'proj-2026-11-12-range-prompts',
    data: '2026-11-12',
    titulo: 'Cada etapa do range virou um plano executável: recursos exatos e prompt pronto',
    descricao:
      'O checklist do range vulnerável agora diz, etapa por etapa, o que precisa existir no ambiente (VLAN, objetos e ' +
      'regras de firewall, máquinas virtuais, aplicações, snapshots) com nomes padronizados. Cada etapa traz um prompt de ' +
      'IA já montado com o contexto do laboratório, as regras de isolamento e o formato de resposta (pré-requisitos, ' +
      'comandos, validação e rollback); dá para marcar pedidos extras ou editar antes de copiar. Os dados reais do ' +
      'ambiente ficam só no navegador, fora do repositório. Lição do desenho: tráfego entre máquinas do mesmo segmento ' +
      'não passa pelo firewall nem pelo espelhamento do switch, então isso precisa ser decidido antes de criar regras.',
    categoria: 'funcionalidade',
    tags: ['range', 'ia', 'documentacao', 'segmentacao'],
  },
  {
    id: 'proj-2026-11-12-ferramentas-registros',
    data: '2026-11-12',
    titulo: 'Caderno de campo por ferramenta: testes, observações e pendências',
    descricao:
      'Cada ferramenta do arsenal ganhou um histórico próprio: registro do teste feito em ambiente autorizado, ' +
      'resultado (funcionou, parcial, não funcionou), relato com a evidência e o próximo passo. O card mostra ' +
      'quantos registros e pendências existem. A ideia é transformar "já usei essa ferramenta" em prática documentada.',
    categoria: 'funcionalidade',
    tags: ['pentest', 'documentacao', 'pratica'],
  },
  {
    id: 'proj-2026-11-12-ui-tinybase',
    data: '2026-11-12',
    titulo: 'Interface com padrão de painel corporativo: menos cor, mais hierarquia',
    descricao:
      'O app ganhou o visual de um painel interno de TI: barra superior com breadcrumb, menu lateral em seções, ' +
      'tabela e diálogos com cabeçalho na cor da marca e um sistema de "tons" de estado no lugar de cores soltas. ' +
      'A regra que mais mudou as telas: cor só onde há ação a tomar, e cada informação aparece uma vez. ' +
      'A tela de inventário virou a referência — indicadores que filtram, gráfico clicável, ficha lateral com ' +
      'navegação por teclado e formulário em blocos com prévia ao vivo.',
    categoria: 'funcionalidade',
    tags: ['ux', 'design-system', 'react'],
  },
  {
    id: 'proj-2026-11-10-linkedin-servidor',
    data: '2026-11-10',
    titulo: 'Tudo no servidor: LinkedIn no PostgreSQL e IA dentro da API',
    descricao:
      'O módulo LinkedIn saiu do navegador: posts, análises, estratégia, diário e rascunhos agora vivem no ' +
      'PostgreSQL do homelab e entram no backup cifrado. A IA passou a rodar na API, com a chave guardada como ' +
      'segredo do servidor — o navegador nunca vê a chave. Organizar um post virou uma única operação: analisar ' +
      'e gravar a nota no Segundo Cérebro.',
    categoria: 'decisao',
    tags: ['self-hosted', 'segredos', 'arquitetura'],
  },
  {
    id: 'proj-2026-11-10-pentest-range',
    data: '2026-11-10',
    titulo: 'Próximo capítulo: o app vira campo de testes de pentest',
    descricao:
      'Visão combinada: quando a plataforma estiver pronta, ela mesma será alvo autorizado de pentest no homelab — ' +
      'atacar a própria aplicação (Red), detectar no Radar/Wazuh (Blue) e documentar a comparação (Purple). ' +
      'Estudo, carreira e prática no mesmo lugar.',
    categoria: 'plano',
    tags: ['pentest', 'purple-team', 'visao'],
  },
  {
    id: 'proj-2026-11-10-linkedin-ia',
    data: '2026-11-10',
    titulo: 'Módulo LinkedIn vira estúdio de conteúdo com IA',
    descricao:
      'Registro dos posts publicados (manual ou importando o export oficial do LinkedIn), análise de cada post pelo ' +
      'Claude (pilar, temas, tópicos de estudo relacionados, aprendizados, ideias derivadas) e envio ao Segundo ' +
      'Cérebro. Rascunhos novos são gerados com o contexto do que já publiquei, do que estudei e deste diário. ' +
      'A chave da API fica cifrada no Cofre e nenhum dado do inventário é enviado à IA.',
    categoria: 'funcionalidade',
    tags: ['linkedin', 'ia', 'claude', 'segundo-cerebro'],
  },
  {
    id: 'proj-2026-11-10-licao-segredo-chat',
    data: '2026-11-10',
    titulo: 'Lição: segredo colado em chat de IA é segredo vazado',
    descricao:
      'Uma senha de banco apareceu numa conversa durante o desenvolvimento. Regra adotada: tratar como comprometida ' +
      'e rotacionar, mesmo sem evidência de abuso. Vale para qualquer ferramenta de IA no dia a dia de infra.',
    categoria: 'aprendizado',
    tags: ['higiene-de-segredos', 'ia', 'licao'],
  },
  {
    id: 'proj-2026-11-10-testes',
    data: '2026-11-10',
    titulo: 'Testes automatizados nos fluxos críticos',
    descricao: 'Vitest cobrindo criptografia do Cofre, backup/restauração, persistência local, catálogo e matriz ATT&CK.',
    categoria: 'infra',
    tags: ['testes', 'vitest', 'qualidade'],
  },
  {
    id: 'proj-2026-11-10-attack-kev',
    data: '2026-11-10',
    titulo: 'Matriz ATT&CK e catálogo de ameaças (KEV)',
    descricao:
      'Cobertura por técnica — estudada, praticada, detectada e vista no Radar — com exportação para o ATT&CK ' +
      'Navigator. Catálogo CISA KEV filtrado pelos produtos que eu acompanho. Novas trilhas: Resposta a Incidentes ' +
      '& Forense, Análise de Malware (defensiva) e Purple Team, com labs novos.',
    categoria: 'funcionalidade',
    tags: ['mitre-attack', 'kev', 'purple-team'],
  },
  {
    id: 'proj-2026-11-10-segundo-cerebro',
    data: '2026-11-10',
    titulo: 'Segundo Cérebro: notas pesquisáveis com fontes',
    descricao:
      'Notas com busca textual (BM25) que devolve o trecho e a fonte, captura de páginas por URL com proteção ' +
      'anti-SSRF, separação pessoal/corporativo e lixeira com prazo.',
    categoria: 'funcionalidade',
    tags: ['gestao-do-conhecimento', 'bm25', 'ssrf'],
  },
  {
    id: 'proj-2026-11-10-backup-externo',
    data: '2026-11-10',
    titulo: 'Backup externo que o próprio servidor não consegue ler',
    descricao:
      'Exportação do banco cifrada com AES-256-GCM (chave aleatória por backup) e essa chave cifrada com RSA pública. ' +
      'O servidor só cifra; a chave privada fica fora do lab. Destino na nuvem com permissão restrita à pasta do app.',
    categoria: 'seguranca',
    tags: ['backup', 'criptografia', 'menor-privilegio'],
  },
  {
    id: 'proj-2026-11-10-radar',
    data: '2026-11-10',
    titulo: 'Radar de Ataques: as tentativas reais viram material de estudo',
    descricao:
      'Honeypots (Cowrie e OpenCanary) numa VM isolada e descartável, mais logs do firewall e falhas de logon do ' +
      'Windows, chegando à API por um canal com três camadas de autenticação. Cada tentativa vira dado para estudar.',
    categoria: 'seguranca',
    tags: ['honeypot', 'cowrie', 'opencanary', 'blue-team'],
  },
  {
    id: 'proj-2026-11-09-api',
    data: '2026-11-09',
    titulo: 'Do navegador para o servidor: API + PostgreSQL no homelab',
    descricao:
      'API Fastify com Prisma e PostgreSQL rodando no Coolify do homelab, publicada por túnel com controle de acesso ' +
      'por identidade. A API revalida o token de acesso em toda requisição em vez de confiar só na borda.',
    categoria: 'infra',
    tags: ['fastify', 'postgresql', 'coolify', 'zero-trust'],
  },
  {
    id: 'proj-2026-11-09-so-homelab',
    data: '2026-11-09',
    titulo: 'Decisão: dados corporativos ficam fora',
    descricao:
      'O inventário passou a guardar só o meu homelab. Ambiente de empregador não entra num projeto pessoal — ' +
      'nem como referência.',
    categoria: 'decisao',
    tags: ['governanca', 'privacidade'],
  },
  {
    id: 'proj-2026-11-08-refactor',
    data: '2026-11-08',
    titulo: 'Primeira refatoração e o build que não compilava',
    descricao:
      'Código duplicado virou componentes e helpers compartilhados; o build voltou a passar (erros de tipo no Web ' +
      'Crypto). De quebra, um bug que travaria o Cofre com muitos segredos (estouro de pilha no base64) foi corrigido ' +
      'com teste mostrando saída idêntica à anterior.',
    categoria: 'aprendizado',
    tags: ['refatoracao', 'typescript', 'web-crypto'],
  },
  {
    id: 'proj-2026-11-08-cofre',
    data: '2026-11-08',
    titulo: 'Cofre de credenciais cifrado no navegador',
    descricao:
      'AES-GCM com chave derivada por PBKDF2 (310 mil iterações). A senha-mestra nunca é salva; trava por ' +
      'inatividade e ao ocultar a aba; backup leva só o blob cifrado.',
    categoria: 'seguranca',
    tags: ['aes-gcm', 'pbkdf2', 'cofre'],
  },
  {
    id: 'proj-2026-11-08-inicio',
    data: '2026-11-08',
    titulo: 'Nasce a SegInfo Study',
    descricao:
      'Plataforma pessoal para a transição Infraestrutura → Segurança da Informação: trilhas, tópicos, labs ligados ' +
      'ao homelab, sessões, metas, ideias para LinkedIn e cofre. React 19 + Vite + PrimeReact, começando 100% no ' +
      'navegador.',
    categoria: 'funcionalidade',
    tags: ['react', 'vite', 'segundo-cerebro', 'carreira'],
  },
];
