import type { Topico, Trilha, StatusEstudo } from '@seginfo/shared';
import { TRILHAS } from '@/data/trilhas';
import { TOPICOS } from '@/data/topicos';
import { read, write, paginate, matchesSearch, type Page } from './store';

export type TopicoComStatus = Topico & { status: StatusEstudo };

export interface TopicoFiltro {
  search?: string;
  trilhaId?: string;
  status?: StatusEstudo;
  referencia?: string;
  page?: number;
  rows?: number;
}

export interface Progresso {
  total: number;
  concluidos: number;
  estudando: number;
  pct: number;
}

export function listTrilhas(): Trilha[] {
  return [...TRILHAS].sort((a, b) => a.ordem - b.ordem);
}

export function getTrilha(id: string): Trilha | undefined {
  return TRILHAS.find((t) => t.id === id);
}

/** Opções { label, value } das trilhas para Dropdowns. */
export function trilhaOptions(): { label: string; value: string }[] {
  return listTrilhas().map((t) => ({ label: t.titulo, value: t.id }));
}

export function getTopico(id: string): Topico | undefined {
  return TOPICOS.find((t) => t.id === id);
}

/** Mapa topicoId -> status, lido do localStorage. */
export function getStatusMap(): Record<string, StatusEstudo> {
  return read<Record<string, StatusEstudo>>('status', {});
}

export function setStatus(topicoId: string, status: StatusEstudo): void {
  write('status', { ...getStatusMap(), [topicoId]: status });
}

export function getAnotacoes(): Record<string, string> {
  return read<Record<string, string>>('anotacoes', {});
}

export function setAnotacao(topicoId: string, texto: string): void {
  write('anotacoes', { ...getAnotacoes(), [topicoId]: texto });
}

/** Todos os tópicos com o status atual do usuário. */
function topicosComStatus(): TopicoComStatus[] {
  const statusMap = getStatusMap();
  return TOPICOS.map((t) => ({ ...t, status: statusMap[t.id] ?? 'a_estudar' }));
}

/** Conta total/concluídos/estudando e calcula o % concluído. */
function contarProgresso(topicos: TopicoComStatus[]): Progresso {
  const total = topicos.length;
  const concluidos = topicos.filter((t) => t.status === 'concluido').length;
  const estudando = topicos.filter((t) => t.status === 'estudando').length;
  return { total, concluidos, estudando, pct: total ? Math.round((concluidos / total) * 100) : 0 };
}

/** Listagem filtrada e paginada (filtro no "servidor" = esta função). */
export function listTopicos(f: TopicoFiltro = {}): Page<TopicoComStatus> {
  const search = (f.search ?? '').trim().toLowerCase();
  const items = topicosComStatus().filter(
    (t) =>
      (!f.trilhaId || t.trilhaId === f.trilhaId) &&
      (!f.status || t.status === f.status) &&
      (!f.referencia || t.ferramentas.some((fr) => fr.referencia === f.referencia)) &&
      (!search || matchesSearch(search, t.titulo, t.resumo, t.tags, t.ferramentas.map((fr) => fr.nome))),
  );
  return paginate(items, f.page, f.rows);
}

/** Progresso agregado por trilha. */
export function progressoPorTrilha(): Record<string, Progresso> {
  const todos = topicosComStatus();
  return Object.fromEntries(
    TRILHAS.map((tr) => [tr.id, contarProgresso(todos.filter((t) => t.trilhaId === tr.id))]),
  );
}

export function resumoGeral() {
  const p = contarProgresso(topicosComStatus());
  return { ...p, aEstudar: p.total - p.concluidos - p.estudando };
}
