import { buscar, diferencaDeConjunto, listaCurta, type FonteExposicao, type ResultadoFonte, type Tom } from './tipos.js';

/**
 * Código público no GitHub que menciona o domínio ou o e-mail (busca de código, exige GITHUB_TOKEN).
 * Só lê nome do repositório e caminho do arquivo: o conteúdo nunca é baixado.
 */

export interface Ocorrencia { repo: string; caminho: string; url: string; arriscado: boolean }

/** Arquivos que costumam guardar segredo: .env, credenciais, chaves, configs de deploy. */
const ARRISCADO = [
  /(^|\/)\.env(\.|$)/i, /(^|\/)\.env$/i, /credential/i, /secret/i, /passw/i, /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.|$)/i,
  /\.(pem|key|p12|pfx|ppk|kdbx)$/i, /docker-compose[^/]*\.ya?ml$/i, /(^|\/)settings(\.[a-z]+)?\.(py|json|ya?ml|ini)$/i,
  /wp-config/i, /(^|\/)config[^/]*\.(json|ya?ml|ini|php|xml|toml)$/i, /\.(tfvars|tfstate)$/i, /(^|\/)\.(npmrc|pypirc|netrc|git-credentials)$/i,
  /application(-[a-z]+)?\.(properties|ya?ml)$/i,
];
export const caminhoArriscado = (caminho: string) => ARRISCADO.some((r) => r.test(caminho));

export function lerBuscaGithub(json: unknown): { total: number; itens: Ocorrencia[] } {
  const d = json as { total_count?: number; items?: Record<string, unknown>[] } | null;
  const itens = (d?.items ?? []).slice(0, 30).map((i) => {
    const caminho = String(i.path ?? '');
    return {
      repo: String((i.repository as { full_name?: string } | undefined)?.full_name ?? '?'),
      caminho,
      url: String(i.html_url ?? ''),
      arriscado: caminhoArriscado(caminho),
    };
  });
  return { total: typeof d?.total_count === 'number' ? d.total_count : itens.length, itens };
}

const ID = 'github-codigo';
const NOME = 'Código público no GitHub';
const chave = (o: Ocorrencia) => `${o.repo}:${o.caminho}`;

export function resultadoGithub(total: number, itens: Ocorrencia[]): ResultadoFonte {
  const arriscados = itens.filter((o) => o.arriscado);
  const repos = new Set(itens.map((o) => o.repo));
  const item = (o: Ocorrencia) => ({ texto: `${o.repo} · ${o.caminho}`, link: o.url || undefined, tom: (o.arriscado ? 'alta' : undefined) as Tom | undefined });
  return {
    fonte: ID, nome: NOME,
    observacao: 'Busca de código do GitHub pelo valor exato. Confira se algum repositório SEU expõe segredo; menções de terceiros (listas, docs) costumam ser inofensivas. O conteúdo dos arquivos não é baixado.',
    destaques: [
      { rotulo: 'Arquivos no GitHub', valor: total, tom: total === 0 ? 'ok' : 'info' },
      ...(arriscados.length ? [{ rotulo: 'Arquivos sensíveis', valor: arriscados.length, tom: 'alta' as Tom }] : []),
    ],
    secoes: [
      { titulo: 'Arquivos com nome sensível (.env, chaves, configs)', vazio: 'Nenhum.', itens: arriscados.map(item) },
      {
        titulo: `Outras menções${total > itens.length ? ` (mostrando ${itens.length} de ${total})` : ''}`,
        vazio: 'Nenhuma.',
        itens: itens.filter((o) => !o.arriscado).map(item),
      },
      { titulo: 'Repositórios', vazio: 'Nenhum.', itens: [...repos].sort().map((r) => ({ texto: r, link: `https://github.com/${r}` })) },
    ],
    conjuntos: { arquivos: itens.filter((o) => !o.arriscado).map(chave), arriscados: arriscados.map(chave) },
  };
}

export const fontes: FonteExposicao[] = [
  {
    id: ID,
    nome: NOME,
    aplicaA: ['dominio', 'email'],
    faltando: () => (process.env.GITHUB_TOKEN ? [] : ['GITHUB_TOKEN']),
    async coletar({ alvo }) {
      const q = encodeURIComponent(`"${alvo.valor}"`);
      const r = await buscar(`https://api.github.com/search/code?q=${q}&per_page=30`, {
        headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      });
      if (r.status === 401) throw new Error('GitHub recusou o token (HTTP 401). Confira GITHUB_TOKEN.');
      if (r.status === 403 || r.status === 429) throw new Error(`GitHub limitou a busca de código (HTTP ${r.status}). Tente de novo em alguns minutos.`);
      if (r.status === 422) return resultadoGithub(0, []);
      if (r.status !== 200) throw new Error(`GitHub respondeu HTTP ${r.status}.`);
      const { total, itens } = lerBuscaGithub(r.json);
      return resultadoGithub(total, itens);
    },
    comparar: (a, b) => [
      ...diferencaDeConjunto(ID, a, b, 'arriscados',
        { tipo: 'github-arquivo-sensivel', severidade: 'alta', texto: (xs) => `Arquivo com nome sensível menciona o alvo no GitHub: ${listaCurta(xs, 3)}.` }, null),
      ...diferencaDeConjunto(ID, a, b, 'arquivos',
        { tipo: 'github-mencao-nova', severidade: 'media', texto: (xs) => `Nova menção no GitHub: ${listaCurta(xs, 3)}.` }, null),
    ],
  },
];
