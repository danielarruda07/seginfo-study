import { promises as dnsP } from 'node:dns';
import { isIP } from 'node:net';
import { buscar, diferencaDeConjunto, listaCurta, type ContextoFonte, type FonteExposicao, type ItemFonte, type Mudanca, type ResultadoFonte } from './tipos.js';

/**
 * Reputação dos IPs do alvo, em fontes independentes (uma chave opcional não desliga as outras):
 * - listas de bloqueio DNSBL (sem chave, pelo resolvedor do sistema);
 * - AbuseIPDB (ABUSEIPDB_API_KEY, opcional);
 * - GreyNoise Community (funciona sem chave com limite baixo; GREYNOISE_API_KEY opcional).
 */

const MAX_IPS = 5;
const ipv4s = (ctx: ContextoFonte) => ctx.base.ips.filter((ip) => isIP(ip) === 4).slice(0, MAX_IPS);
const ips = (ctx: ContextoFonte) => ctx.base.ips.filter((ip) => isIP(ip) > 0).slice(0, MAX_IPS);

// ---------- DNSBL ----------

export const LISTAS_DNSBL = ['zen.spamhaus.org', 'b.barracudacentral.org', 'bl.spamcop.net', 'psbl.surriel.com', 'dnsbl.dronebl.org'] as const;

export type EstadoDnsbl = 'limpo' | 'listado' | 'recusada' | 'erro';

/**
 * Interpreta a resposta de uma DNSBL. Sem registro = limpo. 127.255.255.x é a Spamhaus dizendo que
 * recusou a consulta (resolvedor público ou excesso), não uma listagem.
 */
export function classificarDnsbl(enderecos: string[] | null): { estado: EstadoDnsbl; codigos: string[] } {
  if (!enderecos || enderecos.length === 0) return { estado: 'limpo', codigos: [] };
  if (enderecos.every((e) => e.startsWith('127.255.255.'))) return { estado: 'recusada', codigos: enderecos };
  const listados = enderecos.filter((e) => e.startsWith('127.') && !e.startsWith('127.255.255.'));
  return listados.length ? { estado: 'listado', codigos: listados } : { estado: 'erro', codigos: enderecos };
}

export const consultaReversa = (ip: string, zona: string) => `${ip.split('.').reverse().join('.')}.${zona}`;

type Resolver4 = (nome: string) => Promise<string[]>;

export async function consultarDnsbl(ip: string, zona: string, resolver: Resolver4 = (n) => dnsP.resolve4(n)) {
  try {
    return { zona, ...classificarDnsbl(await resolver(consultaReversa(ip, zona))) };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA') return { zona, estado: 'limpo' as const, codigos: [] };
    return { zona, estado: 'erro' as const, codigos: [String(code ?? (e as Error).message)] };
  }
}

export function resultadoDnsbl(consultas: { ip: string; zona: string; estado: EstadoDnsbl; codigos: string[] }[]): ResultadoFonte {
  const listados = consultas.filter((c) => c.estado === 'listado');
  const recusadas = consultas.filter((c) => c.estado === 'recusada' || c.estado === 'erro');
  const item = (c: (typeof consultas)[number]): ItemFonte => ({
    texto: `${c.ip} em ${c.zona}`,
    tom: c.estado === 'listado' ? 'alta' : c.estado === 'limpo' ? 'ok' : 'info',
    detalhe: c.estado === 'listado' ? `listado (${c.codigos.join(', ')})`
      : c.estado === 'recusada' ? 'consulta recusada pela lista (resolvedor público ou limite): resultado desconhecido'
      : c.estado === 'erro' ? `sem resposta (${c.codigos.join(', ')})` : 'limpo',
  });
  return {
    fonte: 'dnsbl',
    nome: 'Listas de bloqueio (DNSBL)',
    observacao: 'Consultadas pelo DNS do servidor. Um IP listado tem e-mail recusado e pode ser bloqueado por sites e serviços; quem expõe honeypot corre esse risco.',
    destaques: [{ rotulo: 'Listas de bloqueio', valor: listados.length ? `${listados.length} listado(s)` : 'nenhuma', tom: listados.length ? 'alta' : 'ok' }],
    secoes: [
      { titulo: 'Listado em', itens: listados.map(item), vazio: 'Nenhuma lista de bloqueio tem estes IPs.' },
      { titulo: 'Todas as consultas', itens: consultas.map(item) },
      ...(recusadas.length ? [{ titulo: 'Sem resultado', itens: recusadas.map(item) }] : []),
    ],
    conjuntos: { listado: listados.map((c) => `${c.ip}|${c.zona}`).sort() },
  };
}

