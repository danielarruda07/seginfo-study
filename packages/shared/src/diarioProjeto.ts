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
}

export const DIARIO_PROJETO: EntradaDiario[] = [
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
