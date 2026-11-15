import { AtivoSchema, type Ativo, type Lab, type TipoAtivo, type EstadoAtivo } from '@seginfo/shared';
import { z } from 'zod';
import { LABS } from '@/data/labs';
import { read, write, uid, paginate, matchesSearch, todayISO, registerSchema, type Page } from './store';
import { planejarSincronizacao } from '@/routes/inventario/sincronizacao';

const KEY = 'inventario';
const LAB_PROGRESS_KEY = 'labs:progresso';
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
    const reais = stored.filter((a) => a.ambiente === 'criecomia' &&
      !a.tags.some((tag) => ['exemplo', 'ficticio', 'documentação'].includes(tag)) &&
      !a.id.startsWith('doc-') && !a.nome.startsWith('Ativo demonstrativo '));
    if (reais.length !== stored.length) write(KEY, reais);
    return reais;
  }
  write(KEY, []);
  return [];
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
      (!search || matchesSearch(search, a.nome, a.endereco, a.funcao, a.tags, a.criticidade ?? '', a.exposicao ?? '')),
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
  write(KEY, []);
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

/**
 * Aplica o resultado de "Sincronizar com o ambiente". Refaz o plano sobre o inventário atual
 * (pode ter mudado desde a prévia) e grava. Nada é apagado; ver routes/inventario/sincronizacao.ts.
 */
export function aplicarSincronizacao(descobertos: Ativo[]): { novos: number; atualizados: number } {
  const plano = planejarSincronizacao(base(), AtivoSchema.array().parse(descobertos), false);
  write(KEY, plano.resultado);
  return { novos: plano.novos.length, atualizados: plano.atualizados.length };
}

/** Plano da sincronização para a prévia, sem gravar nada. */
export const previaSincronizacao = (descobertos: Ativo[], calcularNaoVistos: boolean) =>
  planejarSincronizacao(base(), descobertos, calcularNaoVistos);

/**
 * Importa ativos de um arquivo JSON (lista de Ativo). Quem tem o mesmo id é atualizado,
 * o resto é acrescentado; nada é removido. Usado para carregar o que foi levantado
 * direto nos equipamentos, sem passar pelo repositório.
 */
export function importarAtivos(texto: string): { novos: number; atualizados: number } {
  const lista = AtivoSchema.array().parse(JSON.parse(texto));
  const all = base();
  let novos = 0;
  let atualizados = 0;
  for (const ativo of lista) {
    const idx = all.findIndex((x) => x.id === ativo.id);
    if (idx >= 0) { all[idx] = ativo; atualizados++; } else { all.push(ativo); novos++; }
  }
  write(KEY, all);
  return { novos, atualizados };
}
