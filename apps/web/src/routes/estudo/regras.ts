import type { Meta, Nivel, SessaoEstudo, StatusEstudo } from '@seginfo/shared';
import type { Tone } from '@/theme/status';

/** Regras puras das telas de Estudo (painel, trilhas, tópicos, sessões e metas). */

export const STATUS_TOPICO: Record<StatusEstudo, { label: string; tone?: Tone; icon: string }> = {
  a_estudar: { label: 'A estudar', icon: 'pi-circle' },
  estudando: { label: 'Estudando', tone: 'info', icon: 'pi-play-circle' },
  concluido: { label: 'Concluído', tone: 'ok', icon: 'pi-check-circle' },
};

export const NIVEL_LABEL: Record<Nivel, string> = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' };

/** Próximo status sugerido pelo botão principal da ficha do tópico. */
export function proximaAcaoTopico(s: StatusEstudo): { label: string; icon: string; status: StatusEstudo } {
  if (s === 'a_estudar') return { label: 'Começar a estudar', icon: 'pi-play', status: 'estudando' };
  if (s === 'estudando') return { label: 'Marcar como concluído', icon: 'pi-check', status: 'concluido' };
  return { label: 'Voltar a estudar', icon: 'pi-replay', status: 'estudando' };
}

// ---------- datas ----------
const DIA = 86_400_000;
const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Dias corridos de `de` até `ate` (datas AAAA-MM-DD; negativo se `ate` já passou). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / DIA);
}

