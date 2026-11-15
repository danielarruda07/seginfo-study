import { buscar, diferencaDeConjunto, listaCurta, type FonteExposicao, type ResultadoFonte, type Tom } from './tipos.js';

/**
 * Vazamentos de dados por e-mail.
 * - XposedOrNot (grátis, sem chave): /v1/breach-analytics traz cada vazamento com data, dados expostos
 *   e risco da senha; e-mail sem vazamento devolve ExposedBreaches null.
 * - Have I Been Pwned (opcional, HIBP_API_KEY): /api/v3/breachedaccount; 404 = nenhum vazamento.
 */

export interface Vazamento {
  nome: string;
  data: string;
  dados: string[];
  /** proteção da senha no vazamento */
  senha: 'texto-puro' | 'facil' | 'forte' | 'desconhecido' | 'sem-senha';
  registros?: number;
}

const ACAO = 'Troque a senha de toda conta que usava a mesma senha desses serviços e ligue a verificação em duas etapas.';
const DADOS_SENSIVEIS = /password|phone|physical address|credit|bank|security question|date of birth/i;

const riscoSenha = (r: unknown, dados: string[]): Vazamento['senha'] => {
  const x = String(r ?? '').toLowerCase();
  if (x === 'plaintext') return 'texto-puro';
  if (x === 'easytocrack') return 'facil';
  if (x === 'hardtocrack' || x === 'stronghash') return 'forte';
  return dados.some((d) => /password/i.test(d)) ? 'desconhecido' : 'sem-senha';
};

/** Lê a resposta de /v1/breach-analytics. */
export function lerXposedOrNot(json: unknown): Vazamento[] {
  const d = json as { ExposedBreaches?: { breaches_details?: Record<string, unknown>[] } | null } | null;
  return (d?.ExposedBreaches?.breaches_details ?? []).map((b) => {
    const dados = String(b.xposed_data ?? '').split(';').map((s) => s.trim()).filter(Boolean);
    return {
      nome: String(b.breach ?? '?'),
      data: String(b.xposed_date ?? ''),
      dados,
      senha: riscoSenha(b.password_risk, dados),
      registros: typeof b.xposed_records === 'number' ? b.xposed_records : undefined,
    };
  });
}

/** Lê a resposta de /api/v3/breachedaccount (truncateResponse=false). */
export function lerHibp(json: unknown): Vazamento[] {
  return (Array.isArray(json) ? (json as Record<string, unknown>[]) : []).map((b) => {
    const dados = Array.isArray(b.DataClasses) ? (b.DataClasses as unknown[]).map(String) : [];
    return {
      nome: String(b.Title ?? b.Name ?? '?'),
      data: String(b.BreachDate ?? ''),
      dados,
      senha: riscoSenha(undefined, dados),
      registros: typeof b.PwnCount === 'number' ? b.PwnCount : undefined,
    };
  });
}

const ROTULO_SENHA: Record<Vazamento['senha'], string> = {
  'texto-puro': 'senha em texto puro', facil: 'senha fácil de quebrar', forte: 'senha com hash forte',
  desconhecido: 'senha (proteção desconhecida)', 'sem-senha': '',
};

