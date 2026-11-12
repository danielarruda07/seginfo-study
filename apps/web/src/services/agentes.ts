import type { AgenteConfig, AgenteStatus, AvaliacaoIn, AvaliacaoResultado } from '@seginfo/shared';
import { http } from './http';

export interface AgenteResumo {
  id: string;
  nome: string;
  resumo: string;
  status: AgenteStatus;
  atualizadoEm: string;
  ferramentas: number;
  ferramentasEscrita: number;
  baseTags: string[];
  avaliacoes: { total: number; ok: number; parcial: number; falha: number };
  /** null quando o JSON salvo não bate mais com o formato atual */
  revisao: { erros: number; avisos: number } | null;
}

export interface Agente {
  id: string;
  nome: string;
  resumo: string;
  status: AgenteStatus;
  config: AgenteConfig;
  criadoEm: string;
  atualizadoEm: string;
}

export interface AgenteCorpo {
  nome: string;
  resumo: string;
  status: AgenteStatus;
  config: AgenteConfig;
}

export interface Avaliacao {
  id: string;
  agenteId: string;
  caso: string;
  criterio: string;
  resultado: AvaliacaoResultado;
  latenciaMs: number | null;
  observacao: string;
  criadoEm: string;
}

export interface TrechoBase {
  memoriaId: string;
  titulo: string;
  tags: string[];
  trecho: string;
  score: number;
}

export const listAgentes = () => http.get<AgenteResumo[]>('/agentes').then((r) => r.data);
export const getAgente = (id: string) => http.get<Agente>(`/agentes/${id}`).then((r) => r.data);
export const createAgente = (b: AgenteCorpo) => http.post<Agente>('/agentes', b).then((r) => r.data);
export const updateAgente = (id: string, b: AgenteCorpo) => http.put(`/agentes/${id}`, b).then((r) => r.data);
export const deleteAgente = (id: string) => http.delete(`/agentes/${id}`).then((r) => r.data);

export const listAvaliacoes = (agenteId: string) =>
  http.get<Avaliacao[]>(`/agentes/${agenteId}/avaliacoes`).then((r) => r.data);
export const addAvaliacao = (agenteId: string, b: AvaliacaoIn) =>
  http.post<Avaliacao>(`/agentes/${agenteId}/avaliacoes`, b).then((r) => r.data);
export const deleteAvaliacao = (agenteId: string, id: string) =>
  http.delete(`/agentes/${agenteId}/avaliacoes/${id}`).then((r) => r.data);

export const listTagsBase = () =>
  http.get<{ tags: { tag: string; total: number }[] }>('/agentes/base/tags').then((r) => r.data.tags);
export const buscarNaBaseDoAgente = (agenteId: string, q: string) =>
  http.post<{ tags: string[]; resultados: TrechoBase[] }>('/agentes/base/buscar', { agenteId, q }).then((r) => r.data);

export const erroApi = (e: unknown, padrao: string) =>
  (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
export const problemasApi = (e: unknown): string[] =>
  (e as { response?: { data?: { problemas?: string[] } } }).response?.data?.problemas ?? [];
