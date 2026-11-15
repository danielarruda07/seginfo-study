import { ipNaoPublico } from '../osint.js';
import { buscar, diferencaDeConjunto, listaCurta, type FonteExposicao, type ItemFonte, type ResultadoFonte, type SecaoFonte } from './tipos.js';

/**
 * Shodan API e Censys: visão completa de cada IP (serviços, banners, certificados), além do
 * resumo gratuito do InternetDB. As duas são opcionais e só ligam com a chave no servidor.
 */

const MAX_IPS = 5;

const ipsDoContexto = (ips: string[]) => [...new Set(ips)].filter((ip) => !ipNaoPublico(ip)).slice(0, MAX_IPS);

/** Banner sem caracteres de controle, numa linha, cortado. Texto de terceiros: só exibido, nunca interpretado. */
export function bannerCurto(bruto: unknown, max = 200): string {
  const s = String(bruto ?? '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export const mensagemHttp = (servico: string, status: number) =>
  status === 401 || status === 403 ? `${servico} recusou a chave (HTTP ${status}). Confira a chave e o plano da conta.`
    : status === 429 ? `${servico} limitou as consultas (HTTP 429): cota esgotada ou muitas consultas seguidas. Tente mais tarde.`
      : `${servico} respondeu HTTP ${status}.`;

// ---------- Shodan ----------

export interface ServicoShodan {
  porta: number; transporte: string; produto: string | null; versao: string | null;
  tituloHttp: string | null; certificado: string | null; banner: string; visto: string | null;
}
export interface HostShodan { ip: string; org: string | null; isp: string | null; os: string | null; atualizado: string | null; servicos: ServicoShodan[]; tags: string[] }

/** Shodan usa "20261231235959Z" nos certificados. */
function formatarDataShodan(s: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

/** Converte a resposta de /shodan/host/{ip} no que interessa mostrar. */
export function lerHostShodan(ip: string, d: Record<string, unknown>): HostShodan {
  const dados = Array.isArray(d.data) ? (d.data as Record<string, unknown>[]) : [];
  const servicos = dados.map((s): ServicoShodan => {
    const http = (s.http ?? null) as Record<string, unknown> | null;
    const cert = ((s.ssl as Record<string, unknown> | undefined)?.cert ?? null) as Record<string, unknown> | null;
    const sujeito = cert?.subject as Record<string, unknown> | undefined;
    const expira = typeof cert?.expires === 'string' ? cert.expires : null;
    const cn = sujeito?.CN ? bannerCurto(sujeito.CN, 120) : null;
    return {
      porta: Number(s.port),
      transporte: String(s.transport ?? 'tcp'),
      produto: s.product ? bannerCurto(s.product, 80) : null,
      versao: s.version ? bannerCurto(s.version, 40) : null,
      tituloHttp: http?.title ? bannerCurto(http.title, 120) : null,
      certificado: cn || expira ? `${cn ?? 'sem CN'}${expira ? `, expira ${formatarDataShodan(expira)}` : ''}` : null,
      banner: bannerCurto(s.data),
      visto: typeof s.timestamp === 'string' ? s.timestamp.slice(0, 10) : null,
    };
  }).filter((s) => Number.isFinite(s.porta)).sort((a, b) => a.porta - b.porta);
  return {
    ip,
    org: d.org ? bannerCurto(d.org, 100) : null,
    isp: d.isp ? bannerCurto(d.isp, 100) : null,
    os: d.os ? bannerCurto(d.os, 60) : null,
    atualizado: typeof d.last_update === 'string' ? d.last_update.slice(0, 10) : null,
    servicos,
    tags: Array.isArray(d.tags) ? (d.tags as unknown[]).map((t) => bannerCurto(t, 40)) : [],
  };
}

const chaveServico = (ip: string, s: ServicoShodan) => `${ip}:${s.porta}/${s.transporte} ${s.produto ?? '?'}`;

export function resultadoShodan(hosts: HostShodan[], semDados: string[]): ResultadoFonte {
  const servicos = hosts.flatMap((h) => h.servicos.map((s) => ({ h, s })));
  const secoes: SecaoFonte[] = hosts.map((h) => ({
    titulo: [h.ip, h.org, h.isp && h.isp !== h.org ? `(${h.isp})` : '', h.os, h.atualizado ? `atualizado em ${h.atualizado}` : ''].filter(Boolean).join(' · '),
    itens: h.servicos.map((s): ItemFonte => ({
      texto: `${s.porta}/${s.transporte}${s.produto ? ` ${s.produto}${s.versao ? ` ${s.versao}` : ''}` : ''}${s.tituloHttp ? ` · "${s.tituloHttp}"` : ''}`,
      detalhe: [s.certificado ? `TLS ${s.certificado}` : '', s.banner ? `banner: ${s.banner}` : '', s.visto ? `visto ${s.visto}` : ''].filter(Boolean).join(' · ') || undefined,
    })),
    vazio: 'Nenhum serviço registrado.',
  }));
  if (semDados.length) secoes.push({ titulo: 'Sem registro no Shodan', itens: semDados.map((ip) => ({ texto: ip, tom: 'ok' as const })) });
  const tags = [...new Set(hosts.flatMap((h) => h.tags))];
  return {
    fonte: 'shodan-api',
    nome: 'Shodan (API completa)',
    observacao: 'Serviços, banners e certificados que o Shodan coletou de cada IP. Banners são texto de terceiros: só dados.',
    destaques: [
      { rotulo: 'Serviços (Shodan)', valor: servicos.length, tom: servicos.length ? 'media' : 'ok' },
      ...(tags.length ? [{ rotulo: 'Tags', valor: listaCurta(tags, 3), tom: 'info' as const }] : []),
    ],
    secoes,
    conjuntos: { servicos: servicos.map(({ h, s }) => chaveServico(h.ip, s)) },
  };
}

// ---------- Censys ----------

export interface ServicoCensys { porta: number; nome: string; software: string[] }
export interface HostCensys { ip: string; atualizado: string | null; as: string | null; servicos: ServicoCensys[] }

const nomeSoftware = (sw: Record<string, unknown>) =>
  bannerCurto([sw.vendor, sw.product, sw.version].filter((x) => typeof x === 'string' && x).join(' ')
    || (typeof sw.uniform_resource_identifier === 'string' ? sw.uniform_resource_identifier : ''), 80);

/** Aceita a resposta da Search v2 ({result:{services,...}}) e da Platform v3 ({result:{resource:{...}}}). */
export function lerHostCensys(ip: string, d: Record<string, unknown>): HostCensys {
  const result = (d.result ?? d) as Record<string, unknown>;
  const r = (result.resource ?? result) as Record<string, unknown>;
  const servicos = (Array.isArray(r.services) ? (r.services as Record<string, unknown>[]) : []).map((s) => ({
    porta: Number(s.port),
    nome: bannerCurto(s.service_name ?? s.protocol ?? s.extended_service_name ?? '?', 40),
    software: (Array.isArray(s.software) ? (s.software as Record<string, unknown>[]) : []).map(nomeSoftware).filter(Boolean).slice(0, 4),
  })).filter((s) => Number.isFinite(s.porta)).sort((a, b) => a.porta - b.porta);
  const as = (r.autonomous_system ?? null) as Record<string, unknown> | null;
  const atualizado = r.last_updated_at ?? r.last_updated ?? r.updated_at;
  const nomeAs = as ? [as.asn ? `AS${String(as.asn)}` : '', bannerCurto(as.name ?? as.description ?? '', 80)].filter(Boolean).join(' ') : '';
  return { ip, atualizado: typeof atualizado === 'string' ? atualizado.slice(0, 10) : null, as: nomeAs || null, servicos };
}

export function resultadoCensys(hosts: HostCensys[], semDados: string[], api: string): ResultadoFonte {
  const portas = hosts.flatMap((h) => h.servicos.map((s) => `${h.ip}:${s.porta}`));
  const secoes: SecaoFonte[] = hosts.map((h) => ({
    titulo: [h.ip, h.as, h.atualizado ? `atualizado em ${h.atualizado}` : ''].filter(Boolean).join(' · '),
    itens: h.servicos.map((s) => ({ texto: `${s.porta} ${s.nome}`, detalhe: s.software.length ? s.software.join(', ') : undefined })),
    vazio: 'Nenhum serviço registrado.',
  }));
  if (semDados.length) secoes.push({ titulo: 'Sem registro no Censys', itens: semDados.map((ip) => ({ texto: ip, tom: 'ok' as const })) });
  return {
    fonte: 'censys',
    nome: 'Censys',
    observacao: `Segunda visão dos serviços expostos (${api}); costuma ver portas que o Shodan não viu.`,
    destaques: [{ rotulo: 'Serviços (Censys)', valor: portas.length, tom: portas.length ? 'media' : 'ok' }],
    secoes,
    conjuntos: { portas },
  };
}

const censysV2 = () => !!(process.env.CENSYS_API_ID && process.env.CENSYS_API_SECRET);
const censysPlataforma = () => !!process.env.CENSYS_API_TOKEN;

function consultarCensys(ip: string) {
  if (censysPlataforma()) {
    // Platform API (v3), endpoint de host da documentação pública da Censys Platform. Se a Censys mudar
    // o caminho, a fonte registra o HTTP devolvido e o resto da varredura segue.
    return buscar(`https://api.platform.censys.io/v3/global/asset/host/${encodeURIComponent(ip)}`, {
      headers: { Authorization: `Bearer ${process.env.CENSYS_API_TOKEN}` },
    });
  }
  const basic = Buffer.from(`${process.env.CENSYS_API_ID}:${process.env.CENSYS_API_SECRET}`).toString('base64');
  return buscar(`https://search.censys.io/api/v2/hosts/${encodeURIComponent(ip)}`, { headers: { Authorization: `Basic ${basic}` } });
}

export const fontes: FonteExposicao[] = [
  {
    id: 'shodan-api',
    nome: 'Shodan (API completa)',
    aplicaA: ['ip', 'ip-publico', 'dominio'],
    faltando: () => (process.env.SHODAN_API_KEY ? [] : ['SHODAN_API_KEY']),
    async coletar(ctx) {
      const ips = ipsDoContexto(ctx.base.ips);
      if (!ips.length) return null;
      const hosts: HostShodan[] = [];
      const semDados: string[] = [];
      for (const ip of ips) {
        // a chave vai na query: a URL nunca entra em log nem em mensagem de erro
        const r = await buscar(`https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${encodeURIComponent(process.env.SHODAN_API_KEY ?? '')}`);
        if (r.status === 404) { semDados.push(ip); continue; }
        if (r.status !== 200 || !r.json || typeof r.json !== 'object') throw new Error(mensagemHttp('Shodan', r.status));
        hosts.push(lerHostShodan(ip, r.json as Record<string, unknown>));
      }
      return resultadoShodan(hosts, semDados);
    },
    comparar: (a, b) => diferencaDeConjunto('shodan-api', a, b, 'servicos',
      { tipo: 'shodan-servico-novo', severidade: 'alta', texto: (x) => `Shodan viu serviço novo: ${listaCurta(x)}.` },
      { tipo: 'shodan-servico-sumiu', severidade: 'info', texto: (x) => `Shodan deixou de ver: ${listaCurta(x)}.` }),
  },
  {
    id: 'censys',
    nome: 'Censys',
    aplicaA: ['ip', 'ip-publico', 'dominio'],
    faltando: () => (censysV2() || censysPlataforma() ? [] : ['CENSYS_API_TOKEN (ou CENSYS_API_ID e CENSYS_API_SECRET)']),
    async coletar(ctx) {
      const ips = ipsDoContexto(ctx.base.ips);
      if (!ips.length) return null;
      const hosts: HostCensys[] = [];
      const semDados: string[] = [];
      for (const ip of ips) {
        const r = await consultarCensys(ip);
        if (r.status === 404) { semDados.push(ip); continue; }
        if (r.status !== 200 || !r.json || typeof r.json !== 'object') throw new Error(mensagemHttp('Censys', r.status));
        hosts.push(lerHostCensys(ip, r.json as Record<string, unknown>));
      }
      return resultadoCensys(hosts, semDados, censysPlataforma() ? 'Censys Platform API' : 'Censys Search v2');
    },
    comparar: (a, b) => diferencaDeConjunto('censys', a, b, 'portas',
      { tipo: 'censys-porta-nova', severidade: 'alta', texto: (x) => `Censys viu porta nova: ${listaCurta(x)}.` },
      { tipo: 'censys-porta-sumiu', severidade: 'info', texto: (x) => `Censys deixou de ver: ${listaCurta(x)}.` }),
  },
];