/** Resultado exibível a partir da lista de vazamentos. */
export function resultadoVazamentos(fonte: string, nome: string, observacao: string, lista: Vazamento[]): ResultadoFonte {
  const ordenados = [...lista].sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome));
  const comSenha = lista.filter((v) => v.senha !== 'sem-senha');
  const classes = new Map<string, number>();
  for (const v of lista) for (const d of v.dados) classes.set(d, (classes.get(d) ?? 0) + 1);
  const tomSenha = (s: Vazamento['senha']): Tom => (s === 'texto-puro' || s === 'facil' ? 'alta' : s === 'sem-senha' ? 'info' : 'media');
  return {
    fonte, nome, observacao,
    destaques: [
      { rotulo: 'Vazamentos', valor: lista.length, tom: lista.length === 0 ? 'ok' : comSenha.length ? 'alta' : 'media' },
      ...(comSenha.length ? [{ rotulo: 'Com senha', valor: comSenha.length, tom: 'alta' as Tom }] : []),
    ],
    secoes: [
      {
        titulo: 'Vazamentos',
        vazio: 'Nenhum vazamento conhecido para este e-mail.',
        itens: ordenados.map((v) => ({
          texto: `${v.nome}${v.data ? ` (${v.data})` : ''}`,
          tom: tomSenha(v.senha),
          detalhe: [ROTULO_SENHA[v.senha], listaCurta(v.dados, 6)].filter(Boolean).join(' · '),
        })),
      },
      {
        titulo: 'Dados expostos',
        vazio: 'Nenhum.',
        itens: [...classes.entries()].sort((a, b) => b[1] - a[1])
          .map(([d, n]) => ({ texto: d, detalhe: `${n} vazamento(s)`, tom: DADOS_SENSIVEIS.test(d) ? ('media' as Tom) : undefined })),
      },
      ...(lista.length ? [{ titulo: 'O que fazer', itens: [{ texto: ACAO, tom: (comSenha.length ? 'alta' : 'info') as Tom }] }] : []),
    ],
    conjuntos: { vazamentos: lista.map((v) => v.nome) },
  };
}

const comparar: FonteExposicao['comparar'] = (a, b) => diferencaDeConjunto(b.fonte, a, b, 'vazamentos',
  { tipo: 'vazamento-novo', severidade: 'alta', texto: (xs) => `E-mail apareceu em vazamento novo: ${listaCurta(xs)}. ${ACAO}` },
  null);

const OBS_XON = 'Fonte: XposedOrNot (base pública de vazamentos, sem chave). A data é a do vazamento, não a de quando ele foi publicado.';
const OBS_HIBP = 'Fonte: Have I Been Pwned (chave paga). Vazamentos verificados e listas de credenciais.';
const ID_XON = 'vazamentos-xposedornot';
const NOME_XON = 'Vazamentos de dados (XposedOrNot)';
const ID_HIBP = 'vazamentos-hibp';
const NOME_HIBP = 'Vazamentos de dados (Have I Been Pwned)';

const limite = (servico: string) => new Error(`${servico} limitou as consultas (HTTP 429). Tente de novo mais tarde.`);

export const fontes: FonteExposicao[] = [
  {
    id: ID_XON,
    nome: NOME_XON,
    aplicaA: ['email'],
    async coletar({ alvo }) {
      const r = await buscar(`https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(alvo.valor)}`, { ms: 30_000 });
      if (r.status === 429) throw limite('XposedOrNot');
      if (r.status === 404) return resultadoVazamentos(ID_XON, NOME_XON, OBS_XON, []);
      if (r.status !== 200) throw new Error(`XposedOrNot respondeu HTTP ${r.status}.`);
      return resultadoVazamentos(ID_XON, NOME_XON, OBS_XON, lerXposedOrNot(r.json));
    },
    comparar,
  },
  {
    id: ID_HIBP,
    nome: NOME_HIBP,
    aplicaA: ['email'],
    faltando: () => (process.env.HIBP_API_KEY ? [] : ['HIBP_API_KEY']),
    async coletar({ alvo }) {
      const r = await buscar(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(alvo.valor)}?truncateResponse=false`, {
        headers: { 'hibp-api-key': process.env.HIBP_API_KEY as string }, ms: 30_000,
      });
      if (r.status === 429) throw limite('Have I Been Pwned');
      if (r.status === 401) throw new Error('Have I Been Pwned recusou a chave (HTTP 401). Confira HIBP_API_KEY.');
      if (r.status === 404) return resultadoVazamentos(ID_HIBP, NOME_HIBP, OBS_HIBP, []);
      if (r.status !== 200) throw new Error(`Have I Been Pwned respondeu HTTP ${r.status}.`);
      return resultadoVazamentos(ID_HIBP, NOME_HIBP, OBS_HIBP, lerHibp(r.json));
    },
    comparar,
  },
];
