import { isIP } from 'node:net';
import { ipNaoPublico } from './osint.js';

/**
 * GreyNoise Community: separa o "ruído de fundo" da internet (scanners que varrem tudo, bots
 * conhecidos, serviços legítimos) dos atacantes que só aparecem no seu ambiente.
 *
 * - API: https://api.greynoise.io/v3/community/{ip}. GREYNOISE_API_KEY é opcional (header `key`);
 *   sem chave o limite diário é bem baixo.
 * - 404 = o GreyNoise nunca viu este IP varrendo a internet: para quem bateu no honeypot, isso sugere
 *   algo direcionado ou novo, e é o mais interessante de olhar.
 * - Fila global com uma consulta por vez e intervalo mínimo entre chamadas; cache de 24 h em memória.
 */

export type EstadoGreynoise = 'ruido' | 'malicioso' | 'benigno' | 'nao-visto' | 'limite' | 'erro';

export interface ClassificacaoGreynoise {
  ip: string;
  estado: EstadoGreynoise;
  /** visto varrendo a internet */
  noise: boolean;
  /** serviço comum de negócio (RIOT): CDN, provedores, etc. */
  riot: boolean;
  classification: string | null;
  name: string | null;
  link: string;
  last_seen: string | null;
  mensagem?: string;
  consultadoEm: string;
}

const URL_API = 'https://api.greynoise.io/v3/community/';
export const linkVisualizador = (ip: string) => `https://viz.greynoise.io/ip/${encodeURIComponent(ip)}`;

const CACHE_MS = 24 * 3_600_000;
const CACHE_MAX = 5000;
export const INTERVALO_MIN_MS = 1500;
/** depois de um 429, segura novas consultas por este tempo */
const ESPERA_429_MS = 10 * 60_000;

const cache = new Map<string, { valor: ClassificacaoGreynoise; ate: number }>();
let fila: Promise<unknown> = Promise.resolve();
let ultimaChamada = 0;
let bloqueadoAte = 0;

/** Para testes: zera cache, fila e relógio. */
export function _reiniciarGreynoise() {
  cache.clear();
  fila = Promise.resolve();
  ultimaChamada = 0;
  bloqueadoAte = 0;
}

export function deCache(ip: string): ClassificacaoGreynoise | null {
  const c = cache.get(ip);
  if (!c) return null;
  if (c.ate < Date.now()) { cache.delete(ip); return null; }
  return c.valor;
}

function guardar(v: ClassificacaoGreynoise) {
  // limite e erro não ficam em cache: dá para tentar de novo mais tarde
  if (v.estado === 'limite' || v.estado === 'erro') return;
  if (cache.size >= CACHE_MAX) {
    const maisAntiga = cache.keys().next().value;
    if (maisAntiga !== undefined) cache.delete(maisAntiga);
  }
  cache.set(v.ip, { valor: v, ate: Date.now() + CACHE_MS });
}

/** Lê a resposta da API e decide o estado mostrado no Radar. */
export function interpretarResposta(ip: string, status: number, corpo: unknown): ClassificacaoGreynoise {
  const base = {
    ip, noise: false, riot: false, classification: null, name: null, link: linkVisualizador(ip), last_seen: null,
    consultadoEm: new Date().toISOString(),
  };
  if (status === 404) return { ...base, estado: 'nao-visto', mensagem: 'Nunca visto varrendo a internet.' };
  if (status === 429) return { ...base, estado: 'limite', mensagem: 'Limite atingido no GreyNoise. Tente mais tarde.' };
  if (status !== 200 || !corpo || typeof corpo !== 'object') return { ...base, estado: 'erro', mensagem: `GreyNoise respondeu HTTP ${status}.` };
  const d = corpo as Record<string, unknown>;
  const noise = d.noise === true;
  const riot = d.riot === true;
  const classification = typeof d.classification === 'string' ? d.classification : null;
  const estado: EstadoGreynoise = classification === 'malicious' ? 'malicioso'
    : riot || classification === 'benign' ? 'benigno'
    : noise ? 'ruido' : 'nao-visto';
  return {
    ...base,
    estado,
    noise,
    riot,
    classification,
    name: typeof d.name === 'string' && d.name !== 'unknown' ? d.name : null,
    link: typeof d.link === 'string' && d.link.startsWith('https://') ? d.link : base.link,
    last_seen: typeof d.last_seen === 'string' ? d.last_seen : null,
  };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function consultar(ip: string): Promise<ClassificacaoGreynoise> {
  if (Date.now() < bloqueadoAte) return interpretarResposta(ip, 429, null);
  const falta = ultimaChamada + INTERVALO_MIN_MS - Date.now();
  if (falta > 0) await esperar(falta);
  ultimaChamada = Date.now();
  const chave = process.env.GREYNOISE_API_KEY?.trim();
  try {
    const r = await fetch(`${URL_API}${encodeURIComponent(ip)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'seginfo-study-radar/1.0', ...(chave ? { key: chave } : {}) },
      signal: AbortSignal.timeout(15_000),
    });
    const texto = await r.text();
    let corpo: unknown = null;
    try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = null; }
    if (r.status === 429) bloqueadoAte = Date.now() + ESPERA_429_MS;
    return interpretarResposta(ip, r.status, corpo);
  } catch (e) {
    return { ...interpretarResposta(ip, 0, null), mensagem: `GreyNoise não respondeu: ${(e as Error).message}` };
  }
}

/** Classifica um IP público. Usa o cache; consultas novas entram na fila global (uma por vez). */
export async function classificarIp(ip: string): Promise<ClassificacaoGreynoise> {
  if (!isIP(ip) || ipNaoPublico(ip)) throw new Error('IP privado, reservado ou inválido: o GreyNoise só conhece IPs da internet.');
  const c = deCache(ip);
  if (c) return c;
  const tarefa = fila.then(async () => {
    const outra = deCache(ip); // pode ter sido consultado enquanto esperava na fila
    if (outra) return outra;
    const v = await consultar(ip);
    guardar(v);
    return v;
  });
  fila = tarefa.catch(() => undefined);
  return tarefa;
}
