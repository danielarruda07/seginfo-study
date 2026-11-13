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
