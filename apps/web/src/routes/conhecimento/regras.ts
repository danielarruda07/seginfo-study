import type { DominioArsenal, EstadoLeitura, TipoArsenal } from '@seginfo/shared';
import type { Tone } from '@/theme/status';

/**
 * Regras puras das telas de Conhecimento (Biblioteca, Segundo Cérebro, Arsenal IA):
 * metadados de exibição, tags, itens relacionados e o vínculo tag → agentes.
 */

export interface Meta { label: string; tone?: Tone; icon: string }

export const ESTADO_LEITURA_META: Record<EstadoLeitura, Meta> = {
  para_ler: { label: 'Para ler', tone: 'info', icon: 'pi-bookmark' },
  lendo: { label: 'Lendo', tone: 'warning', icon: 'pi-book' },
  lido: { label: 'Lido', tone: 'ok', icon: 'pi-check' },
};
export const ESTADO_LEITURA_OPTS = (Object.keys(ESTADO_LEITURA_META) as EstadoLeitura[])
  .map((value) => ({ value, label: ESTADO_LEITURA_META[value].label }));

export const TIPO_ARSENAL_META: Record<TipoArsenal, Meta> = {
  prompt: { label: 'Prompt', icon: 'pi-comment' },
  skill: { label: 'Skill', icon: 'pi-bolt' },
  agente: { label: 'Agente', icon: 'pi-sitemap' },
};
export const TIPO_ARSENAL_OPTS = (Object.keys(TIPO_ARSENAL_META) as TipoArsenal[])
  .map((value) => ({ value, label: TIPO_ARSENAL_META[value].label, icon: TIPO_ARSENAL_META[value].icon }));

export const DOMINIO_ARSENAL_LABEL: Record<DominioArsenal, string> = {
  red: 'Red Team', blue: 'Blue Team', purple: 'Purple Team', appsec: 'AppSec', osint: 'OSINT', grc: 'GRC', geral: 'Geral',
};
export const DOMINIO_ARSENAL_OPTS = (Object.keys(DOMINIO_ARSENAL_LABEL) as DominioArsenal[])
  .map((value) => ({ value, label: DOMINIO_ARSENAL_LABEL[value] }));

export const ESCOPO_META: Record<'pessoal' | 'corporativo', Meta> = {
  pessoal: { label: 'Pessoal', tone: 'info', icon: 'pi-user' },
  corporativo: { label: 'Corporativo', tone: 'serious', icon: 'pi-briefcase' },
};
export const ESCOPO_OPTS = [
  { label: 'Pessoal (entra no backup e pode alimentar agentes)', value: 'pessoal' },
  { label: 'Corporativo (fora do backup e dos agentes)', value: 'corporativo' },
];

/** Origem gravada pela API: manual (criada aqui), url (captura de página), cofre (importação de notas). */
const ORIGEM_META: Record<string, Meta> = {
  manual: { label: 'Escrita aqui', icon: 'pi-pencil' },
  url: { label: 'Página da web', icon: 'pi-globe' },
  cofre: { label: 'Nota importada', icon: 'pi-file-import' },
};
export const origemMeta = (o: string): Meta => ORIGEM_META[o] ?? { label: o || 'Desconhecida', icon: 'pi-file' };

