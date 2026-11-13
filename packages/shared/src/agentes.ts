import { z } from 'zod';

/**
 * Módulo Agents: o projeto de um agente de IA, organizado nos 8 pilares
 * (propósito, instruções, modelo, ferramentas, memória, orquestração, interface, avaliação).
 * Aqui ficam o PROJETO, as regras de revisão e os tipos da execução. Quem executa é a API
 * (apps/api/src/agenteRuntime.ts).
 */

export const AgenteStatus = z.enum(['rascunho', 'teste', 'ativo', 'arquivado']);
export type AgenteStatus = z.infer<typeof AgenteStatus>;

export const CANAIS_AGENTE = ['chat', 'web', 'api', 'slack', 'discord', 'telegram', 'whatsapp', 'email'] as const;
export type CanalAgente = (typeof CANAIS_AGENTE)[number];

/** Canais em que pessoas fora do seu controle podem enviar texto ao agente. */
export const CANAIS_ENTRADA_DE_TERCEIROS: readonly CanalAgente[] = ['slack', 'discord', 'telegram', 'whatsapp', 'email'];

const texto = (max: number) => z.string().max(max);

export const AgenteFerramentaSchema = z.object({
  /** id do catálogo (ex.: busca-base) ou "custom" */
  id: z.string().min(1).max(60),
  nome: z.string().min(1).max(80),
  permissao: z.enum(['leitura', 'escrita']),
  /** ação só acontece depois de um humano aprovar */
  exigeAprovacao: z.boolean(),
  observacao: texto(300),
});
export type AgenteFerramenta = z.infer<typeof AgenteFerramentaSchema>;

export const AgenteConfigSchema = z.object({
  proposito: z.object({
    casoDeUso: texto(2000), usuarios: texto(2000), criteriosSucesso: texto(2000), restricoes: texto(2000),
  }),
  instrucoes: z.object({
    papel: texto(500), objetivos: texto(2000), instrucoes: texto(20000), limitesSeguranca: texto(4000),
  }),
  modelo: z.object({
    nome: texto(120), temperatura: z.number().min(0).max(2), janelaContexto: texto(120), custoLatencia: texto(1000),
  }),
  ferramentas: z.array(AgenteFerramentaSchema).max(40),
  memoria: z.object({
    episodica: z.boolean(), trabalho: z.boolean(), vetorial: z.boolean(), sql: z.boolean(), arquivos: z.boolean(),
    privacidade: texto(2000),
  }),
  conhecimento: z.object({
    /** tags do Segundo Cérebro que formam a base de conhecimento do agente */
    tags: z.array(z.string().min(1).max(40)).max(30),
    observacao: texto(1000),
  }),
  orquestracao: z.object({
    fluxo: texto(4000), gatilhos: texto(2000), tratamentoErros: texto(2000), multiAgente: texto(2000),
  }),
  interface: z.object({
    canais: z.array(z.enum(CANAIS_AGENTE)).max(8), notas: texto(2000),
  }),
  supervisao: z.object({
    decisoesCriticas: texto(2000), registroAuditoria: z.boolean(),
  }),
});
export type AgenteConfig = z.infer<typeof AgenteConfigSchema>;

export const AgenteInSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  resumo: texto(300),
  status: AgenteStatus,
  config: AgenteConfigSchema,
});
export type AgenteIn = z.infer<typeof AgenteInSchema>;

export const AvaliacaoResultado = z.enum(['ok', 'parcial', 'falha']);
export type AvaliacaoResultado = z.infer<typeof AvaliacaoResultado>;

export const AvaliacaoInSchema = z.object({
  caso: z.string().trim().min(1).max(2000),
  criterio: texto(2000),
  resultado: AvaliacaoResultado,
  latenciaMs: z.number().int().min(0).max(600_000).optional(),
  observacao: texto(2000),
});
export type AvaliacaoIn = z.infer<typeof AvaliacaoInSchema>;

// ---------- execução (playground) ----------

/** rodando: laço em andamento; limite: parou no teto de passos ou de tokens. */
export type ExecucaoStatus = 'rodando' | 'concluida' | 'limite' | 'recusada' | 'erro';

