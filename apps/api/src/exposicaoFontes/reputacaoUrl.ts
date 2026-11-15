import { buscar, diferencaDeConjunto, listaCurta, type FonteExposicao, type ResultadoFonte, type Tom } from './tipos.js';

/**
 * Reputação do domínio e dos IPs em serviços de análise:
 * - urlscan.io (busca pública; URLSCAN_API_KEY opcional no cabeçalho API-Key): quem já analisou
 *   páginas do domínio e se alguma foi marcada como maliciosa.
 * - VirusTotal (VT_API_KEY no cabeçalho x-apikey): veredito dos motores, reputação e categorias.
 */

// ---------- urlscan.io ----------

export interface AnaliseUrlscan { uuid: string; quando: string; url: string; maliciosa: boolean; link: string; imagem?: string }

export function lerUrlscan(json: unknown): { total: number; analises: AnaliseUrlscan[] } {
  const d = json as { total?: number; results?: Record<string, unknown>[] } | null;
  const analises = (d?.results ?? []).map((r) => {
    const task = (r.task ?? {}) as { uuid?: string; time?: string; url?: string };
    const page = (r.page ?? {}) as { url?: string };
    const v = (r.verdicts ?? {}) as { malicious?: boolean; overall?: { malicious?: boolean } } | null;
    const rotulos = Array.isArray(r.labels) ? (r.labels as unknown[]).map(String) : [];
    const uuid = String(task.uuid ?? r._id ?? '');
    return {
      uuid,
      quando: String(task.time ?? ''),
      url: String(page.url ?? task.url ?? ''),
      maliciosa: v?.malicious === true || v?.overall?.malicious === true || rotulos.some((l) => /malicious|phishing|malware/i.test(l)),
      link: uuid ? `https://urlscan.io/result/${uuid}/` : '',
      imagem: typeof r.screenshot === 'string' ? r.screenshot : undefined,
    };
  });
  return { total: typeof d?.total === 'number' ? d.total : analises.length, analises };
}

const ID_URLSCAN = 'reputacao-urlscan';
const NOME_URLSCAN = 'Análises públicas (urlscan.io)';

export function resultadoUrlscan(total: number, analises: AnaliseUrlscan[]): ResultadoFonte {
  const maliciosas = analises.filter((a) => a.maliciosa);
  const recentes = [...analises].sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 15);
  const item = (a: AnaliseUrlscan) => ({
    texto: `${a.quando.slice(0, 10)} · ${a.url}`, link: a.link || undefined,
    tom: (a.maliciosa ? 'alta' : undefined) as Tom | undefined, detalhe: a.maliciosa ? 'marcada como maliciosa' : undefined,
  });
  return {
    fonte: ID_URLSCAN, nome: NOME_URLSCAN,
    observacao: 'Páginas do domínio que alguém mandou analisar no urlscan.io (últimos 30 dias na busca pública). Muitas análises de terceiros podem indicar que o domínio está sendo usado em campanha.',
    destaques: [
      { rotulo: 'Análises urlscan', valor: total, tom: 'info' },
      ...(maliciosas.length ? [{ rotulo: 'Maliciosas', valor: maliciosas.length, tom: 'alta' as Tom }] : []),
    ],
    secoes: [
      ...(maliciosas.length ? [{ titulo: 'Marcadas como maliciosas', itens: maliciosas.map(item) }] : []),
      { titulo: 'Análises mais recentes', vazio: 'Ninguém analisou páginas deste domínio no período.', itens: recentes.map(item) },
    ],
    conjuntos: { maliciosas: maliciosas.map((a) => a.uuid) },
  };
}

// ---------- VirusTotal ----------

export interface VereditoVt {
  alvo: string;
  maliciosos: number;
  suspeitos: number;
  inofensivos: number;
  naoDetectados: number;
  reputacao: number | null;
  categorias: string[];
  analisadoEm: string | null;
  dono?: string;
}

export function lerVirusTotal(alvo: string, json: unknown): VereditoVt {
  const a = ((json as { data?: { attributes?: Record<string, unknown> } } | null)?.data?.attributes ?? {}) as Record<string, unknown>;
  const s = (a.last_analysis_stats ?? {}) as Record<string, number>;
  const cat = (a.categories ?? {}) as Record<string, string>;
  const data = typeof a.last_analysis_date === 'number' ? new Date(a.last_analysis_date * 1000).toISOString().slice(0, 10) : null;
  return {
    alvo,
    maliciosos: s.malicious ?? 0,
    suspeitos: s.suspicious ?? 0,
    inofensivos: s.harmless ?? 0,
    naoDetectados: s.undetected ?? 0,
    reputacao: typeof a.reputation === 'number' ? a.reputation : null,
    categorias: [...new Set(Object.values(cat).map(String))].slice(0, 8),
    analisadoEm: data,
    dono: a.as_owner ? String(a.as_owner) : undefined,
  };
}

const ID_VT = 'reputacao-virustotal';
const NOME_VT = 'Reputação (VirusTotal)';

