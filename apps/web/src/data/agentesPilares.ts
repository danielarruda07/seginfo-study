/** Os 8 pilares do infográfico "Como construir um agente de IA", com perguntas e checagens práticas. */
export interface Pilar {
  numero: number;
  titulo: string;
  icone: string;
  pergunta: string;
  checklist: string[];
  erroComum: string;
  /** aba do editor onde este pilar é preenchido */
  aba: string;
  topicoId: string;
}

export const PILARES: Pilar[] = [
  {
    numero: 1, titulo: 'Propósito e escopo', icone: 'pi-bullseye', aba: 'Propósito', topicoId: 'ag-proposito',
    pergunta: 'Que problema real isto resolve, para quem, e como vou saber que deu certo?',
    checklist: ['Caso de uso em uma frase', 'Quem usa e do que precisa', 'Critério de sucesso que dá para medir', 'O que o agente NÃO faz'],
    erroComum: 'Começar pela ferramenta (modelo ou framework) antes de definir o problema.',
  },
  {
    numero: 2, titulo: 'Instruções do sistema', icone: 'pi-comment', aba: 'Instruções', topicoId: 'ag-instrucoes',
    pergunta: 'Qual é o papel, o formato de resposta e o que fazer quando não sabe?',
    checklist: ['Papel e objetivos claros', 'Formato de saída definido', 'Como agir na incerteza ("não sei")', 'Limites de segurança explícitos'],
    erroComum: 'Colocar segredos no prompt, ou tratar o prompt como o único controle de segurança.',
  },
  {
    numero: 3, titulo: 'Modelo de linguagem', icone: 'pi-microchip-ai', aba: 'Modelo', topicoId: 'ag-modelo',
    pergunta: 'Qual modelo entrega a qualidade necessária com custo e latência aceitáveis?',
    checklist: ['Testado com os seus casos reais', 'Janela de contexto suficiente', 'Custo por tarefa estimado', 'Latência compatível com a interface'],
    erroComum: 'Usar o maior modelo para tudo, sem medir se um menor resolve.',
  },
  {
    numero: 4, titulo: 'Ferramentas e integrações', icone: 'pi-wrench', aba: 'Ferramentas', topicoId: 'ag-ferramentas',
    pergunta: 'O que o agente consegue fazer no mundo, e com que permissões?',
    checklist: ['Começa em leitura', 'Funções estreitas, não shell nem SQL livres', 'Aprovação humana em escrita', 'Credenciais no servidor, com escopo mínimo'],
    erroComum: 'Entregar uma ferramenta genérica e poderosa "porque é mais fácil".',
  },
  {
    numero: 5, titulo: 'Sistemas de memória', icone: 'pi-database', aba: 'Memória', topicoId: 'ag-memoria',
    pergunta: 'O que precisa ser lembrado, por quanto tempo e com que privacidade?',
    checklist: ['Tipo certo para cada informação', 'Política de retenção', 'Dados sensíveis fora da memória', 'Base de conhecimento com fonte citável'],
    erroComum: 'Guardar tudo para sempre, inclusive dados pessoais e segredos.',
  },
  {
    numero: 6, titulo: 'Orquestração', icone: 'pi-sitemap', aba: 'Orquestração', topicoId: 'ag-orquestracao',
    pergunta: 'Qual é o fluxo, o que dispara e o que acontece quando algo falha?',
    checklist: ['Workflow fixo antes de autonomia', 'Limite de passos, tempo e custo', 'Tentativas seguras (idempotentes)', 'Erro visível, nunca silencioso'],
    erroComum: 'Deixar o agente em laço sem limite de passos nem de gasto.',
  },
  {
    numero: 7, titulo: 'Interface do usuário', icone: 'pi-desktop', aba: 'Interface', topicoId: 'ag-interface',
    pergunta: 'Por onde as pessoas falam com o agente, e quem pode falar?',
    checklist: ['Canal escolhido para o público certo', 'Autenticação e autorização', 'Entrada de terceiros tratada como hostil', 'O usuário vê o que o agente fez'],
    erroComum: 'Ligar o agente a um canal aberto (e-mail, grupo) já com ferramentas de escrita.',
  },
  {
    numero: 8, titulo: 'Testes e avaliações', icone: 'pi-chart-line', aba: 'Avaliações', topicoId: 'ag-avaliacao',
    pergunta: 'Como sei que continua funcionando depois de cada mudança?',
    checklist: ['Casos comuns, de borda e adversariais', 'Métricas de qualidade e de latência', 'Reexecutar ao mudar prompt ou modelo', 'Registrar e comparar resultados'],
    erroComum: 'Avaliar "no olho" uma vez e nunca mais.',
  },
];

export const GLOSSARIO: { termo: string; definicao: string }[] = [
  { termo: 'Workflow', definicao: 'Fluxo em que o modelo e as ferramentas seguem um caminho definido em código. Previsível e barato.' },
  { termo: 'Agente', definicao: 'Sistema em que o modelo decide os próprios passos e o uso de ferramentas. Flexível, mas custa mais e é menos previsível.' },
  { termo: 'RAG', definicao: 'Recuperar trechos relevantes de uma base antes de responder, para fundamentar a resposta e citar fontes.' },
  { termo: 'MCP', definicao: 'Model Context Protocol: padrão aberto para conectar aplicações de IA a dados e ferramentas.' },
  { termo: 'Prompt injection', definicao: 'Texto que altera o comportamento do modelo. Pode vir do usuário (direta) ou de páginas, arquivos e e-mails (indireta).' },
  { termo: 'Agência excessiva', definicao: 'Dar ao agente mais permissões, ferramentas ou autonomia do que a tarefa exige.' },
  { termo: 'Human-in-the-loop', definicao: 'Um humano aprova as decisões críticas antes de elas acontecerem.' },
  { termo: 'Eval', definicao: 'Conjunto de casos de teste com critérios, executado repetidamente para medir qualidade, custo e latência.' },
];

export const RECURSOS_AGENTES = [
  { titulo: 'Building effective agents (Anthropic)', url: 'https://www.anthropic.com/engineering/building-effective-agents', nota: 'Workflows x agentes, quando evitar complexidade. A própria página avisa que parte das ferramentas citadas mudou desde 2024.' },
  { titulo: 'LLM Powered Autonomous Agents (Lilian Weng)', url: 'https://lilianweng.github.io/posts/2023-06-23-agent/', nota: 'Planejamento, memória e uso de ferramentas.' },
  { titulo: 'Model Context Protocol', url: 'https://modelcontextprotocol.io', nota: 'Documentação do padrão MCP.' },
  { titulo: 'OWASP LLM01: Prompt Injection', url: 'https://genai.owasp.org/llmrisk/llm01-prompt-injection/', nota: 'Ataque e mitigações.' },
  { titulo: 'OWASP Top 10 para aplicações de LLM', url: 'https://genai.owasp.org/llm-top-10/', nota: 'Lista dos principais riscos.' },
  { titulo: 'NIST AI Risk Management Framework', url: 'https://www.nist.gov/itl/ai-risk-management-framework', nota: 'Gestão de risco de sistemas de IA.' },
];