/** Cada volta do laço deixa um passo: o que o modelo disse ou o que uma ferramenta devolveu. */
export type PassoExecucao =
  | {
      tipo: 'modelo';
      /** resumo do raciocínio, quando o modelo devolve */
      raciocinio: string;
      texto: string;
      /** por que o modelo parou: end_turn (terminou), tool_use (pediu ferramenta), etc. */
      parada: string;
      tokensEntrada: number;
      tokensSaida: number;
      ms: number;
    }
  | {
      tipo: 'ferramenta';
      nome: string;
      entrada: unknown;
      saida: string;
      erro: boolean;
      ms: number;
    };

export const ExecutarInSchema = z.object({
  mensagem: z.string().trim().min(1).max(8000),
  /** id de uma execução anterior do mesmo agente: continua aquela conversa */
  continuarDe: z.string().min(1).max(60).optional(),
});
export type ExecutarIn = z.infer<typeof ExecutarInSchema>;

export function agenteConfigVazio(): AgenteConfig {
  return {
    proposito: { casoDeUso: '', usuarios: '', criteriosSucesso: '', restricoes: '' },
    instrucoes: { papel: '', objetivos: '', instrucoes: '', limitesSeguranca: '' },
    modelo: { nome: '', temperatura: 0.3, janelaContexto: '', custoLatencia: '' },
    ferramentas: [],
    memoria: { episodica: false, trabalho: true, vetorial: false, sql: false, arquivos: false, privacidade: '' },
    conhecimento: { tags: [], observacao: '' },
    orquestracao: { fluxo: '', gatilhos: '', tratamentoErros: '', multiAgente: '' },
    interface: { canais: ['chat'], notas: '' },
    supervisao: { decisoesCriticas: '', registroAuditoria: true },
  };
}

export interface Revisao {
  /** erro bloqueia ativar o agente; aviso só recomenda */
  nivel: 'erro' | 'aviso';
  codigo: string;
  texto: string;
}

/**
 * Revisão de segurança e completude. "Autonomia precisa de limites, rastreabilidade e
 * supervisão humana nas decisões críticas": as regras abaixo cobram exatamente isso.
 */
export function revisarAgente(c: AgenteConfig): Revisao[] {
  const r: Revisao[] = [];
  const vazio = (s: string) => s.trim().length === 0;
  const aviso = (codigo: string, t: string) => r.push({ nivel: 'aviso', codigo, texto: t });

  if (vazio(c.proposito.casoDeUso)) aviso('proposito.caso', 'Pilar 1: descreva o caso de uso (que problema real o agente resolve).');
  if (vazio(c.proposito.criteriosSucesso)) aviso('proposito.sucesso', 'Pilar 1: defina critérios de sucesso mensuráveis; sem eles não há como avaliar.');
  if (vazio(c.proposito.restricoes)) aviso('proposito.restricoes', 'Pilar 1: liste o que o agente NÃO deve fazer.');

  if (vazio(c.instrucoes.instrucoes)) {
    r.push({ nivel: 'erro', codigo: 'instrucoes.vazia', texto: 'Pilar 2: escreva as instruções do sistema; sem elas o comportamento do agente não está definido.' });
  }
  if (vazio(c.instrucoes.limitesSeguranca)) aviso('instrucoes.limites', 'Pilar 2: registre os limites de segurança (o que recusar, o que tratar como dado e não como instrução).');

  if (vazio(c.modelo.nome)) aviso('modelo.nome', 'Pilar 3: indique o modelo escolhido e por quê (capacidade, contexto, custo, latência).');

  const escrita = c.ferramentas.filter((f) => f.permissao === 'escrita');
  for (const f of escrita.filter((x) => !x.exigeAprovacao)) {
    r.push({
      nivel: 'erro', codigo: `ferramenta.sem-aprovacao.${f.id}`,
      texto: `Pilar 4: "${f.nome}" altera sistemas sem aprovação humana. Exija aprovação ou use apenas leitura.`,
    });
  }

  if (vazio(c.orquestracao.tratamentoErros)) aviso('orquestracao.erros', 'Pilar 6: descreva o tratamento de erros (timeouts, tentativas, limite de passos e de custo).');

  const terceiros = c.interface.canais.filter((x) => CANAIS_ENTRADA_DE_TERCEIROS.includes(x));
  if (terceiros.length > 0 && c.ferramentas.length > 0) {
    aviso('interface.terceiros', `Pilar 7: ${terceiros.join(', ')} recebe(m) texto de terceiros. Com ferramentas conectadas, isso abre a porta para prompt injection; trate toda entrada como não confiável.`);
  }

  if ((c.memoria.episodica || c.memoria.vetorial || c.memoria.sql || c.memoria.arquivos) && vazio(c.memoria.privacidade)) {
    aviso('memoria.privacidade', 'Pilar 5: defina o que pode ser guardado, por quanto tempo e o que nunca deve entrar na memória.');
  }

  if (escrita.length > 0 && vazio(c.supervisao.decisoesCriticas)) aviso('supervisao.decisoes', 'Supervisão: liste as decisões críticas que exigem um humano.');
  if (escrita.length > 0 && !c.supervisao.registroAuditoria) aviso('supervisao.auditoria', 'Supervisão: com ferramentas de escrita, mantenha registro de auditoria das ações.');

  return r;
}