const fonteDnsbl: FonteExposicao = {
  id: 'dnsbl',
  nome: 'Listas de bloqueio (DNSBL)',
  aplicaA: ['ip', 'ip-publico', 'dominio'],
  async coletar(ctx) {
    const alvos = ipv4s(ctx);
    if (!alvos.length) return null;
    const consultas = await Promise.all(alvos.flatMap((ip) => LISTAS_DNSBL.map(async (zona) => ({ ip, ...(await consultarDnsbl(ip, zona)) }))));
    return resultadoDnsbl(consultas);
  },
  comparar: (a, b) => diferencaDeConjunto('dnsbl', a, b, 'listado',
    { tipo: 'reputacao-listado', severidade: 'alta', texto: (x) => `IP entrou em lista de bloqueio: ${listaCurta(x.map((s) => s.replace('|', ' em ')))}.` },
    { tipo: 'reputacao-deslistado', severidade: 'info', texto: (x) => `IP saiu da lista de bloqueio: ${listaCurta(x.map((s) => s.replace('|', ' em ')))}.` }),
};

// ---------- AbuseIPDB ----------

export interface AbuseInfo { ip: string; score: number; denuncias: number; ultima: string | null; uso: string | null; provedor: string | null }

export function lerAbuseIpdb(ip: string, json: unknown): AbuseInfo {
  const d = (json as { data?: Record<string, unknown> })?.data ?? {};
  return {
    ip,
    score: Number(d.abuseConfidenceScore ?? 0),
    denuncias: Number(d.totalReports ?? 0),
    ultima: d.lastReportedAt ? String(d.lastReportedAt) : null,
    uso: d.usageType ? String(d.usageType) : null,
    provedor: d.isp ? String(d.isp) : null,
  };
}

export function resultadoAbuseIpdb(infos: AbuseInfo[]): ResultadoFonte {
  const pior = Math.max(0, ...infos.map((i) => i.score));
  return {
    fonte: 'abuseipdb',
    nome: 'AbuseIPDB',
    observacao: 'Denúncias de abuso feitas por outros administradores nos últimos 90 dias. Pontuação de confiança de 0 a 100.',
    destaques: [{ rotulo: 'AbuseIPDB', valor: `${pior}%`, tom: pior >= 75 ? 'alta' : pior >= 25 ? 'media' : 'ok' }],
    secoes: [{
      titulo: 'Por IP',
      itens: infos.map((i) => ({
        texto: `${i.ip}: ${i.score}% · ${i.denuncias} denúncia(s)`,
        tom: i.score >= 75 ? 'alta' : i.score >= 25 ? 'media' : 'ok',
        link: `https://www.abuseipdb.com/check/${encodeURIComponent(i.ip)}`,
        detalhe: [i.ultima ? `última ${i.ultima.slice(0, 10)}` : 'sem denúncia', i.uso, i.provedor].filter(Boolean).join(' · '),
      })),
    }],
    conjuntos: {
      acima25: infos.filter((i) => i.score >= 25).map((i) => i.ip).sort(),
      acima75: infos.filter((i) => i.score >= 75).map((i) => i.ip).sort(),
    },
  };
}

const fonteAbuse: FonteExposicao = {
  id: 'abuseipdb',
  nome: 'AbuseIPDB',
  aplicaA: ['ip', 'ip-publico', 'dominio'],
  faltando: () => (process.env.ABUSEIPDB_API_KEY ? [] : ['ABUSEIPDB_API_KEY']),
  async coletar(ctx) {
    const alvos = ips(ctx);
    if (!alvos.length) return null;
    const infos = await Promise.all(alvos.map(async (ip) => {
      const r = await buscar(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
        { headers: { Key: process.env.ABUSEIPDB_API_KEY as string } });
      if (r.status === 401 || r.status === 403) throw new Error('AbuseIPDB recusou a chave (ABUSEIPDB_API_KEY).');
      if (r.status === 429) throw new Error('AbuseIPDB: limite diário atingido.');
      if (r.status !== 200) throw new Error(`AbuseIPDB respondeu HTTP ${r.status}.`);
      return lerAbuseIpdb(ip, r.json);
    }));
    return resultadoAbuseIpdb(infos);
  },
  comparar: (a, b) => [
    ...diferencaDeConjunto('abuseipdb', a, b, 'acima75',
      { tipo: 'reputacao-abuse-alta', severidade: 'alta', texto: (x) => `AbuseIPDB passou de 75% para ${listaCurta(x)}: muitas denúncias recentes.` }, null),
    ...diferencaDeConjunto('abuseipdb', a, b, 'acima25',
      { tipo: 'reputacao-abuse-media', severidade: 'media', texto: (x) => `AbuseIPDB passou de 25% para ${listaCurta(x)}.` },
      { tipo: 'reputacao-abuse-baixou', severidade: 'info', texto: (x) => `AbuseIPDB voltou abaixo de 25% para ${listaCurta(x)}.` }),
  ],
};

