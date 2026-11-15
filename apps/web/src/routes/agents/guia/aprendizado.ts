import type { AcaoAuditoria, AgenteResumo } from '@/services/agentes';

/**
 * "Melhorar com o tempo": sugestões tiradas do que os agentes fizeram de verdade (auditoria e
 * avaliações). Regras simples e explicáveis, sem IA: cada sugestão diz o que foi visto e o que mudar.
 */

export interface Sugestao {
  id: string;
  tom: 'atencao' | 'dica';
  texto: string;
  /** agente a abrir para aplicar a sugestão */
  agenteId?: string;
}

export type NivelFerramenta = 'leve' | 'destrutiva' | 'depende';

/** O agente de registro do MCP não é editável como os outros: fica fora das sugestões de projeto. */
const ehAgenteMcp = (nome: string) => nome.startsWith('Acesso MCP');

const MIN_FALHAS = 3;
const MIN_NEGADAS = 2;
const MIN_LEVES_APROVADAS = 3;

function contar<T>(itens: T[], chave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of itens) {
    const k = chave(x);
    m.set(k, [...(m.get(k) ?? []), x]);
  }
  return m;
}

const curto = (s: string, n = 140) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

export function sugestoesDeMelhoria(e: {
  acoes: AcaoAuditoria[];
  agentes: AgenteResumo[];
  niveis: Record<string, NivelFerramenta | undefined>;
  /** limita às sugestões de um agente (editor e playground) */
  agenteId?: string;
}): Sugestao[] {
  const acoes = e.agenteId ? e.acoes.filter((a) => a.agenteId === e.agenteId) : e.acoes;
  const agentes = e.agenteId ? e.agentes.filter((a) => a.id === e.agenteId) : e.agentes;
  const porId = new Map(e.agentes.map((a) => [a.id, a]));
  const out: Sugestao[] = [];

  // 1. Ferramenta que falha sempre: quase sempre é conexão, certificado ou permissão.
  for (const [ferramenta, lista] of contar(acoes.filter((a) => a.erro && a.decisao !== 'negada'), (a) => a.ferramenta)) {
    if (lista.length < MIN_FALHAS) continue;
    out.push({
      id: `falha:${ferramenta}`, tom: 'atencao',
      texto: `${ferramenta} falhou ${lista.length} vezes. Último erro: "${curto(lista[0].saida)}". ` +
        'Se for rede, certificado ou senha, use "Testar conexão" em Meu Ambiente; se for o pedido, escreva nas Instruções como usar esta ferramenta.',
    });
  }

  // 2. Ação negada várias vezes: o agente está pedindo o que você não quer.
  for (const [chave, lista] of contar(acoes.filter((a) => a.decisao === 'negada'), (a) => `${a.agenteId}|${a.ferramenta}`)) {
    if (lista.length < MIN_NEGADAS) continue;
    const a = lista[0];
    out.push({
      id: `negada:${chave}`, tom: 'dica', agenteId: a.agenteId,
      texto: `Você negou ${a.ferramenta} ${lista.length} vezes no agente "${a.agenteNome}". ` +
        'Escreva nas Restrições quando ela não deve ser pedida; assim o agente para de propor.',
    });
  }

  // 3. Ações leves aprovadas à mão várias vezes: o modo autônomo economiza esses cliques.
  const levesAprovadas = acoes.filter((a) => a.decisao === 'aprovada' && e.niveis[a.ferramenta] === 'leve');
  for (const [agenteId, lista] of contar(levesAprovadas, (a) => a.agenteId)) {
    if (lista.length < MIN_LEVES_APROVADAS) continue;
    if (porId.get(agenteId)?.autonomia === 'leves-automaticas') continue;
    out.push({
      id: `leves:${agenteId}`, tom: 'dica', agenteId,
      texto: `Você aprovou à mão ${lista.length} ações leves no agente "${lista[0].agenteNome}" (ex.: ${lista[0].ferramenta}). ` +
        'Na aba Supervisão, "Ações leves rodam direto" faz essas rodarem sem clique; as destrutivas continuam pedindo.',
    });
  }

  for (const a of agentes) {
    if (ehAgenteMcp(a.nome) || a.status === 'arquivado') continue;
    // 4. Já rodou e não tem nenhum caso de teste: não há como saber se uma mudança ajudou.
    if (a.ultimaExecucao && a.avaliacoes.total === 0) {
      out.push({
        id: `semcasos:${a.id}`, tom: 'dica', agenteId: a.id,
        texto: `"${a.nome}" já rodou, mas não tem casos em Avaliações. Registre 5 a 10 pedidos reais com o critério de "deu certo" e repita depois de cada mudança.`,
      });
    }
    // 5. Casos com falha: ponto exato para ajustar.
    if (a.avaliacoes.falha > 0) {
      out.push({
        id: `falhacasos:${a.id}`, tom: 'atencao', agenteId: a.id,
        texto: `"${a.nome}" tem ${a.avaliacoes.falha} caso(s) com falha. Ajuste as instruções pensando nesses casos e rode-os de novo.`,
      });
    }
    // 6. Ainda não pode ficar ativo.
    if (a.revisao && a.revisao.erros > 0) {
      out.push({
        id: `revisao:${a.id}`, tom: 'atencao', agenteId: a.id,
        texto: `"${a.nome}" tem ${a.revisao.erros} pendência(s) grave(s) na revisão de segurança. Veja a aba "Revisão e especificação".`,
      });
    }
  }

  // 7. Agentes repetidos (só na visão geral).
  if (!e.agenteId) {
    for (const [nome, lista] of contar(e.agentes.filter((a) => a.status !== 'arquivado'), (a) => a.nome.trim().toLowerCase())) {
      if (lista.length < 2) continue;
      out.push({
        id: `duplicado:${nome}`, tom: 'dica',
        texto: `Há ${lista.length} agentes chamados "${lista[0].nome}". Fique com um, arquive os outros e registre as avaliações nele.`,
      });
    }
  }

  return out.sort((x, y) => (x.tom === y.tom ? 0 : x.tom === 'atencao' ? -1 : 1));
}
