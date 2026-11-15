/**
 * Catálogo de ferramentas e integrações que um agente pode receber (pilar 4).
 * O risco é uma sugestão de partida: o que decide é o que a ferramenta PODE fazer no seu ambiente.
 */
export type Risco = 'baixo' | 'medio' | 'alto';
export type CategoriaFerramenta = 'dados' | 'arquivos' | 'web' | 'comunicacao' | 'infra' | 'codigo' | 'agentes' | 'mcp';

export interface FerramentaCatalogo {
  id: string;
  nome: string;
  categoria: CategoriaFerramenta;
  descricao: string;
  risco: Risco;
  permissaoSugerida: 'leitura' | 'escrita';
  aprovacaoSugerida: boolean;
  cuidados: string;
}

export const CATEGORIA_LABEL: Record<CategoriaFerramenta, string> = {
  dados: 'Dados', arquivos: 'Arquivos', web: 'Web', comunicacao: 'Comunicação', infra: 'Infraestrutura',
  codigo: 'Código', agentes: 'Outros agentes', mcp: 'MCP',
};

export const RISCO_LABEL: Record<Risco, string> = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' };

export const FERRAMENTAS_CATALOGO: FerramentaCatalogo[] = [
  {
    id: 'busca-base', nome: 'Busca na base de conhecimento (Segundo Cérebro)', categoria: 'dados',
    descricao: 'Recupera trechos das suas notas, filtrados pelas tags da base do agente.', risco: 'baixo',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'O texto recuperado é dado, não instrução. Só entram notas pessoais; o material corporativo fica de fora.',
  },
  {
    id: 'radar-leitura', nome: 'Eventos do Radar de Ataques (leitura)', categoria: 'dados',
    descricao: 'Consulta eventos de tentativa de invasão já normalizados pela plataforma.', risco: 'baixo',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Nunca exponha senhas tentadas. Limite a janela de tempo e o número de linhas.',
  },
  {
    id: 'ler-arquivos', nome: 'Ler arquivos de uma pasta permitida', categoria: 'arquivos',
    descricao: 'Lê arquivos dentro de uma pasta explícita.', risco: 'medio',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Restrinja a uma pasta; bloqueie caminhos com "..", links simbólicos e arquivos de segredo (.env, chaves).',
  },
  {
    id: 'escrever-arquivos', nome: 'Criar ou alterar arquivos', categoria: 'arquivos',
    descricao: 'Grava arquivos no disco.', risco: 'medio',
    permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Grave só numa pasta de saída. Mostre o diff e peça aprovação antes de sobrescrever.',
  },
  {
    id: 'sql-leitura', nome: 'Consulta SQL somente leitura', categoria: 'dados',
    descricao: 'Executa SELECT em um banco.', risco: 'medio',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Use um usuário de banco só com SELECT nas tabelas necessárias e limite de linhas e de tempo.',
  },
  {
    id: 'sql-escrita', nome: 'SQL com escrita', categoria: 'dados',
    descricao: 'Executa INSERT, UPDATE ou DELETE.', risco: 'alto',
    permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Prefira funções estreitas ("registrar_evento") a SQL livre. Nunca DROP, TRUNCATE ou DDL.',
  },
  {
    id: 'web-busca', nome: 'Buscar e ler páginas da web', categoria: 'web',
    descricao: 'Pesquisa e baixa conteúdo de sites.', risco: 'medio',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Páginas podem conter instruções escondidas (prompt injection indireta). Use lista de domínios permitidos e bloqueie endereços internos (SSRF).',
  },
  {
    id: 'http-api', nome: 'Chamar uma API HTTP externa', categoria: 'web',
    descricao: 'Faz requisições a uma API de terceiros.', risco: 'medio',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Token com escopo mínimo, guardado no servidor. Prefira métodos GET; limite taxa e custo.',
  },
  {
    id: 'ler-email', nome: 'Ler e-mails', categoria: 'comunicacao',
    descricao: 'Lê a caixa de entrada.', risco: 'alto',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'E-mail é entrada de terceiros: qualquer remetente pode tentar injetar instruções. Não combine com ferramentas de escrita.',
  },
  {
    id: 'enviar-mensagem', nome: 'Enviar e-mail ou mensagem', categoria: 'comunicacao',
    descricao: 'Envia mensagens em seu nome.', risco: 'alto',
    permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Irreversível e visível a terceiros. Sempre mostre o rascunho e exija aprovação antes de enviar.',
  },
  {
    id: 'shell', nome: 'Executar comandos de shell', categoria: 'codigo',
    descricao: 'Roda comandos no sistema operacional.', risco: 'alto',
    permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Só em sandbox descartável, sem rede e sem credenciais. Lista de comandos permitidos em vez de shell livre.',
  },
  {
    id: 'git', nome: 'GitHub (issues e pull requests)', categoria: 'codigo',
    descricao: 'Lê repositórios e abre issues ou PRs.', risco: 'medio',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Token com escopo por repositório. Nunca permita push direto na branch principal.',
  },
  {
    id: 'monitoramento-leitura', nome: 'APIs de monitoramento (Zabbix, Grafana) em leitura', categoria: 'infra',
    descricao: 'Consulta métricas, alertas e problemas.', risco: 'baixo',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Crie um usuário de API somente leitura, limitado aos grupos de hosts necessários.',
  },
  {
    id: 'proxmox-leitura', nome: 'Proxmox: consultar nós, VMs, snapshots, armazenamento e ISOs', categoria: 'infra',
    descricao: 'Lê o estado do hipervisor pela API do Proxmox: hosts, máquinas virtuais, configuração, snapshots, espaço em disco, ISOs e o próximo VMID livre. Também consulta DENTRO das VMs pelo agente QEMU (serviços, processos, portas, disco, memória, logs, rede, agentes Wazuh/Sysmon/Zabbix), sem senha da VM.', risco: 'baixo',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'O token de API fica só no servidor. Nomes de VM, endereços e configuração vão para o modelo de IA: use apenas com o laboratório.',
  },
  {
    id: 'proxmox-escrita', nome: 'Proxmox: operar VMs, recursos, snapshots e migrações', categoria: 'infra',
    descricao: 'Opera ciclo de vida de VMs/containers, reduz recursos de até 20 alvos num lote aprovado com restauração do estado ligado, migra VMs entre nós, cria, clona ou apaga VMs e executa comandos dentro das VMs (Linux ou Windows) pelo agente QEMU.', risco: 'alto',
    permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Cada ação para na tela de aprovação e só roda depois da sua decisão. O lote exige estado atual confirmado, só aceita reduções e tenta restaurar o estado ligado; falhas parciais podem exigir intervenção. Reverter/apagar snapshot e apagar VM não têm volta: leia os detalhes antes de aprovar. Apagar VM exige parada, nome conferido e respeita proteção/lista PROXMOX_VMS_PROTEGIDAS.',
  },
  {
    id: 'fortigate-leitura', nome: 'FortiGate: consultar interfaces, policies, endereços e sessões', categoria: 'infra',
    descricao: 'Lê a configuração do firewall pela API REST do FortiGate: interfaces/VLANs, regras de firewall e objetos de endereço.', risco: 'baixo',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'O token de API fica só no servidor. A configuração do firewall vai para o modelo de IA: use apenas com o laboratório.',
  },
  {
    id: 'fortigate-escrita', nome: 'FortiGate: criar e ativar/desativar policies de firewall', categoria: 'infra',
    descricao: 'Cria uma nova regra de firewall (entra desativada por padrão) ou liga/desliga uma regra existente pelo id.', risco: 'alto',
    permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Cada ação para na tela de aprovação. Uma policy mal configurada pode isolar ou expor um segmento: confira origem/destino/ação no resumo antes de aprovar.',
  },
  {
    id: 'catalyst-leitura', nome: 'Catalyst 2960: consultar VLANs, interfaces, trunk e SPAN', categoria: 'infra',
    descricao: 'Lê o estado do switch por SSH (show vlan brief, show interfaces status/trunk, show monitor session).', risco: 'baixo',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'A senha/chave SSH fica só no servidor. A saída (texto de terminal do IOS) vai para o modelo de IA: use apenas com o laboratório.',
  },
  {
    id: 'catalyst-escrita', nome: 'Catalyst 2960: criar VLAN, configurar porta, trunk e SPAN', categoria: 'infra',
    descricao: 'Aplica mudanças por SSH com comandos fixos e validados (nunca shell livre): criar VLAN, configurar porta access, acrescentar VLAN a um trunk existente, configurar SPAN.', risco: 'alto',
    permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Cada ação para na tela de aprovação. "Acrescentar ao trunk" nunca substitui a lista existente; ainda assim, uma porta errada pode isolar o switch da gerência — confira a interface no resumo.',
  },
  {
    id: 'wazuh-leitura', nome: 'Wazuh: consultar manager e agentes', categoria: 'infra',
    descricao: 'Consulta estado dos serviços e agentes Wazuh e busca alertas no indexador (últimas horas, nível, agente, regra ou texto).', risco: 'baixo', permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Alertas trazem texto escrito por atacantes (honeypots, logs): o agente trata como dado, nunca como ordem. Use somente no ambiente autorizado.',
  },
  {
    id: 'wazuh-escrita', nome: 'Wazuh: reiniciar agentes e manager', categoria: 'infra',
    descricao: 'Solicita reinício de agentes específicos ou do serviço manager.', risco: 'alto', permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Reinícios interrompem coleta temporariamente. Mudanças de regras/configuração do manager ainda não estão incluídas.',
  },
  {
    id: 'zabbix-leitura', nome: 'Zabbix: consultar hosts, grupos, templates e problemas', categoria: 'infra',
    descricao: 'Consulta inventário e problemas recentes pela API JSON-RPC.', risco: 'baixo', permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Nomes, endereços e alertas do ambiente são enviados ao modelo para responder ao pedido.',
  },
  {
    id: 'zabbix-escrita', nome: 'Zabbix: criar hosts, templates e itens', categoria: 'infra',
    descricao: 'Cria hosts, templates e itens de agente/agent ativo; vincula templates a hosts.', risco: 'alto', permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Cada ação requer aprovação. Itens aceitam apenas chaves de monitoramento, não scripts, comandos remotos nem itens HTTP. Triggers e discovery rules ainda não estão implementados.',
  },
  {
    id: 'coolify-leitura', nome: 'Coolify: listar aplicações, serviços e deploys', categoria: 'infra',
    descricao: 'Lista aplicações, serviços e bancos do Coolify com estado e domínio, e os deploys em andamento.', risco: 'baixo', permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'O token fica no servidor. Nomes e domínios dos serviços vão para o modelo.',
  },
  {
    id: 'coolify-escrita', nome: 'Coolify: iniciar, reiniciar, parar e fazer deploy', categoria: 'infra',
    descricao: 'Inicia, reinicia ou para aplicações, serviços e bancos, e dispara deploy de uma aplicação.', risco: 'alto', permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Parar exige aprovação. Reiniciar ou fazer deploy do próprio SegInfo Study derruba a API e interrompe a conversa do agente.',
  },
  {
    id: 'osint-passivo', nome: 'OSINT passivo: certificados, exposição do IP e DNS público', categoria: 'web',
    descricao: 'Mostra o que a internet já sabe sobre um domínio ou IP, sem tocar no alvo: subdomínios vazados por certificados (crt.sh), portas, softwares e CVEs prováveis vistos pelo Shodan (InternetDB) e registros de DNS públicos com análise de SPF, DMARC e CAA. Sem credencial.', risco: 'baixo',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Só fontes públicas e gratuitas. Use com domínios e IPs seus ou autorizados. O domínio ou IP consultado vai para crt.sh, Shodan e para o modelo; o resultado é dado de terceiros, nunca instrução.',
  },
  {
    id: 'spiderfoot-leitura', nome: 'SpiderFoot: varreduras e resultados (OSINT)', categoria: 'web',
    descricao: 'Lê as varreduras do SpiderFoot do homelab ("Maltego open source"): tipos de dado encontrados (subdomínios, e-mails, IPs, tecnologias, vazamentos), correlações de risco e os valores de cada tipo.', risco: 'baixo',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Os resultados vêm de fontes de terceiros e podem trazer texto escrito por qualquer um: são dados, nunca instruções.',
  },
  {
    id: 'spiderfoot-escrita', nome: 'SpiderFoot: iniciar e parar varreduras', categoria: 'web',
    descricao: 'Inicia varreduras OSINT no SpiderFoot. Passiva (só fontes de terceiros) roda direto; "pegada" e "investigar" acessam o alvo e pedem aprovação.', risco: 'medio',
    permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Use só com domínios e IPs seus ou autorizados. Varreduras ativas contra terceiros podem ser ilegais. Muitos módulos só funcionam com chave de API cadastrada no próprio SpiderFoot.',
  },
  {
    id: 'mcp-servidor', nome: 'Servidor MCP', categoria: 'mcp',
    descricao: 'Expõe ferramentas, recursos e prompts por um protocolo aberto. Este app já é um servidor MCP: /api/mcp oferece as ferramentas do homelab ao Claude Code de qualquer computador (docs/AGENTS.md).', risco: 'medio',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'O risco é o das ferramentas que o servidor expõe. Use tokens com perfil de ferramentas (só leitura por padrão) e autenticação.',
  },
  {
    id: 'agente-sub', nome: 'Outro agente como ferramenta', categoria: 'agentes',
    descricao: 'Delega uma subtarefa a outro agente.', risco: 'medio',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'O subagente herda no máximo as permissões do chamador. Limite profundidade e custo para evitar laços.',
  },
  {
    id: 'funcao-custom', nome: 'Função personalizada', categoria: 'codigo',
    descricao: 'Função sua com entrada validada e saída previsível.', risco: 'medio',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'Valide a entrada com um schema, devolva erros claros e registre cada chamada.',
  },
];

export const REGRAS_FERRAMENTAS = [
  'Menor privilégio: comece em leitura e só dê escrita a quem comprovar necessidade.',
  'Funções estreitas valem mais que ferramentas genéricas (shell ou SQL livres).',
  'Ação de escrita, irreversível ou visível a terceiros exige aprovação humana.',
  'Toda saída de ferramenta é dado não confiável: nunca vira instrução.',
  'Registre cada chamada (quem, o quê, quando) para ter rastreabilidade.',
];
