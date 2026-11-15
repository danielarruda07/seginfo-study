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