/** "2026-11-08T13:45:00Z" → "08/11/2026 13:45" (sem fuso; a API já devolve UTC legível). */
export function fmtData(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}`;
}

/** "a, B ,, c" → ["a", "b", "c"] (minúsculas, sem vazios nem repetidos). */
export function parseTags(texto: string): string[] {
  return [...new Set(texto.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

const norm = (t: string) => t.trim().toLowerCase();

/** Filtra itens que tenham a tag (comparação sem caixa). Sem tag devolve a lista como está. */
export function filtrarPorTag<T>(lista: readonly T[], tag: string | undefined, getTags: (i: T) => readonly string[]): T[] {
  if (!tag) return [...lista];
  const alvo = norm(tag);
  return lista.filter((i) => getTags(i).some((t) => norm(t) === alvo));
}

export interface Relacionado<T> { item: T; comuns: string[] }

/**
 * Itens que dividem tags com o alvo, do que mais divide para o que menos divide.
 * `mesmoGrupo` (mesma categoria/domínio) desempata e, sem tags em comum, ainda conta como relação fraca.
 */
export function relacionadosPorTags<T>(
  alvo: T,
  lista: readonly T[],
  opts: { getId: (i: T) => string; getTags: (i: T) => readonly string[]; mesmoGrupo?: (a: T, b: T) => boolean; max?: number },
): Relacionado<T>[] {
  const tagsAlvo = new Set(opts.getTags(alvo).map(norm));
  const idAlvo = opts.getId(alvo);
  const vistos = new Set<string>();
  const out: (Relacionado<T> & { score: number })[] = [];
  for (const item of lista) {
    const id = opts.getId(item);
    if (id === idAlvo || vistos.has(id)) continue;
    vistos.add(id);
    const comuns = [...new Set(opts.getTags(item).map(norm))].filter((t) => tagsAlvo.has(t));
    const grupo = opts.mesmoGrupo?.(alvo, item) ? 0.5 : 0;
    const score = comuns.length + grupo;
    if (score > 0) out.push({ item, comuns, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.max ?? 5).map(({ item, comuns }) => ({ item, comuns }));
}

export interface AgenteComBase { id: string; nome: string; baseTags: readonly string[] }

/** Agentes cuja base de conhecimento inclui alguma das tags, com as tags que casaram. */
export function agentesDasTags<A extends AgenteComBase>(agentes: readonly A[], tags: readonly string[]): { agente: A; tags: string[] }[] {
  const alvo = new Set(tags.map(norm));
  return agentes
    .map((agente) => ({ agente, tags: [...new Set(agente.baseTags.map(norm))].filter((t) => alvo.has(t)) }))
    .filter((r) => r.tags.length > 0)
    .sort((a, b) => b.tags.length - a.tags.length || a.agente.nome.localeCompare(b.agente.nome));
}

export interface TagNaBase { tag: string; memorias: number; agentes: string[] }

/**
 * Para cada tag do item: quantas memórias pessoais do Segundo Cérebro têm a tag e quais agentes
 * a usam como base. Só a base pessoal alimenta agentes (corporativo nunca entra).
 */
export function tagsNaBase(tags: readonly string[], base: readonly { tag: string; total: number }[], agentes: readonly AgenteComBase[]): TagNaBase[] {
  const total = new Map(base.map((b) => [norm(b.tag), b.total]));
  return [...new Set(tags.map(norm))].map((tag) => ({
    tag,
    memorias: total.get(tag) ?? 0,
    agentes: agentes.filter((a) => a.baseTags.some((t) => norm(t) === tag)).map((a) => a.nome).sort((a, b) => a.localeCompare(b)),
  }));
}

/** Junta listas (ex.: uma consulta por tag), sem repetir id, mantendo a primeira ocorrência. */
export function unicosPorId<T extends { id: string }>(listas: readonly (readonly T[] | undefined)[]): T[] {
  const vistos = new Map<string, T>();
  for (const l of listas) for (const i of l ?? []) if (!vistos.has(i.id)) vistos.set(i.id, i);
  return [...vistos.values()];
}

/** Texto que vai para o Segundo Cérebro ao guardar um item da Biblioteca. */
export function memoriaDaLeitura(i: { titulo: string; url: string; resumo: string; anotacoes: string; textoOriginal: string }): string {
  return [
    `Fonte: ${i.url}`,
    i.resumo && `## Resumo\n${i.resumo}`,
    i.anotacoes.trim() && `## Minhas anotações\n${i.anotacoes.trim()}`,
    i.textoOriginal.trim() && `## Texto salvo\n${i.textoOriginal.trim()}`,
  ].filter(Boolean).join('\n\n');
}