export function resultadoVirusTotal(vereditos: VereditoVt[]): ResultadoFonte {
  const maliciosos = vereditos.reduce((t, v) => t + v.maliciosos, 0);
  const suspeitos = vereditos.reduce((t, v) => t + v.suspeitos, 0);
  return {
    fonte: ID_VT, nome: NOME_VT,
    observacao: 'Quantos motores do VirusTotal classificam o alvo como malicioso ou suspeito. Um ou dois motores isolados podem ser falso positivo; vários juntos merecem investigação.',
    destaques: [{ rotulo: 'VirusTotal', valor: maliciosos ? `${maliciosos} maliciosos` : suspeitos ? `${suspeitos} suspeitos` : 'limpo', tom: maliciosos ? 'alta' : suspeitos ? 'media' : 'ok' }],
    secoes: vereditos.map((v) => ({
      titulo: v.alvo,
      itens: [
        { texto: `Motores: ${v.maliciosos} maliciosos, ${v.suspeitos} suspeitos, ${v.inofensivos} inofensivos, ${v.naoDetectados} sem detecção`, tom: (v.maliciosos ? 'alta' : v.suspeitos ? 'media' : 'ok') as Tom },
        ...(v.reputacao !== null ? [{ texto: `Reputação da comunidade: ${v.reputacao}`, tom: (v.reputacao < 0 ? 'media' : undefined) as Tom | undefined }] : []),
        ...(v.categorias.length ? [{ texto: `Categorias: ${v.categorias.join(', ')}` }] : []),
        ...(v.dono ? [{ texto: `Rede: ${v.dono}` }] : []),
        { texto: 'Abrir no VirusTotal', link: `https://www.virustotal.com/gui/${v.alvo.includes(':') || /^[\d.]+$/.test(v.alvo) ? 'ip-address' : 'domain'}/${encodeURIComponent(v.alvo)}`, detalhe: v.analisadoEm ? `última análise ${v.analisadoEm}` : undefined },
      ],
    })),
    conjuntos: { maliciosos: vereditos.filter((v) => v.maliciosos > 0).map((v) => v.alvo) },
  };
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** plano grátis: 4 consultas por minuto */
const INTERVALO_VT_MS = 15_500;

async function consultarVt(caminho: string): Promise<unknown> {
  const r = await buscar(`https://www.virustotal.com/api/v3/${caminho}`, { headers: { 'x-apikey': process.env.VT_API_KEY as string } });
  if (r.status === 401 || r.status === 403) throw new Error(`VirusTotal recusou a chave (HTTP ${r.status}). Confira VT_API_KEY.`);
  if (r.status === 429) throw new Error('VirusTotal limitou as consultas (HTTP 429; plano grátis: 4/min e 500/dia).');
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(`VirusTotal respondeu HTTP ${r.status}.`);
  return r.json;
}

export const fontes: FonteExposicao[] = [
  {
    id: ID_URLSCAN,
    nome: NOME_URLSCAN,
    aplicaA: ['dominio'],
    async coletar({ alvo }) {
      const chave = process.env.URLSCAN_API_KEY;
      const r = await buscar(`https://urlscan.io/api/v1/search/?q=${encodeURIComponent(`domain:${alvo.valor}`)}&size=50`, {
        headers: chave ? { 'API-Key': chave } : {},
      });
      if (r.status === 429) throw new Error('urlscan.io limitou as consultas (HTTP 429). Uma URLSCAN_API_KEY grátis aumenta o limite.');
      if (r.status !== 200) throw new Error(`urlscan.io respondeu HTTP ${r.status}.`);
      const { total, analises } = lerUrlscan(r.json);
      return resultadoUrlscan(total, analises);
    },
    comparar: (a, b) => diferencaDeConjunto(ID_URLSCAN, a, b, 'maliciosas',
      { tipo: 'urlscan-maliciosa', severidade: 'alta', texto: (xs) => `urlscan.io marcou ${xs.length} análise(s) nova(s) do domínio como maliciosa(s).` }, null),
  },
  {
    id: ID_VT,
    nome: NOME_VT,
    aplicaA: ['dominio', 'ip', 'ip-publico'],
    faltando: () => (process.env.VT_API_KEY ? [] : ['VT_API_KEY']),
    async coletar({ alvo, base }) {
      const pedidos: { alvo: string; caminho: string }[] = alvo.tipo === 'dominio'
        ? [{ alvo: alvo.valor, caminho: `domains/${encodeURIComponent(alvo.valor)}` }]
        : base.ips.slice(0, 3).map((ip) => ({ alvo: ip, caminho: `ip_addresses/${encodeURIComponent(ip)}` }));
      if (!pedidos.length) return null;
      const vereditos: VereditoVt[] = [];
      for (const [i, p] of pedidos.entries()) {
        if (i > 0) await espera(INTERVALO_VT_MS);
        const json = await consultarVt(p.caminho);
        if (json) vereditos.push(lerVirusTotal(p.alvo, json));
      }
      return resultadoVirusTotal(vereditos);
    },
    comparar: (a, b) => diferencaDeConjunto(ID_VT, a, b, 'maliciosos',
      { tipo: 'virustotal-malicioso', severidade: 'alta', texto: (xs) => `VirusTotal passou a classificar como malicioso: ${listaCurta(xs)}.` },
      { tipo: 'virustotal-limpo', severidade: 'info', texto: (xs) => `VirusTotal deixou de classificar como malicioso: ${listaCurta(xs)}.` }),
  },
];
