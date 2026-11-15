/**
 * Contrato das fontes extras da "Minha exposição". Cada fonte é um arquivo nesta pasta que exporta
 * `fontes: FonteExposicao[]` e entra no registro de `index.ts`.
 *
 * A fonte coleta, devolve um resultado já pronto para exibir (destaques no card e seções na ficha)
 * e diz o que mudou em relação à varredura anterior. A tela não conhece nenhuma fonte: ela só
 * desenha `destaques` e `secoes`. Assim uma fonte nova não exige mudança na interface.
 */

export type TipoAlvo = 'dominio' | 'ip' | 'ip-publico' | 'email';
export type Severidade = 'alta' | 'media' | 'info';
export type Tom = 'alta' | 'media' | 'info' | 'ok';

export interface Mudanca {
  /** identificador estável do tipo de mudança, ex.: 'porta-aberta', 'reputacao-listado' */
  tipo: string;
  severidade: Severidade;
  texto: string;
  /** id da fonte que gerou (ausente nas fontes básicas) */
  fonte?: string;
}

export interface DestaqueFonte { rotulo: string; valor: string | number; tom?: Tom }
export interface ItemFonte { texto: string; tom?: Tom; link?: string; detalhe?: string }
export interface SecaoFonte { titulo: string; itens: ItemFonte[]; vazio?: string }

export interface ResultadoFonte {
  fonte: string;
  nome: string;
  /** uma frase sobre de onde vêm os dados e o que significam */
  observacao?: string;
  /** até ~4 números ou estados curtos para o card do alvo */
  destaques: DestaqueFonte[];
  /** blocos da ficha do alvo */
  secoes: SecaoFonte[];
  /** conjuntos comparáveis entre varreduras (ex.: { listas: ['zen.spamhaus.org'] }) */
  conjuntos: Record<string, string[]>;
}

/** O que as fontes básicas já descobriram, para a fonte extra reaproveitar (ex.: os IPs do domínio). */
export interface BaseColetada {
  ips: string[];
  /** portas por IP vistas pelo Shodan InternetDB */
  portasPorIp: Record<string, number[]>;
}

export interface ContextoFonte {
  alvo: { tipo: TipoAlvo; valor: string };
  base: BaseColetada;
}

export interface FonteExposicao {
  id: string;
  nome: string;
  aplicaA: TipoAlvo[];
  /** variáveis opcionais que faltam: com faltas, a fonte fica desligada (não é erro) */
  faltando?: () => string[];
  /** null quando não há o que dizer para este alvo */
  coletar(ctx: ContextoFonte): Promise<ResultadoFonte | null>;
  comparar?(anterior: ResultadoFonte, atual: ResultadoFonte, ctx: ContextoFonte): Mudanca[];
}

/** Ajuda para comparar um conjunto: o que entrou e o que saiu, cada um com sua frase e gravidade. */
export function diferencaDeConjunto(
  fonte: string,
  anterior: ResultadoFonte,
  atual: ResultadoFonte,
  conjunto: string,
  entrou: { tipo: string; severidade: Severidade; texto: (itens: string[]) => string } | null,
  saiu: { tipo: string; severidade: Severidade; texto: (itens: string[]) => string } | null,
): Mudanca[] {
  const a = anterior.conjuntos[conjunto];
  const b = atual.conjuntos[conjunto];
  if (!a || !b) return [];
  const antes = new Set(a);
  const agora = new Set(b);
  const novos = [...agora].filter((x) => !antes.has(x)).sort();
  const sairam = [...antes].filter((x) => !agora.has(x)).sort();
  const out: Mudanca[] = [];
  if (entrou && novos.length) out.push({ tipo: entrou.tipo, severidade: entrou.severidade, texto: entrou.texto(novos), fonte });
  if (saiu && sairam.length) out.push({ tipo: saiu.tipo, severidade: saiu.severidade, texto: saiu.texto(sairam), fonte });
  return out;
}

export const listaCurta = (xs: string[], n = 5) => (xs.length > n ? `${xs.slice(0, n).join(', ')} e mais ${xs.length - n}` : xs.join(', '));

/** fetch com prazo e User-Agent genérico (nunca dados pessoais). */
export async function buscar(url: string, init: RequestInit & { ms?: number } = {}): Promise<{ status: number; json: unknown; texto: string }> {
  const { ms = 20_000, headers, ...resto } = init;
  const r = await fetch(url, { ...resto, headers: { 'User-Agent': 'seginfo-study-osint/1.0', Accept: 'application/json', ...(headers ?? {}) }, signal: AbortSignal.timeout(ms) });
  const texto = await r.text();
  let json: unknown = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = null; }
  return { status: r.status, json, texto };
}
