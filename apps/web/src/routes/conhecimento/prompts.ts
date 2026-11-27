/**
 * Prompts prontos para colar no Claude Code (sua assinatura) dentro da cópia descartável que
 * scripts/varredura-local.ps1 abre. Os do plugin chamam as skills oficiais do claude-security;
 * os de aplicação fazem o Claude raciocinar sobre o código com regras fixas de só-leitura.
 * Tudo que for gravado vai para CLAUDE-SECURITY-*, a pasta que o script coleta no fim.
 */

export type CategoriaPrompt = 'preparo' | 'plugin' | 'aplicacao' | 'endpoint';
export type Custo = 'baixo' | 'medio' | 'alto';

export const CATEGORIAS: { id: CategoriaPrompt; titulo: string; descricao: string }[] = [
  { id: 'preparo', titulo: '1. Preparar', descricao: 'Abrir a cópia descartável do repositório local no Claude Code.' },
  { id: 'plugin', titulo: '2. Varredura com o plugin oficial', descricao: 'Skills do claude-security: varredura verificada por agentes, com SARIF, CWE e patches.' },
  { id: 'aplicacao', titulo: '3. Pentest de aplicação (código)', descricao: 'Análises dirigidas que o scanner não faz: autorização, dinheiro, Web3, integrações.' },
  { id: 'endpoint', titulo: '4. Endpoints e APIs (caixa-preta)', descricao: 'Planejar e interpretar testes nas URLs publicadas.' },
];

/** Regras coladas no fim de todo prompt de análise: o que garante só-leitura e sigilo. */
export const REGRAS = [
  'REGRAS (obrigatórias): teste autorizado por escrito; trate o código como de cliente e confidencial.',
  '- Só leitura: não execute código do projeto, testes, build nem instaladores; não acesse a rede.',
  '- Não faça commit, push, branch, tag, nem altere remotes ou configuração do git. Não use gh.',
  '- Não altere arquivos do projeto. Grave somente dentro da pasta CLAUDE-SECURITY-ANALISES/.',
  '- Nunca mostre valores de segredos: cite o nome da variável e arquivo:linha e escreva "valor presente".',
  '- Todo achado com arquivo:linha, severidade (crítica/alta/média/baixa), CWE, cenário de exploração e correção.',
  '- Marque como "a confirmar" o que depender de configuração de produção que você não vê.',
].join('\n');

export interface PromptPronto {
  id: string;
  titulo: string;
  categoria: CategoriaPrompt;
  /** skill do plugin chamada pelo prompt, quando houver */
  skill?: string;
  quando: string;
  custo: Custo;
  texto: string;
  /** acrescenta REGRAS ao copiar */
  comRegras?: boolean;
  aviso?: string;
}

const saida = (arquivo: string) => `Grave o resultado em CLAUDE-SECURITY-ANALISES/${arquivo} e mostre um resumo no fim.`;

