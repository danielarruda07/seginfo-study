import {
  diaLocal, type CanalPublicacao, type IdeiaLinkedin, type Metricas, type OrigemIdeia, type PostPublicado,
  type ProjetoLinkedin, type RascunhoLinkedin, type StatusIdeia, type StatusProjeto, type StatusRascunho,
} from '@seginfo/shared';
import type { Tone } from '@/theme/status';

/** Regras puras do pipeline do LinkedIn (sem rede nem localStorage), testadas em pipelineRegras.test.ts. */

// ===================== rótulos =====================

export const STATUS_META: Record<StatusRascunho, { label: string; icon: string; tone?: Tone }> = {
  rascunho: { label: 'Rascunho', icon: 'pi-file-edit', tone: 'muted' },
  aprovado: { label: 'Aprovado', icon: 'pi-check', tone: 'info' },
  agendado: { label: 'Agendado', icon: 'pi-calendar-clock', tone: 'info' },
  publicando: { label: 'Publicando…', icon: 'pi-spinner', tone: 'warning' },
  publicado: { label: 'Publicado', icon: 'pi-check-circle', tone: 'ok' },
  falhou: { label: 'Falhou', icon: 'pi-times-circle', tone: 'danger' },
};

export const CANAL_LABEL: Record<CanalPublicacao, string> = { lembrete: 'Lembrete (publico à mão)', api: 'Publicar pela API' };
export const CANAL_CURTO: Record<CanalPublicacao, string> = { lembrete: 'lembrete', api: 'pela API' };

export const ORIGEM_IDEIA_LABEL: Record<OrigemIdeia, string> = {
  manual: 'Anotada por você', analise: 'Análise de um post', lab: 'Lab concluído',
  marco: 'Marco do diário', radar: 'Radar de ataques', planejador: 'Planejador da semana',
};
export const STATUS_IDEIA_LABEL: Record<StatusIdeia, string> = { nova: 'Novas', em_rascunho: 'Em rascunho', descartada: 'Descartadas' };

export const STATUS_PROJETO_META: Record<StatusProjeto, { label: string; tone?: Tone }> = {
  ativo: { label: 'Ativo', tone: 'ok' }, pausado: { label: 'Pausado', tone: 'muted' }, concluido: { label: 'Concluído', tone: 'info' },
};

export const nomeDoProjeto = (projetos: ProjetoLinkedin[], id: string | null | undefined): string | null =>
  (id ? projetos.find((p) => p.id === id)?.nome ?? null : null);

/** Fuso do navegador: é nele que a pessoa digita e lê os horários. */
export const fusoDoNavegador = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

// ===================== datas =====================

const p2 = (n: number) => String(n).padStart(2, '0');

/** Instante ISO → valor de <input type="datetime-local"> (horário local do navegador). */
export function paraDatetimeLocal(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> → instante ISO em UTC, ou null se inválido. */
export function deDatetimeLocal(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valor)) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Amanhã às 9h (horário local), como sugestão de agendamento. */
export function sugestaoDeHorario(agora: Date): string {
  const d = new Date(agora);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return paraDatetimeLocal(d);
}

/** "20/11 09:00" no fuso informado. */
export function dataHoraCurta(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(iso)).replace(',', '');
}

