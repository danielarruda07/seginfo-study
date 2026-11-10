import { AtivoSchema, type Ativo, type Lab, type TipoAtivo, type EstadoAtivo } from '@seginfo/shared';
import { z } from 'zod';
import { INVENTARIO_SEED } from '@/data/inventario';
import { LABS } from '@/data/labs';
import { read, write, uid, paginate, matchesSearch, todayISO, registerSchema, type Page } from './store';

const KEY = 'inventario';
const LAB_PROGRESS_KEY = 'labs:progresso';
const SEED_VERSION_KEY = 'inventario:seed-version';
const SEED_VERSION = 3;
registerSchema(KEY, { safeParse: (v) => AtivoSchema.array().safeParse(v) });
registerSchema(LAB_PROGRESS_KEY, { safeParse: (v) => z.record(z.string(), z.object({ status: z.enum(['nao_iniciado', 'em_andamento', 'concluido']), concluidoEm: z.string().optional(), aprendizado: z.string(), evidencia: z.string().default(''), mitre: z.array(z.string()) })).safeParse(v) });

export type EstadoLab = 'nao_iniciado' | 'em_andamento' | 'concluido';
export interface ProgressoLab {
  status: EstadoLab;
  concluidoEm?: string;
  aprendizado: string;
  evidencia: string;
  mitre: string[];
}

export const ESTADO_LAB_LABEL: Record<EstadoLab, string> = {
  nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', concluido: 'Concluído',
};

export function getProgressoLab(id: string): ProgressoLab {
  const all = read<Record<string, ProgressoLab>>(LAB_PROGRESS_KEY, {});
  return all[id] ?? { status: 'nao_iniciado', aprendizado: '', evidencia: '', mitre: [] };
}

export function saveProgressoLab(id: string, progresso: ProgressoLab): void {
  const all = read<Record<string, ProgressoLab>>(LAB_PROGRESS_KEY, {});
  const concluidoEm = progresso.status === 'concluido' ? (progresso.concluidoEm || todayISO()) : undefined;
  write(LAB_PROGRESS_KEY, { ...all, [id]: { ...progresso, concluidoEm } });
}

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
  write(SEED_VERSION_KEY, SEED_VERSION);
  return INVENTARIO_SEED;
}

export function inventarioSeedUpdate() {
  const currentVersion = read<number>(SEED_VERSION_KEY, 1);
  const ativos = read<Ativo[]>(KEY, []);
  const known = new Set(ativos.map((a) => a.id));
  const novidades = INVENTARIO_SEED.filter((a) => !known.has(a.id));
  return { disponivel: currentVersion < SEED_VERSION && novidades.length > 0, quantidade: novidades.length };
}

export function incorporarNovidadesSeed(): number {
  const ativos = read<Ativo[]>(KEY, []);
  const known = new Set(ativos.map((a) => a.id));
  const novidades = INVENTARIO_SEED.filter((a) => !known.has(a.id));
  write(KEY, [...ativos, ...novidades]);
  write(SEED_VERSION_KEY, SEED_VERSION);
  return novidades.length;
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
  write(SEED_VERSION_KEY, SEED_VERSION);
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
