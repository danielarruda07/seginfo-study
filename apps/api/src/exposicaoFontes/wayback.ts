import { buscar, diferencaDeConjunto, listaCurta, type FonteExposicao, type ResultadoFonte } from './tipos.js';

/**
 * URLs antigas do domínio guardadas pela Wayback Machine (Internet Archive). Muitas ainda respondem:
 * painéis, backups, arquivos de configuração e APIs esquecidas. Consulta só o arquivo público, nunca o site.
 */

const LIMITE = 2000;
const MAX_SENSIVEIS = 50;

export interface CategoriaSensivel { id: string; rotulo: string; re: RegExp }

/** Ordem importa: a primeira categoria que casar classifica a URL. */
export const CATEGORIAS: CategoriaSensivel[] = [
  { id: 'segredo', rotulo: 'Configuração ou segredo', re: /(^|\/)(\.env|\.git|\.svn|\.htpasswd|\.aws|\.ssh|wp-config\.php|config\.(php|json|ya?ml|ini)|settings\.py|credentials?)(\/|$|\.|\?)/i },
  { id: 'backup', rotulo: 'Backup ou dump', re: /\.(sql|sql\.gz|dump|bak|backup|old|orig|swp|zip|tar|tar\.gz|tgz|gz|rar|7z)(\?|$)|(^|\/)backups?(\/|$)/i },
  { id: 'painel', rotulo: 'Painel administrativo', re: /(^|\/)(admin|administrator|painel|wp-admin|wp-login\.php|phpmyadmin|pma|cpanel|webmail|manager\/html|adminer(\.php)?)(\/|$|\?)/i },
  { id: 'debug', rotulo: 'Depuração ou status', re: /(^|\/)(debug|actuator|server-status|server-info|phpinfo\.php|_profiler|elmah\.axd|trace\.axd|console)(\/|$|\?)/i },
  { id: 'api', rotulo: 'API ou documentação de API', re: /(^|\/)(api|graphql|swagger(-ui)?|openapi|v[0-9]+\/api|api-docs)(\/|$|\?|\.json|\.ya?ml)/i },
  { id: 'login', rotulo: 'Login', re: /(^|\/)(login|signin|logon|auth|sso)(\/|$|\?|\.)/i },
  { id: 'arquivo', rotulo: 'Arquivo de dados ou log', re: /\.(log|xml|csv|xls|xlsx|json|yml|yaml|ini|conf|cfg|txt)(\?|$)/i },
];

