import type { Topico } from '@seginfo/shared';

const BEA = 'https://www.anthropic.com/engineering/building-effective-agents';
const MCP = 'https://modelcontextprotocol.io';
const LLM01 = 'https://genai.owasp.org/llmrisk/llm01-prompt-injection/';
const LLM10 = 'https://genai.owasp.org/llm-top-10/';
const RMF = 'https://www.nist.gov/itl/ai-risk-management-framework';
const WENG = 'https://lilianweng.github.io/posts/2023-06-23-agent/';

export const TOPICOS_AGENTES: Topico[] = [
  {
    id: 'ag-proposito', trilhaId: 'agentes', titulo: 'Propósito e escopo', nivel: 'basico',
    resumo: 'Defina o que o agente faz, para quem, e principalmente o que ele não faz. Escopo estreito torna o agente testável e seguro.',
    conceitosChave: ['Problema e usuário', 'Limites do que NÃO faz', 'Critério de sucesso mensurável', 'Workflow vs agente autônomo', 'Nível de autonomia'],
    ferramentas: [{ nome: 'Building effective agents', descricao: 'Guia sobre quando usar workflows e quando usar agentes.', referencia: 'mercado', url: BEA }],
    recursos: [{ titulo: 'Building effective agents (Anthropic)', url: BEA, tipo: 'artigo' }],
    tags: ['agentes', 'escopo'],
  },
  {
    id: 'ag-instrucoes', trilhaId: 'agentes', titulo: 'Instruções do sistema', nivel: 'basico',
    resumo: 'O prompt de sistema define papel, tom, regras e formato de saída. Escreva instruções verificáveis e separe dados não confiáveis das instruções.',
    conceitosChave: ['Papel e tom', 'Regras e proibições', 'Formato de saída', 'Exemplos (few-shot)', 'Separar instrução de dado'],
    ferramentas: [{ nome: 'Prompt engineering overview', descricao: 'Boas práticas de prompts da Anthropic.', referencia: 'mercado', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview' }],
    recursos: [{ titulo: 'Building effective agents (Anthropic)', url: BEA, tipo: 'artigo' }],
    tags: ['agentes', 'prompt'],
  },
  {
    id: 'ag-modelo', trilhaId: 'agentes', titulo: 'Modelo de linguagem', nivel: 'basico',
    resumo: 'Escolha o modelo pelo equilíbrio entre qualidade, latência, custo e privacidade. Modelo local reduz exposição de dados; modelo em nuvem costuma ter mais capacidade.',
    conceitosChave: ['Janela de contexto', 'Custo por token', 'Latência', 'Temperatura', 'Modelo local vs nuvem'],
    ferramentas: [{ nome: 'Ollama', descricao: 'Executa modelos abertos localmente.', referencia: 'open_source', url: 'https://ollama.com' }],
    recursos: [{ titulo: 'LLM Powered Autonomous Agents', url: WENG, tipo: 'artigo' }],
    tags: ['agentes', 'llm'],
  },
  {
    id: 'ag-ferramentas', trilhaId: 'agentes', titulo: 'Ferramentas e integrações', nivel: 'intermediario',
    resumo: 'Ferramentas dão ação ao agente. Aplique privilégio mínimo, separe leitura de escrita e exija aprovação humana para ações que alteram algo.',
    conceitosChave: ['Function calling', 'Privilégio mínimo', 'Leitura vs escrita', 'Aprovação humana', 'Model Context Protocol (MCP)'],
    ferramentas: [{ nome: 'Model Context Protocol', descricao: 'Padrão aberto para conectar agentes a ferramentas e dados.', referencia: 'open_source', url: MCP }],
    recursos: [{ titulo: 'Model Context Protocol', url: MCP, tipo: 'doc' }],
    tags: ['agentes', 'ferramentas', 'mcp'],
  },
  {
    id: 'ag-memoria', trilhaId: 'agentes', titulo: 'Sistemas de memória', nivel: 'intermediario',
    resumo: 'Memória de curto prazo é o contexto da conversa; a de longo prazo é uma base consultada sob demanda. Decida o que guardar e o que nunca entra.',
    conceitosChave: ['Contexto vs memória persistente', 'Busca (BM25 / vetorial)', 'Resumo de conversas', 'Dados sensíveis fora da base', 'Retenção'],
    ferramentas: [{ nome: 'pgvector', descricao: 'Extensão de vetores para PostgreSQL.', referencia: 'open_source', url: 'https://github.com/pgvector/pgvector' }],
    recursos: [{ titulo: 'LLM Powered Autonomous Agents (memória)', url: WENG, tipo: 'artigo' }],
    tags: ['agentes', 'memoria', 'rag'],
  },
  {
    id: 'ag-orquestracao', trilhaId: 'agentes', titulo: 'Orquestração', nivel: 'avancado',
    resumo: 'Padrões para combinar chamadas: encadeamento, roteamento, paralelização, orquestrador e trabalhadores. Comece simples e só aumente a complexidade se medir ganho.',
    conceitosChave: ['Prompt chaining', 'Roteamento', 'Paralelização', 'Orquestrador-trabalhadores', 'Limite de passos e custo'],
    ferramentas: [{ nome: 'Building effective agents', descricao: 'Catálogo de padrões de workflow e agentes.', referencia: 'mercado', url: BEA }],
    recursos: [{ titulo: 'Building effective agents (Anthropic)', url: BEA, tipo: 'artigo' }],
    tags: ['agentes', 'orquestracao'],
  },
  {
    id: 'ag-interface', trilhaId: 'agentes', titulo: 'Interface do usuário', nivel: 'intermediario',
    resumo: 'Por onde o usuário fala com o agente (chat, CLI, API, e-mail). Canais com entrada de terceiros aumentam o risco de injeção de prompt.',
    conceitosChave: ['Canal de entrada', 'Mostrar o que o agente fez', 'Pedir confirmação', 'Entrada de terceiros é não confiável'],
    ferramentas: [{ nome: 'OWASP Top 10 for LLM Apps', descricao: 'Riscos comuns em aplicações com LLM.', referencia: 'owasp', url: LLM10 }],
    recursos: [{ titulo: 'OWASP Top 10 for LLM Applications', url: LLM10, tipo: 'doc' }],
    tags: ['agentes', 'interface'],
  },
  {
    id: 'ag-avaliacao', trilhaId: 'agentes', titulo: 'Testes e avaliações', nivel: 'intermediario',
    resumo: 'Monte um conjunto de casos com critério claro (inclusive casos de ataque), rode a cada mudança e registre o resultado. Sem avaliação não há como saber se melhorou.',
    conceitosChave: ['Conjunto de casos', 'Critério de aprovação', 'Casos adversariais', 'Regressão', 'Latência e custo'],
    ferramentas: [{ nome: 'NIST AI RMF', descricao: 'Framework de gestão de risco de IA.', referencia: 'nist', url: RMF }],
    recursos: [{ titulo: 'NIST AI Risk Management Framework', url: RMF, tipo: 'doc' }],
    tags: ['agentes', 'avaliacao'],
  },
  {
    id: 'ag-seguranca', trilhaId: 'agentes', titulo: 'Segurança de agentes (injeção de prompt)', nivel: 'avancado',
    resumo: 'Conteúdo lido pelo agente pode conter instruções maliciosas. Limite ferramentas, valide saídas, isole dados e mantenha supervisão humana nas decisões críticas.',
    conceitosChave: ['Injeção de prompt direta e indireta', 'Excesso de agência', 'Exfiltração de dados', 'Rastreabilidade (logs)', 'Supervisão humana'],
    ferramentas: [{ nome: 'OWASP LLM01: Prompt Injection', descricao: 'Descrição do risco e mitigações.', referencia: 'owasp', url: LLM01 }],
    recursos: [
      { titulo: 'OWASP LLM01: Prompt Injection', url: LLM01, tipo: 'doc' },
      { titulo: 'OWASP Top 10 for LLM Applications', url: LLM10, tipo: 'doc' },
    ],
    tags: ['agentes', 'seguranca', 'owasp'],
  },
];