export const PROMPTS: PromptPronto[] = [
  // ---------- preparo ----------
  {
    id: 'abrir-copia', titulo: 'Abrir o repositório local com segurança', categoria: 'preparo', custo: 'baixo',
    quando: 'Sempre, antes de qualquer prompt abaixo. Rode no PowerShell, na pasta do SegInfo.',
    texto: 'scripts\\varredura-local.ps1 -Repo C:\\temp\\<repositorio>\n# para revisar uma branch:\nscripts\\varredura-local.ps1 -Repo C:\\temp\\<repositorio> -Branch <branch>',
    aviso: 'O script cria uma cópia sem push, abre o Claude Code nela, coleta o relatório para %USERPROFILE%\\SegInfo-Confidencial e confere que o original não mudou. No Windows o plugin não tem sandbox: use só em código autorizado.',
  },
  // ---------- plugin ----------
  {
    id: 'scan-alto', titulo: 'Varredura completa — esforço alto', categoria: 'plugin', skill: '/claude-security:claude-security', custo: 'alto',
    quando: 'Laudo de cliente. Até 48 componentes, dois pesquisadores em cada e passada nas fronteiras entre eles.',
    texto: '/claude-security:claude-security scan this whole repository at high effort; I understand it may take a while and use a significant number of tokens',
  },
  {
    id: 'scan-medio', titulo: 'Varredura completa — esforço médio', categoria: 'plugin', skill: '/claude-security:claude-security', custo: 'medio',
    quando: 'Primeira passada num repositório grande, para calibrar custo e tempo.',
    texto: '/claude-security:claude-security scan this whole repository at medium effort; I understand it may take a while and use a significant number of tokens',
  },
  {
    id: 'scan-escopo', titulo: 'Varredura de uma parte (módulo crítico)', categoria: 'plugin', skill: '/claude-security:claude-security', custo: 'medio',
    quando: 'Quando o mapa da aplicação apontou onde está o dinheiro (ex.: saques, carteiras, autenticação).',
    texto: '/claude-security:claude-security scan only <pasta/do/modulo> at high effort, focusing on authentication, authorization, money movement and race conditions',
  },
  {
    id: 'scan-branch', titulo: 'Revisar as mudanças de uma branch (PR)', categoria: 'plugin', skill: '/claude-security:claude-security', custo: 'medio',
    quando: 'Antes de aprovar um PR. Abra o script com -Branch <branch>.',
    texto: '/claude-security:claude-security scan my branch at high',
  },
  {
    id: 'superficie', titulo: 'Análise de superfície de ataque (auditoria longa)', categoria: 'plugin', skill: '/claude-security:attack-surface-analysis', custo: 'alto',
    quando: 'O mais profundo do plugin: redução de superfície padrão, o que é alcançável antes do login e interação de configurações. 1 a 2,5 h.',
    texto: '/claude-security:attack-surface-analysis run a full attack surface analysis of this repository: default attack surface reduction, early (pre-authentication) reachability audit and configuration interaction audit',
  },
  {
    id: 'ameacas', titulo: 'Modelo de ameaças do repositório', categoria: 'plugin', skill: '/claude-security:threat-model', custo: 'medio',
    quando: 'Antes da varredura (melhora a priorização) ou depois, para checar se as precondições de cada achado valem no seu deploy.',
    texto: '/claude-security:threat-model',
  },
  {
    id: 'triagem', titulo: 'Triagem de achados de outra ferramenta', categoria: 'plugin', skill: '/claude-security:claude-security', custo: 'medio',
    quando: 'Você tem um SARIF do Semgrep, CodeQL, Trivy ou de um laudo anterior e quer separar o real do falso positivo.',
    texto: '/claude-security:claude-security triage <caminho/do/arquivo.sarif>',
  },
  {
    id: 'patches', titulo: 'Sugerir patches para os achados', categoria: 'plugin', skill: '/claude-security:claude-security', custo: 'alto',
    quando: 'Depois de uma varredura, para entregar a correção junto do laudo.',
    texto: '/claude-security:claude-security suggest patches for the latest report',
    aviso: 'Nesta etapa os agentes podem tentar rodar os testes do projeto. O script bloqueia npm/pip/docker; se precisar dos testes, faça num ambiente de staging, não na sua máquina.',
  },
  {
    id: 'continuar', titulo: 'Retomar uma varredura interrompida', categoria: 'plugin', skill: '/claude-security:claude-security', custo: 'baixo',
    quando: 'A sessão caiu antes do relatório. Entre na cópia mantida e rode claude --resume.',
    texto: '/claude-security:claude-security continue the scan',
  },
  // ---------- aplicação ----------
  {
    id: 'mapa', titulo: 'Mapa da aplicação e das conexões', categoria: 'aplicacao', custo: 'medio', comRegras: true,
    quando: 'Primeiro passo de todo pentest de aplicação: o que o sistema faz, consome e expõe.',
    texto: 'Faça o mapa de arquitetura e superfície de ataque deste repositório para um pentest:\n1. Propósito, stack e dependências principais (com versões).\n2. Componentes e como se conectam (diagrama em texto).\n3. TODOS os pontos de entrada (HTTP, WebSocket, gRPC, filas, cron, webhooks) com método, caminho e a proteção de autenticação/autorização aplicada — ou a ausência dela.\n4. O que consome de fora: APIs de terceiros, RPC de blockchain, exchanges, pagamento, e-mail/SMS, storage (host e SDK).\n5. Bancos, caches e onde há query montada com string.\n6. Variáveis de ambiente e segredos (só nomes) e o que parece commitado.\n7. Docker/IaC/CI e portas expostas.\n8. As 15 áreas de maior risco, priorizadas, com o que testar em cada.\n' + saida('MAPA-APLICACAO.md'),
  },
  {
    id: 'rotas-scanner', titulo: 'Lista de endpoints para o Scanner', categoria: 'aplicacao', custo: 'baixo', comRegras: true,
    quando: 'Para alimentar o Scanner de endpoints (lote) e os testes caixa-preta com as rotas certas.',
    texto: 'Liste todas as rotas HTTP desta aplicação numa tabela: método, caminho, parâmetros, se exige autenticação, que papel/escopo exige, se é de escrita/transação (NÃO rodar teste ativo nelas) e arquivo:linha do handler. Depois, gere uma lista só das rotas GET de leitura, uma por linha, com o prefixo <https://url-de-staging>, pronta para colar no Scanner em lote. Se não houver spec OpenAPI, gere uma (openapi.yaml) a partir do código.\n' + saida('ROTAS.md (e openapi.yaml, se gerar)'),
  },
  {
    id: 'autorizacao', titulo: 'Matriz de autorização (IDOR / BOLA / BFLA)', categoria: 'aplicacao', custo: 'medio', comRegras: true,
    quando: 'A falha nº 1 em API: um usuário acessa ou altera recurso de outro, ou chama função de admin.',
    texto: 'Monte a matriz de autorização: para cada rota que recebe um identificador (id, userId, walletId, orderId…), mostre onde o código confere que o recurso pertence ao usuário autenticado — ou que não confere. Aponte também rotas administrativas acessíveis por usuário comum, papéis checados só no front, IDs previsíveis e mass assignment (campos como role, balance, status vindos do corpo). Para cada falha: rota, prova no código, cenário de abuso e o caso de teste com dois usuários de staging para confirmar.\n' + saida('AUTORIZACAO.md'),
  },
  {
    id: 'dinheiro', titulo: 'Fluxos de dinheiro e transações', categoria: 'aplicacao', custo: 'alto', comRegras: true,
    quando: 'Sistemas financeiros, cripto e saldo: onde o prejuízo é direto.',
    texto: 'Revise todos os fluxos que movem valor (depósito, saque, transferência, swap, taxa, saldo, reembolso, bônus). Procure: race condition e falta de lock/transação no banco (gasto duplo), ausência de idempotência e replay de requisição, valor negativo/zero/gigante, arredondamento e casas decimais (float, decimals de token), conversão de moeda/preço manipulável, limite diário contornável, estado inconsistente se uma etapa externa falhar no meio, e retentativas que pagam duas vezes. Para cada um: arquivo:linha, sequência do ataque e como confirmar em staging.\n' + saida('FLUXOS-FINANCEIROS.md'),
  },
  {
    id: 'web3', titulo: 'Web3: carteiras, assinaturas e contratos', categoria: 'aplicacao', custo: 'medio', comRegras: true,
    quando: 'Back-ends de exchange/DEX/custódia e integrações on-chain.',
    texto: 'Revise a parte Web3: login por assinatura de carteira (nonce único e com expiração? domínio e chainId na mensagem? replay entre redes?), guarda de chaves privadas e mnemônicos (onde ficam, quem lê, se vão para log), confiança no RPC (valida confirmações e reorg? aceita resposta de RPC sem checar?), cálculo de decimals e slippage, aprovação ilimitada (approve), endereços de contrato vindos do usuário, monitoramento de depósitos (pode creditar duas vezes? aceita token falso com mesmo símbolo?) e varredura/sweep de carteiras. Para cada risco: arquivo:linha e teste de confirmação em testnet.\n' + saida('WEB3.md'),
  },
  {
    id: 'injecao', titulo: 'Injeção (SQL, NoSQL, comando, template, prompt)', categoria: 'aplicacao', custo: 'medio', comRegras: true,
    quando: 'Rastrear entrada do usuário até um ponto perigoso.',
    texto: 'Rastreie cada entrada externa (corpo, query, header, webhook, mensagem de fila, resposta de API de terceiro) até pontos perigosos: SQL/ORM com string montada ou raw, filtros NoSQL vindos do corpo ($where, $ne), execução de comando, template renderizado com entrada, desserialização, caminho de arquivo (path traversal), redirecionamento, SSRF (URL vinda do usuário) e prompt de LLM com texto do usuário. Para cada caminho fonte → sink: arquivo:linha de cada salto, se há validação no meio e um payload benigno para confirmar em staging.\n' + saida('INJECAO.md'),
  },
  {
    id: 'auth', titulo: 'Autenticação, JWT e sessão', categoria: 'aplicacao', custo: 'medio', comRegras: true,
    quando: 'Login, tokens, 2FA, recuperação de senha e chaves de API.',
    texto: 'Revise autenticação e sessão: como o JWT é emitido e validado (algoritmo fixo? aceita none? segredo forte e fora do código? exp/aud/iss checados?), refresh token (rotação, revogação), logout de verdade, 2FA contornável, recuperação de senha (token previsível, sem expiração, enumeração de usuário), força bruta sem limite, chaves de API (escopo, armazenamento em hash) e rotas que esquecem o middleware. Para cada falha: arquivo:linha e teste de confirmação.\n' + saida('AUTENTICACAO.md'),
  },
  {
    id: 'integracoes', titulo: 'Integrações, webhooks e segredos', categoria: 'aplicacao', custo: 'medio', comRegras: true,
    quando: 'O que entra e sai do sistema e com que confiança.',
    texto: 'Liste todas as integrações (entrada e saída). Para webhooks recebidos: a assinatura é validada, com comparação em tempo constante e proteção contra replay? Para chamadas de saída: timeout, TLS verificado, URL fixa ou vinda do usuário (SSRF)? Para segredos: onde são lidos, se vão para log/erro/resposta, se há segredo commitado no histórico (git log -p é permitido, só leitura) e quais precisam de rotação. Nunca mostre os valores.\n' + saida('INTEGRACOES.md'),
  },
  {
    id: 'webhooks-entrada', titulo: 'Webhooks de entrada que movem dinheiro', categoria: 'aplicacao', custo: 'medio', comRegras: true,
    quando: 'Fintech/cripto: provedores (PIX, custódia, cartão) avisam o sistema e ele credita. Um aviso forjado vira saldo.',
    texto: 'Liste todos os webhooks/callbacks de entrada (rotas públicas ou com guard próprio). Para cada um: como autentica (HMAC do corpo cru? segredo estático? segredo na query? nenhum?), se a comparação é em tempo constante, se há janela de timestamp e anti-replay, se a deduplicação é por um id que o atacante controla, se o sistema reconsulta o provedor antes de creditar ou confia no payload (valor, endereço, status), o que acontece com evento fora de ordem (FAILED depois de PAID) e se a verificação pode estar desligada por flag/ambiente. Para cada webhook: arquivo:linha, o efeito financeiro e o payload mínimo para provar em staging.\n' + saida('WEBHOOKS.md'),
  },
  {
    id: 'modos-monitor', titulo: 'Controles em modo "monitor" (só logam)', categoria: 'aplicacao', custo: 'baixo', comRegras: true,
    quando: 'Rollouts graduais deixam autorização, MFA e assinatura em monitor/soft — o código parece seguro, mas não bloqueia.',
    texto: 'Encontre todos os controles de segurança com modo configurável (monitor/soft/hard/enforce, *_MODE, *_ENFORCE, flags em tabela de configuração, kill switches). Para cada um: o que protege, o valor PADRÃO no código e nos seeds/migrations, onde o valor é lido (env, banco, SSM), quem pode mudar em tempo de execução (rota admin?) e o que acontece em cada modo. Monte a tabela "se estiver em monitor, este ataque passa: …" e a lista de valores a confirmar em produção.\n' + saida('MODOS-DE-CONTROLE.md'),
  },
  {
    id: 'laudo', titulo: 'Consolidar o laudo final', categoria: 'aplicacao', custo: 'baixo', comRegras: true,
    quando: 'No fim, para juntar o relatório do plugin e as análises acima.',
    texto: 'Leia o relatório CLAUDE-SECURITY-* mais recente e tudo em CLAUDE-SECURITY-ANALISES/. Consolide num laudo único: sumário executivo para a diretoria (riscos de negócio em linguagem simples), tabela de achados sem duplicatas ordenada por severidade e facilidade de exploração, cadeias de ataque (achados que combinados pioram o impacto), plano de correção em ondas (imediato, 30 e 90 dias) e o que ficou "a confirmar" em staging.\n' + saida('LAUDO-CONSOLIDADO.md'),
  },
  // ---------- endpoint ----------
  {
    id: 'interpretar-scanner', titulo: 'Interpretar o resultado do Scanner', categoria: 'endpoint', custo: 'baixo',
    quando: 'Depois de exportar o relatório do Scanner de endpoints (HTML ou MD).',
    texto: 'Abaixo está o relatório do scanner de um endpoint que tenho autorização para testar. Priorize os achados por risco real, explique o impacto de cada um em linguagem simples, aponte falsos positivos prováveis e me dê os próximos testes manuais (Burp/ZAP) para confirmar os mais graves, sem nada destrutivo.\n\n<cole aqui o relatório>',
  },
  {
    id: 'plano-openapi', titulo: 'Plano de pentest a partir do OpenAPI', categoria: 'endpoint', custo: 'baixo',
    quando: 'Você tem a spec (swagger.json/openapi.yaml) da API do cliente.',
    texto: 'Com base nesta especificação OpenAPI de uma API que tenho autorização para testar, monte o plano de pentest por rota segundo o OWASP API Security Top 10: autorização por objeto (BOLA), autenticação, exposição excessiva de dados, consumo de recursos/rate limit, autorização por função (BFLA), mass assignment, SSRF e configuração. Para cada teste: requisição de exemplo, resultado esperado se seguro e se vulnerável. Marque os testes que NÃO podem rodar em produção (escrita/transação).\n\n<cole a spec ou o caminho do arquivo>',
  },
];

/** Texto final copiado: o prompt mais as regras quando aplicável. */
export function textoParaCopiar(p: PromptPronto): string {
  return p.comRegras ? `${p.texto}\n\n${REGRAS}` : p.texto;
}

export function filtrarPrompts(termo: string, categoria: CategoriaPrompt | null, lista: PromptPronto[] = PROMPTS): PromptPronto[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = norm(termo.trim());
  return lista.filter((p) => (!categoria || p.categoria === categoria) && (!q || norm(`${p.titulo} ${p.quando} ${p.texto} ${p.skill ?? ''}`).includes(q)));
}
