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
export const RISCO_COR: Record<Risco, string> = { baixo: '#16a34a', medio: '#f59e0b', alto: '#ef4444' };

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
    id: 'proxmox-leitura', nome: 'Proxmox: consultar nós, VMs, snapshots e armazenamento', categoria: 'infra',
    descricao: 'Lê o estado do hipervisor pela API do Proxmox: hosts, máquinas virtuais, configuração, snapshots e espaço em disco.', risco: 'baixo',
    permissaoSugerida: 'leitura', aprovacaoSugerida: false,
    cuidados: 'O token de API fica só no servidor. Nomes de VM, endereços e configuração vão para o modelo de IA: use apenas com o laboratório.',
  },
  {
    id: 'proxmox-escrita', nome: 'Proxmox: ligar, desligar, reiniciar e gerenciar snapshots', categoria: 'infra',
    descricao: 'Altera o hipervisor pela API do Proxmox: liga, desliga e reinicia VMs, cria, reverte e apaga snapshots.', risco: 'alto',
    permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Cada ação para na tela de aprovação e só roda depois da sua decisão. Reverter e apagar snapshot não têm volta: leia o resumo antes de aprovar.',
  },
  {
    id: 'infra-escrita', nome: 'Alterar infraestrutura (firewall, hipervisor, rede)', categoria: 'infra',
    descricao: 'Aplica mudanças em equipamentos ou VMs.', risco: 'alto',
    permissaoSugerida: 'escrita', aprovacaoSugerida: true,
    cuidados: 'Um agente propõe; um humano aprova e executa. Nunca autônomo em produção, sempre com janela de mudança e plano de volta.',
  },
  {
    id: 'mcp-servidor', nome: 'Servidor MCP', categoria: 'mcp',
    descricao: 'Expõe ferramentas, recursos e prompts por um protocolo aberto.', risco: 'medio',
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