// ---------- GreyNoise Community ----------

export interface GreyNoiseInfo { ip: string; visto: boolean; ruido: boolean; riot: boolean; classificacao: string | null; nome: string | null; ultimo: string | null }

export function lerGreyNoise(ip: string, status: number, json: unknown): GreyNoiseInfo {
  if (status === 404) return { ip, visto: false, ruido: false, riot: false, classificacao: null, nome: null, ultimo: null };
  if (status === 429) throw new Error('GreyNoise: limite da API comunitária atingido (defina GREYNOISE_API_KEY ou espere).');
  if (status === 401) throw new Error('GreyNoise recusou a chave (GREYNOISE_API_KEY).');
  if (status !== 200) throw new Error(`GreyNoise respondeu HTTP ${status}.`);
  const d = (json ?? {}) as Record<string, unknown>;
  return {
    ip,
    visto: true,
    ruido: d.noise === true,
    riot: d.riot === true,
    classificacao: d.classification ? String(d.classification) : null,
    nome: d.name && d.name !== 'unknown' ? String(d.name) : null,
    ultimo: d.last_seen ? String(d.last_seen) : null,
  };
}

export function resultadoGreyNoise(infos: GreyNoiseInfo[]): ResultadoFonte {
  const maliciosos = infos.filter((i) => i.classificacao === 'malicious');
  const ruidosos = infos.filter((i) => i.ruido);
  return {
    fonte: 'greynoise',
    nome: 'GreyNoise (o IP varre a internet?)',
    observacao: 'O GreyNoise registra quem VARRE a internet. O seu IP aparecer como "ruído" pode indicar que algo seu foi comprometido e está atacando para fora. O honeypot só recebe, então não deveria aparecer.',
    destaques: [{
      rotulo: 'GreyNoise',
      valor: maliciosos.length ? 'malicioso' : ruidosos.length ? 'varrendo' : 'não visto',
      tom: maliciosos.length ? 'alta' : ruidosos.length ? 'media' : 'ok',
    }],
    secoes: [{
      titulo: 'Por IP',
      itens: infos.map((i) => ({
        texto: `${i.ip}: ${!i.visto ? 'não visto varrendo a internet' : i.ruido ? `varrendo a internet (${i.classificacao ?? 'sem classificação'})` : i.riot ? 'serviço comum conhecido (RIOT)' : `visto (${i.classificacao ?? 'sem classificação'})`}`,
        tom: i.classificacao === 'malicious' ? 'alta' : i.ruido ? 'media' : 'ok',
        link: `https://viz.greynoise.io/ip/${encodeURIComponent(i.ip)}`,
        detalhe: [i.nome, i.ultimo ? `último ${i.ultimo}` : null].filter(Boolean).join(' · ') || undefined,
      })),
    }],
    conjuntos: { ruido: ruidosos.map((i) => i.ip).sort(), malicioso: maliciosos.map((i) => i.ip).sort() },
  };
}

const fonteGreyNoise: FonteExposicao = {
  id: 'greynoise',
  nome: 'GreyNoise',
  aplicaA: ['ip', 'ip-publico', 'dominio'],
  async coletar(ctx) {
    const alvos = ipv4s(ctx);
    if (!alvos.length) return null;
    const chave = process.env.GREYNOISE_API_KEY;
    const infos = await Promise.all(alvos.map(async (ip) => {
      const r = await buscar(`https://api.greynoise.io/v3/community/${encodeURIComponent(ip)}`, { headers: chave ? { key: chave } : {} });
      return lerGreyNoise(ip, r.status, r.json);
    }));
    return resultadoGreyNoise(infos);
  },
  comparar: (a, b): Mudanca[] => [
    ...diferencaDeConjunto('greynoise', a, b, 'malicioso',
      { tipo: 'reputacao-greynoise-malicioso', severidade: 'alta', texto: (x) => `GreyNoise classificou como malicioso: ${listaCurta(x)}. Verifique se algo seu está atacando para fora.` }, null),
    ...diferencaDeConjunto('greynoise', a, b, 'ruido',
      { tipo: 'reputacao-greynoise-ruido', severidade: 'alta', texto: (x) => `GreyNoise passou a ver estes IPs varrendo a internet: ${listaCurta(x)}.` },
      { tipo: 'reputacao-greynoise-silencio', severidade: 'info', texto: (x) => `GreyNoise deixou de ver varredura saindo de ${listaCurta(x)}.` }),
  ],
};

export const fontes: FonteExposicao[] = [fonteDnsbl, fonteAbuse, fonteGreyNoise];