/** Documento Markdown com o projeto do agente, pronto para versionar ou colar em outra ferramenta. */
export function especificacaoMarkdown(nome: string, resumo: string, status: AgenteStatus, c: AgenteConfig): string {
  const L: string[] = [];
  const secao = (t: string) => { L.push('', '## ' + t, ''); };
  const campo = (rotulo: string, valor: string) => { if (valor.trim()) L.push('**' + rotulo + ':** ' + valor.trim(), ''); };

  L.push('# Agente: ' + (nome.trim() || 'sem nome'), '');
  if (resumo.trim()) L.push('> ' + resumo.trim(), '');
  L.push('Status: ' + status);

  secao('1. Propósito e escopo');
  campo('Caso de uso', c.proposito.casoDeUso);
  campo('Usuários e necessidades', c.proposito.usuarios);
  campo('Critérios de sucesso', c.proposito.criteriosSucesso);
  campo('Restrições', c.proposito.restricoes);

  secao('2. Instruções do sistema');
  campo('Papel', c.instrucoes.papel);
  campo('Objetivos', c.instrucoes.objetivos);
  campo('Limites de segurança', c.instrucoes.limitesSeguranca);
  if (c.instrucoes.instrucoes.trim()) L.push('Prompt do sistema:', '', '````', c.instrucoes.instrucoes.trim(), '````', '');

  secao('3. Modelo de linguagem');
  campo('Modelo', c.modelo.nome);
  L.push('**Temperatura:** ' + c.modelo.temperatura, '');
  campo('Janela de contexto', c.modelo.janelaContexto);
  campo('Custo e latência', c.modelo.custoLatencia);

  secao('4. Ferramentas e integrações');
  if (c.ferramentas.length === 0) L.push('Nenhuma ferramenta conectada.', '');
  for (const f of c.ferramentas) {
    L.push('- **' + f.nome + '** (' + f.permissao + (f.exigeAprovacao ? ', exige aprovação humana' : '') + ')' + (f.observacao.trim() ? ': ' + f.observacao.trim() : ''));
  }

  secao('5. Memória e conhecimento');
  const tipos = [
    c.memoria.episodica && 'episódica (conversas)', c.memoria.trabalho && 'memória de trabalho', c.memoria.vetorial && 'banco vetorial',
    c.memoria.sql && 'banco SQL', c.memoria.arquivos && 'armazenamento de arquivos',
  ].filter(Boolean);
  L.push('**Tipos:** ' + (tipos.length ? tipos.join(', ') : 'nenhuma'), '');
  campo('Privacidade e retenção', c.memoria.privacidade);
  if (c.conhecimento.tags.length) L.push('**Base de conhecimento (tags do Segundo Cérebro):** ' + c.conhecimento.tags.join(', '), '');
  campo('Notas da base', c.conhecimento.observacao);

  secao('6. Orquestração');
  campo('Fluxo', c.orquestracao.fluxo);
  campo('Gatilhos', c.orquestracao.gatilhos);
  campo('Tratamento de erros', c.orquestracao.tratamentoErros);
  campo('Vários agentes', c.orquestracao.multiAgente);

  secao('7. Interface');
  L.push('**Canais:** ' + (c.interface.canais.length ? c.interface.canais.join(', ') : 'nenhum'), '');
  campo('Notas', c.interface.notas);

  secao('Supervisão humana');
  campo('Decisões que exigem um humano', c.supervisao.decisoesCriticas);
  L.push('**Registro de auditoria:** ' + (c.supervisao.registroAuditoria ? 'sim' : 'não'), '');

  const problemas = revisarAgente(c);
  if (problemas.length) {
    secao('Pendências da revisão');
    for (const p of problemas) L.push('- [' + p.nivel + '] ' + p.texto);
    L.push('');
  }
  return L.join('\n');
}