/** "2026-11-13" → "13/11/2026". */
export function formatarData(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return d;
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** 45 → "45 min" · 60 → "1 h" · 95 → "1 h 35 min". */
export function formatarMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// ---------- metas ----------
export type EstadoMeta = 'concluida' | 'atrasada' | 'vence_logo' | 'no_prazo';
export const JANELA_VENCE_LOGO = 7;

export interface EstadoMetaInfo { chave: EstadoMeta; label: string; tone?: Tone; icon: string; dias: number; texto: string }

export function estadoMeta(m: Meta, hoje: string): EstadoMetaInfo {
  const dias = diasEntre(hoje, m.prazo);
  if (m.concluida) return { chave: 'concluida', label: 'Concluída', tone: 'muted', icon: 'pi-check-circle', dias, texto: 'Concluída' };
  if (dias < 0) return { chave: 'atrasada', label: 'Atrasada', tone: 'danger', icon: 'pi-exclamation-circle', dias, texto: `${-dias} ${-dias === 1 ? 'dia' : 'dias'} de atraso` };
  const texto = dias === 0 ? 'vence hoje' : `faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  if (dias <= JANELA_VENCE_LOGO) return { chave: 'vence_logo', label: 'Vence logo', tone: 'warning', icon: 'pi-clock', dias, texto };
  return { chave: 'no_prazo', label: 'No prazo', icon: 'pi-calendar', dias, texto };
}

export type FiltroMeta = 'abertas' | 'atrasadas' | 'vence_logo' | 'concluidas';

export function contarMetas(metas: Meta[], hoje: string): Record<FiltroMeta, number> {
  const c = { abertas: 0, atrasadas: 0, vence_logo: 0, concluidas: 0 };
  for (const m of metas) {
    const e = estadoMeta(m, hoje).chave;
    if (e === 'concluida') c.concluidas++;
    else {
      c.abertas++;
      if (e === 'atrasada') c.atrasadas++;
      if (e === 'vence_logo') c.vence_logo++;
    }
  }
  return c;
}

/** Abertas primeiro (prazo mais próximo no topo), concluídas no fim. Filtro opcional. */
export function listarMetas(metas: Meta[], hoje: string, filtro?: FiltroMeta): Meta[] {
  const passa = (m: Meta) => {
    const e = estadoMeta(m, hoje).chave;
    if (!filtro) return true;
    if (filtro === 'abertas') return e !== 'concluida';
    if (filtro === 'atrasadas') return e === 'atrasada';
    if (filtro === 'vence_logo') return e === 'vence_logo';
    return e === 'concluida';
  };
  return metas.filter(passa).sort((a, b) => Number(a.concluida) - Number(b.concluida) || a.prazo.localeCompare(b.prazo));
}

/** Quantos tópicos por semana faltam para fechar a trilha até o prazo (arredondado para cima). */
export function ritmoNecessario(pendentes: number, diasAtePrazo: number): number | undefined {
  if (pendentes <= 0) return 0;
  if (diasAtePrazo <= 0) return undefined;
  return Math.ceil(pendentes / Math.max(1, diasAtePrazo / 7));
}

// ---------- tópicos ----------
export interface RevisaoLike { revisarEm: string }

/** Revisão vencida (hoje ou antes)? */
export function revisaoPendente(r: RevisaoLike | undefined, hoje: string): boolean {
  return !!r && r.revisarEm <= hoje;
}

export function textoRevisao(r: RevisaoLike | undefined, hoje: string): string {
  if (!r) return 'Nenhuma revisão agendada';
  const d = diasEntre(hoje, r.revisarEm);
  if (d < 0) return `Revisão atrasada há ${-d} ${-d === 1 ? 'dia' : 'dias'}`;
  if (d === 0) return 'Revisar hoje';
  return `Próxima revisão em ${formatarData(r.revisarEm)} (${d} ${d === 1 ? 'dia' : 'dias'})`;
}

export type MotivoProximo = 'revisao' | 'continuar' | 'comecar';
export const MOTIVO_PROXIMO: Record<MotivoProximo, string> = {
  revisao: 'Revisão recomendada',
  continuar: 'Continuar estudando',
  comecar: 'Próximo da trilha',
};

/** Próximo tópico: revisão vencida → algo já em andamento → o primeiro a estudar (ordem do catálogo). */
export function proximoTopico<T extends { id: string; status: StatusEstudo }>(
  topicos: readonly T[], revisoes: Record<string, RevisaoLike>, hoje: string,
): { topico: T; motivo: MotivoProximo } | undefined {
  const rev = topicos.find((t) => revisaoPendente(revisoes[t.id], hoje));
  if (rev) return { topico: rev, motivo: 'revisao' };
  const andamento = topicos.find((t) => t.status === 'estudando');
  if (andamento) return { topico: andamento, motivo: 'continuar' };
  const novo = topicos.find((t) => t.status === 'a_estudar');
  return novo ? { topico: novo, motivo: 'comecar' } : undefined;
}

// ---------- trilhas ----------
export type EstadoTrilha = 'nao_iniciada' | 'andamento' | 'concluida';
export const ESTADO_TRILHA_LABEL: Record<EstadoTrilha, string> = { nao_iniciada: 'Não iniciada', andamento: 'Em andamento', concluida: 'Concluída' };

export function estadoTrilha(p: { total: number; concluidos: number; estudando: number }): EstadoTrilha {
  if (p.total > 0 && p.concluidos === p.total) return 'concluida';
  if (p.concluidos > 0 || p.estudando > 0) return 'andamento';
  return 'nao_iniciada';
}

// ---------- sessões ----------
export interface ResumoSessoes { minutos: number; quantidade: number; dias: number; ultima?: string }

export function resumoSessoes(lista: readonly SessaoEstudo[]): ResumoSessoes {
  const datas = lista.map((s) => s.data).sort();
  return {
    minutos: lista.reduce((acc, s) => acc + s.minutos, 0),
    quantidade: lista.length,
    dias: new Set(datas).size,
    ultima: datas[datas.length - 1],
  };
}

/** Sessões dos últimos 7 dias, hoje incluído (datas futuras ficam de fora). */
export function sessoesDaSemana(lista: readonly SessaoEstudo[], hoje: string): SessaoEstudo[] {
  return lista.filter((s) => { const d = diasEntre(s.data, hoje); return d >= 0 && d <= 6; });
}

/** Mais recentes primeiro. */
export function ordenarSessoes(lista: readonly SessaoEstudo[]): SessaoEstudo[] {
  return [...lista].sort((a, b) => b.data.localeCompare(a.data));
}

/** Horas por semana (domingo a sábado) das últimas `n` semanas, a atual por último. */
export function horasPorSemana(lista: readonly SessaoEstudo[], hoje: string, n = 8): { inicio: string; label: string; horas: number }[] {
  const dow = new Date(utc(hoje)).getUTCDay();
  const domingoAtual = utc(hoje) - dow * DIA;
  return Array.from({ length: n }, (_, i) => {
    const inicio = iso(domingoAtual - (n - 1 - i) * 7 * DIA);
    const fim = iso(utc(inicio) + 7 * DIA);
    const mins = lista.filter((s) => s.data >= inicio && s.data < fim).reduce((acc, s) => acc + s.minutos, 0);
    return { inicio, label: `${inicio.slice(8, 10)}/${inicio.slice(5, 7)}`, horas: Math.round(mins / 6) / 10 };
  });
}