export const horaCurta = (iso: string, fuso: string): string =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** YYYY-MM-DD + n dias (aritmética em UTC, sem depender do fuso). */
export function somarDias(data: string, n: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const diasEntre = (de: string, ate: string): number =>
  Math.round((Date.parse(`${ate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${de.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

// ===================== quadro =====================

export type ColunaId = 'rascunho' | 'aprovado' | 'agendado' | 'publicado';
export interface ColunaQuadro { id: ColunaId; titulo: string; dica: string; itens: RascunhoLinkedin[]; total: number }

const recentes = (a: RascunhoLinkedin, b: RascunhoLinkedin) => b.atualizadoEm.localeCompare(a.atualizadoEm);

/** Quatro colunas: `publicando` e `falhou` ficam em Agendado; Publicado mostra só os mais recentes. */
export function colunasDoQuadro(rascunhos: RascunhoLinkedin[], maxPublicados = 10): ColunaQuadro[] {
  const de = (...s: StatusRascunho[]) => rascunhos.filter((r) => s.includes(r.status));
  const agendados = de('agendado', 'publicando', 'falhou').sort((a, b) =>
    Number(b.status === 'falhou') - Number(a.status === 'falhou') || (a.agendadoPara ?? '').localeCompare(b.agendadoPara ?? ''));
  const publicados = de('publicado').sort((a, b) => (b.publicadoEm ?? b.atualizadoEm).localeCompare(a.publicadoEm ?? a.atualizadoEm));
  const rasc = de('rascunho').sort(recentes);
  const aprov = de('aprovado').sort(recentes);
  return [
    { id: 'rascunho', titulo: 'Rascunho', dica: 'Em escrita. Aprove quando o texto estiver pronto.', itens: rasc, total: rasc.length },
    { id: 'aprovado', titulo: 'Aprovado', dica: 'Passou na verificação. Falta agendar ou publicar.', itens: aprov, total: aprov.length },
    { id: 'agendado', titulo: 'Agendado', dica: 'Com data marcada.', itens: agendados, total: agendados.length },
    { id: 'publicado', titulo: 'Publicado', dica: 'Os mais recentes.', itens: publicados.slice(0, maxPublicados), total: publicados.length },
  ];
}

/** Agendados no canal "lembrete" cuja hora já chegou: é hora de publicar à mão. */
export function vencidos(rascunhos: RascunhoLinkedin[], agora: Date): RascunhoLinkedin[] {
  return rascunhos
    .filter((r) => r.status === 'agendado' && r.canal === 'lembrete' && !!r.agendadoPara && Date.parse(r.agendadoPara) <= agora.getTime())
    .sort((a, b) => (a.agendadoPara ?? '').localeCompare(b.agendadoPara ?? ''));
}

export const falhados = (rascunhos: RascunhoLinkedin[]): RascunhoLinkedin[] => rascunhos.filter((r) => r.status === 'falhou');

/** Instantes já ocupados (outros agendados e publicados), para as regras de ritmo do agendamento. */
export function instantesOcupados(rascunhos: RascunhoLinkedin[], publicados: PostPublicado[], excetoId?: string): string[] {
  const dosRascunhos = rascunhos
    .filter((r) => r.id !== excetoId && (r.status === 'agendado' || r.status === 'publicando') && r.agendadoPara)
    .map((r) => r.agendadoPara as string);
  // post publicado só tem a data: meio-dia UTC cai no mesmo dia em qualquer fuso do Brasil
  return [...dosRascunhos, ...publicados.map((p) => `${p.publicadoEm}T12:00:00.000Z`)];
}

// ===================== calendário =====================

export type TipoItemCalendario = 'agendado' | 'falhou' | 'publicado' | 'ideia';
export interface ItemCalendario {
  tipo: TipoItemCalendario;
  chave: string;
  titulo: string;
  hora?: string;
  projetoId: string | null;
  rascunhoId?: string;
  postId?: string;
  ideiaId?: string;
}
export interface DiaCalendario { data: string; dia: number; doMes: boolean; hoje: boolean }

/** Semanas completas (domingo a sábado) que cobrem o mês. `mes` de 0 a 11. */
export function gradeDoMes(ano: number, mes: number, hoje: string): DiaCalendario[] {
  const primeiro = new Date(Date.UTC(ano, mes, 1));
  const inicio = somarDias(primeiro.toISOString().slice(0, 10), -primeiro.getUTCDay());
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0));
  const fim = somarDias(ultimo.toISOString().slice(0, 10), 6 - ultimo.getUTCDay());
  const dias: DiaCalendario[] = [];
  for (let data = inicio; data <= fim; data = somarDias(data, 1)) {
    dias.push({ data, dia: Number(data.slice(8)), doMes: Number(data.slice(5, 7)) === mes + 1, hoje: data === hoje });
  }
  return dias;
}

const primeiraLinhaDe = (texto: string) => texto.split('\n').find((l) => l.trim())?.trim() ?? '';

/** Tudo o que tem data: agendados, publicados (registro oficial ou rascunho fechado) e ideias sugeridas. */
export function itensDoCalendario(
  rascunhos: RascunhoLinkedin[], publicados: PostPublicado[], ideias: IdeiaLinkedin[], fuso: string,
): Map<string, ItemCalendario[]> {
  const mapa = new Map<string, ItemCalendario[]>();
  const por = (data: string, item: ItemCalendario) => { mapa.set(data, [...(mapa.get(data) ?? []), item]); };
  for (const r of rascunhos) {
    if ((r.status === 'agendado' || r.status === 'publicando' || r.status === 'falhou') && r.agendadoPara) {
      por(diaLocal(r.agendadoPara, fuso), {
        tipo: r.status === 'falhou' ? 'falhou' : 'agendado', chave: `r-${r.id}`, titulo: r.titulo,
        hora: horaCurta(r.agendadoPara, fuso), projetoId: r.projetoId, rascunhoId: r.id,
      });
    } else if (r.status === 'publicado' && !r.linkedinPostId) {
      por(diaLocal(r.publicadoEm ?? r.atualizadoEm, fuso), { tipo: 'publicado', chave: `r-${r.id}`, titulo: r.titulo, projetoId: r.projetoId, rascunhoId: r.id });
    }
  }
  for (const p of publicados) {
    por(p.publicadoEm, { tipo: 'publicado', chave: `p-${p.id}`, titulo: p.analise?.resumo ?? primeiraLinhaDe(p.texto), projetoId: p.projetoId ?? null, postId: p.id });
  }
  for (const i of ideias) {
    if (i.status === 'nova' && i.sugeridaPara) por(i.sugeridaPara, { tipo: 'ideia', chave: `i-${i.id}`, titulo: i.titulo, projetoId: i.projetoId, ideiaId: i.id });
  }
  for (const itens of mapa.values()) itens.sort((a, b) => (a.hora ?? '').localeCompare(b.hora ?? ''));
  return mapa;
}

// ===================== projetos =====================

export interface ResumoProjeto {
  ideiasNovas: number;
  /** rascunho + aprovado */
  emAndamento: number;
  agendados: number;
  publicados: number;
  /** YYYY-MM-DD do post mais recente, ou null */
  ultimoPost: string | null;
  diasSemPost: number | null;
  /** ativo e sem post há 14 dias ou mais (ou nunca postou e já tem 14 dias) */
  parado: boolean;
}

export function resumoDoProjeto(
  projeto: ProjetoLinkedin,
  dados: { ideias: IdeiaLinkedin[]; rascunhos: RascunhoLinkedin[]; publicados: PostPublicado[] },
  hoje: string, fuso: string,
): ResumoProjeto {
  const rascunhos = dados.rascunhos.filter((r) => r.projetoId === projeto.id);
  const registrados = dados.publicados.filter((p) => p.projetoId === projeto.id);
  const semRegistro = rascunhos.filter((r) => r.status === 'publicado' && !r.linkedinPostId);
  const datas = [...registrados.map((p) => p.publicadoEm), ...semRegistro.map((r) => diaLocal(r.publicadoEm ?? r.atualizadoEm, fuso))].sort();
  const ultimoPost = datas.at(-1) ?? null;
  const diasSemPost = ultimoPost ? Math.max(0, diasEntre(ultimoPost, hoje)) : null;
  const idade = Math.max(0, diasEntre(projeto.criadoEm.slice(0, 10), hoje));
  return {
    ideiasNovas: dados.ideias.filter((i) => i.projetoId === projeto.id && i.status === 'nova').length,
    emAndamento: rascunhos.filter((r) => r.status === 'rascunho' || r.status === 'aprovado').length,
    agendados: rascunhos.filter((r) => r.status === 'agendado' || r.status === 'publicando' || r.status === 'falhou').length,
    publicados: registrados.length + semRegistro.length,
    ultimoPost,
    diasSemPost,
    parado: projeto.status === 'ativo' && (diasSemPost ?? idade) >= 14,
  };
}

// ===================== ideias =====================

export function filtrarIdeias(
  ideias: IdeiaLinkedin[], f: { status: StatusIdeia; projetoId?: string | null; busca?: string },
): IdeiaLinkedin[] {
  const termo = (f.busca ?? '').trim().toLowerCase();
  return ideias.filter((i) =>
    i.status === f.status
    && (!f.projetoId || i.projetoId === f.projetoId)
    && (!termo || `${i.titulo}\n${i.briefing}\n${i.pilar ?? ''}`.toLowerCase().includes(termo)));
}

// ===================== desempenho =====================

function taxa(m: Metricas): number | null {
  if (!m.impressoes) return null;
  const interacoes = (m.reacoes ?? 0) + (m.comentarios ?? 0) + (m.compartilhamentos ?? 0) + (m.salvamentos ?? 0);
  return (interacoes / m.impressoes) * 100;
}

export interface DesempenhoGrupo { grupo: string; posts: number; taxaMedia: number }

/**
 * Taxa média de engajamento por grupo (formato, projeto...). Só entram posts com impressões,
 * e só aparecem grupos com `minimo` posts: um post sozinho não é tendência.
 */
export function desempenhoPor(posts: PostPublicado[], chave: (p: PostPublicado) => string | null | undefined, minimo = 2): DesempenhoGrupo[] {
  const grupos = new Map<string, number[]>();
  for (const p of posts) {
    const g = chave(p);
    const t = taxa(p.metricas);
    if (!g || t === null) continue;
    grupos.set(g, [...(grupos.get(g) ?? []), t]);
  }
  return [...grupos]
    .filter(([, taxas]) => taxas.length >= minimo)
    .map(([grupo, taxas]) => ({ grupo, posts: taxas.length, taxaMedia: Math.round((taxas.reduce((a, b) => a + b, 0) / taxas.length) * 10) / 10 }))
    .sort((a, b) => b.taxaMedia - a.taxaMedia);
}
