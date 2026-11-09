import type { Ativo, Lab, TipoAtivo, EstadoAtivo } from '@seginfo/shared';
import { INVENTARIO_SEED } from '@/data/inventario';
import { LABS } from '@/data/labs';
import { read, write, uid, paginate, matchesSearch, type Page } from './store';

const KEY = 'inventario';

function base(): Ativo[] {
  const stored = read<Ativo[] | null>(KEY, null);
  if (stored) {
    // o inventário guarda só o homelab: remove ativos de outros ambientes
    // que tenham ficado salvos de versões anteriores (ou vindos de um backup)
    const homelab = stored.filter((a) => a.ambiente === 'criecomia');
    if (homelab.length !== stored.length) write(KEY, homelab);
    return homelab;
  }
  write(KEY, INVENTARIO_SEED);
  return INVENTARIO_SEED;
}

export interface AtivoFiltro {
  search?: string;
  tipo?: TipoAtivo;
  estado?: EstadoAtivo;
  page?: number;
  rows?: number;
}

export function listAtivos(f: AtivoFiltro = {}): Page<Ativo> {
  const search = (f.search ?? '').trim().toLowerCase();
  const items = base().filter(
    (a) =>
      (!f.tipo || a.tipo === f.tipo) &&
      (!f.estado || a.estado === f.estado) &&
      (!search || matchesSearch(search, a.nome, a.endereco, a.funcao, a.tags)),
  );
  return paginate(items, f.page, f.rows);
}

export function getAtivo(id: string): Ativo | undefined {
  return base().find((a) => a.id === id);
}

export function saveAtivo(a: Ativo): void {
  const all = base();
  const idx = all.findIndex((x) => x.id === a.id);
  if (idx >= 0) all[idx] = a; else all.push({ ...a, id: a.id || uid() });
  write(KEY, all);
}

export function removeAtivo(id: string): void {
  write(KEY, base().filter((a) => a.id !== id));
}

export function resetInventario(): void {
  write(KEY, INVENTARIO_SEED);
}

export function resumoInventario() {
  const all = base();
  const count = (pred: (a: Ativo) => boolean) => all.filter(pred).length;
  return {
    total: all.length,
    criticos: count((a) => a.estado === 'critico'),
    atencao: count((a) => a.estado === 'atencao'),
    planejados: count((a) => a.estado === 'planejado'),
  };
}

// ---- Labs ----
export function listLabs(): Lab[] {
  return LABS;
}
export function getLab(id: string): Lab | undefined {
  return LABS.find((l) => l.id === id);
}
export function labsDoAtivo(ativoId: string): Lab[] {
  return LABS.filter((l) => l.ativosAlvo.includes(ativoId));
}