/** Categoria sensível do caminho da URL, ou null. Ignora o domínio (só o caminho e a consulta contam). */
export function classificarUrl(url: string): CategoriaSensivel | null {
  let caminho: string;
  try { const u = new URL(/^https?:\/\//i.test(url) ? url : `http://${url}`); caminho = u.pathname + u.search; }
  catch { return null; }
  if (caminho === '/' || caminho === '') return null;
  if (/\/robots\.txt$|\/sitemap[^/]*\.xml$|\/favicon/i.test(caminho)) return null;
  return CATEGORIAS.find((c) => c.re.test(caminho)) ?? null;
}

/** Normaliza para comparar entre varreduras: sem esquema, sem porta 80/443, sem "www." e sem barra final. */
export function normalizarUrl(url: string): string {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `http://${url}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    return `${host}${u.pathname.replace(/\/+$/, '') || '/'}${u.search}`;
  } catch { return url.toLowerCase(); }
}

export interface UrlSensivel { url: string; categoria: string; rotulo: string; ano: string; status: string }

/** Linhas do CDX ([original, timestamp, statuscode, mimetype]; a primeira é o cabeçalho). */
export function analisarCdx(dominio: string, linhas: unknown[]) {
  const corpo = (linhas.length && Array.isArray(linhas[0]) && linhas[0][0] === 'original' ? linhas.slice(1) : linhas) as unknown[][];
  const unicas = new Map<string, { original: string; ts: string; status: string }>();
  const hosts = new Set<string>();
  for (const l of corpo) {
    if (!Array.isArray(l) || typeof l[0] !== 'string') continue;
    const original = l[0];
    const chave = normalizarUrl(original);
    const ts = String(l[1] ?? '');
    const atual = unicas.get(chave);
    if (!atual || ts > atual.ts) unicas.set(chave, { original, ts, status: String(l[2] ?? '-') });
    const host = chave.split('/')[0];
    if (host === dominio || host.endsWith(`.${dominio}`)) hosts.add(host);
  }
  const sensiveis: UrlSensivel[] = [];
  for (const [chave, v] of unicas) {
    const c = classificarUrl(v.original);
    if (c) sensiveis.push({ url: chave, categoria: c.id, rotulo: c.rotulo, ano: v.ts.slice(0, 4), status: v.status });
  }
  const ordem = new Map(CATEGORIAS.map((c, i) => [c.id, i]));
  sensiveis.sort((a, b) => (ordem.get(a.categoria)! - ordem.get(b.categoria)!) || b.ano.localeCompare(a.ano) || a.url.localeCompare(b.url));
  return { total: unicas.size, hosts: [...hosts].sort(), sensiveis };
}

export function resultadoWayback(dominio: string, a: ReturnType<typeof analisarCdx>, cortado: boolean): ResultadoFonte {
  const graves = a.sensiveis.filter((s) => s.categoria === 'segredo' || s.categoria === 'backup');
  const porCategoria = new Map<string, UrlSensivel[]>();
  for (const s of a.sensiveis.slice(0, MAX_SENSIVEIS)) porCategoria.set(s.rotulo, [...(porCategoria.get(s.rotulo) ?? []), s]);
  return {
    fonte: 'wayback',
    nome: 'URLs antigas (Wayback Machine)',
    observacao: `${a.total} URLs únicas de ${dominio} já arquivadas${cortado ? ` (primeiras ${LIMITE} do arquivo)` : ''}. ` +
      'São endereços antigos que podem ainda responder: vale testar no seu próprio site se painéis, backups e configurações ainda estão acessíveis.',
    destaques: [
      { rotulo: 'URLs arquivadas', valor: a.total, tom: 'info' },
      { rotulo: 'URLs sensíveis', valor: a.sensiveis.length, tom: graves.length ? 'alta' : a.sensiveis.length ? 'media' : 'ok' },
    ],
    secoes: [
      ...[...porCategoria].map(([rotulo, xs]) => ({
        titulo: rotulo,
        itens: xs.map((s) => ({
          texto: s.url,
          tom: s.categoria === 'segredo' || s.categoria === 'backup' ? 'alta' as const : 'media' as const,
          detalhe: `visto por último em ${s.ano || '?'} · HTTP ${s.status}`,
        })),
      })),
      ...(a.sensiveis.length > MAX_SENSIVEIS ? [{ titulo: 'Outras', itens: [{ texto: `e mais ${a.sensiveis.length - MAX_SENSIVEIS} URLs sensíveis` }] }] : []),
      { titulo: `Hosts vistos no arquivo (${a.hosts.length})`, itens: a.hosts.slice(0, 40).map((h) => ({ texto: h })), vazio: 'Nenhum.' },
    ],
    conjuntos: { sensiveis: a.sensiveis.map((s) => s.url) },
  };
}

export const fontes: FonteExposicao[] = [{
  id: 'wayback',
  nome: 'URLs antigas (Wayback Machine)',
  aplicaA: ['dominio'],
  async coletar(ctx) {
    const d = ctx.alvo.valor;
    const cdx = (padrao: string) => `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(padrao)}&output=json&fl=original,timestamp,statuscode,mimetype&collapse=urlkey&limit=${LIMITE}`;
    let r: { status: number; json: unknown };
    let soDominio = false;
    try {
      // com subdomínios primeiro; em domínio muito arquivado o CDX demora, então cai para só o domínio
      try { r = await buscar(cdx(`*.${d}/*`), { ms: 45_000 }); }
      catch (e) {
        if ((e as Error).name !== 'TimeoutError') throw e;
        soDominio = true;
        r = await buscar(cdx(`${d}/*`), { ms: 38_000 });
      }
    } catch (e) {
      throw new Error(`Wayback Machine não respondeu (${(e as Error).name === 'TimeoutError' ? 'tempo esgotado' : (e as Error).message}). O serviço costuma ficar lento; tenta de novo na próxima varredura.`);
    }
    if (r.status !== 200) throw new Error(`Wayback Machine respondeu HTTP ${r.status}.`);
    const linhas = Array.isArray(r.json) ? r.json : [];
    const res = resultadoWayback(d, analisarCdx(d, linhas), linhas.length > LIMITE);
    if (soDominio) res.observacao = `Só ${d}, sem subdomínios (o arquivo completo demorou demais). ${res.observacao ?? ''}`;
    return res;
  },
  comparar: (a, b) => diferencaDeConjunto('wayback', a, b, 'sensiveis',
    { tipo: 'wayback-url-sensivel', severidade: 'media', texto: (x) => `Nova URL sensível no arquivo da Wayback Machine: ${listaCurta(x)}.` }, null),
}];
