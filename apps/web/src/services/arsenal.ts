import type { ArsenalItem, Artefato, TipoArsenal, DominioArsenal } from '@seginfo/shared';
import { ARSENAL_SEED } from '@/data/arsenal';
import { read, write, uid } from './store';

const KEY = 'arsenal';

function base(): ArsenalItem[] {
  const stored = read<ArsenalItem[] | null>(KEY, null);
  if (stored) return stored;
  write(KEY, ARSENAL_SEED);
  return ARSENAL_SEED;
}

export interface ArsenalFiltro {
  search?: string;
  tipo?: TipoArsenal;
  dominio?: DominioArsenal;
  favorito?: boolean;
}

export function listArsenal(f: ArsenalFiltro = {}): ArsenalItem[] {
  let items = [...base()];
  const search = (f.search ?? '').trim().toLowerCase();
  if (f.tipo) items = items.filter((i) => i.tipo === f.tipo);
  if (f.dominio) items = items.filter((i) => i.dominio === f.dominio);
  if (f.favorito) items = items.filter((i) => i.favorito);
  if (search) {
    items = items.filter(
      (i) => i.nome.toLowerCase().includes(search) || i.resumo.toLowerCase().includes(search) ||
        i.conteudo.toLowerCase().includes(search) || i.tags.some((t) => t.includes(search)),
    );
  }
  return items.sort((a, b) => Number(b.favorito) - Number(a.favorito) || b.atualizadoEm.localeCompare(a.atualizadoEm));
}

export function getArsenal(id: string): ArsenalItem | undefined {
  return base().find((i) => i.id === id);
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function saveArsenal(item: Partial<ArsenalItem> & { nome: string; tipo: TipoArsenal }): ArsenalItem {
  const all = base();
  const now = new Date().toISOString();
  const existing = item.id ? all.find((i) => i.id === item.id) : undefined;
  const full: ArsenalItem = {
    id: item.id || uid(),
    tipo: item.tipo,
    nome: item.nome,
    slug: item.slug || slugify(item.nome),
    dominio: item.dominio ?? 'geral',
    resumo: item.resumo ?? '',
    conteudo: item.conteudo ?? '',
    quandoUsar: item.quandoUsar ?? '',
    requisitos: item.requisitos ?? [],
    tags: item.tags ?? [],
    artefatos: item.artefatos ?? existing?.artefatos ?? [],
    favorito: item.favorito ?? existing?.favorito ?? false,
    criadoEm: existing?.criadoEm ?? now,
    atualizadoEm: now,
  };
  const idx = all.findIndex((i) => i.id === full.id);
  if (idx >= 0) all[idx] = full; else all.unshift(full);
  write(KEY, all);
  return full;
}

export function removeArsenal(id: string): void {
  write(KEY, base().filter((i) => i.id !== id));
}

export function toggleFavorito(id: string): void {
  write(KEY, base().map((i) => (i.id === id ? { ...i, favorito: !i.favorito } : i)));
}

export function addArtefato(itemId: string, artefato: Omit<Artefato, 'id' | 'criadoEm'>): void {
  const all = base();
  const item = all.find((i) => i.id === itemId);
  if (!item) return;
  item.artefatos.push({ ...artefato, id: uid(), criadoEm: new Date().toISOString() });
  item.atualizadoEm = new Date().toISOString();
  write(KEY, all);
}

export function removeArtefato(itemId: string, artefatoId: string): void {
  const all = base();
  const item = all.find((i) => i.id === itemId);
  if (!item) return;
  item.artefatos = item.artefatos.filter((a) => a.id !== artefatoId);
  write(KEY, all);
}

export function resumoArsenal() {
  const all = base();
  return {
    total: all.length,
    prompts: all.filter((i) => i.tipo === 'prompt').length,
    skills: all.filter((i) => i.tipo === 'skill').length,
    agentes: all.filter((i) => i.tipo === 'agente').length,
    favoritos: all.filter((i) => i.favorito).length,
  };
}
