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
