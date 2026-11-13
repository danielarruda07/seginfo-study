import type { AgenteConfig, AgenteStatus, AvaliacaoIn, AvaliacaoResultado, ExecucaoStatus, PassoExecucao } from '@seginfo/shared';
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

// ---------- execução (playground) ----------

export interface RuntimeInfo {
  configurada: boolean;
  modelo: string;
  limites: { voltas: number; tokensSaida: number; mensagensPorConversa: number };
  /** ferramentas do catálogo que o servidor já sabe executar */
  ferramentas: { id: string; nome: string; permissao: 'leitura' | 'escrita'; descricao: string }[];
}

export interface ExecucaoResumo {
  id: string;
  status: ExecucaoStatus;
  entrada: string;
  resposta: string;
  erro: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  duracaoMs: number;
  criadoEm: string;
}

export interface Execucao extends ExecucaoResumo {
  passos: PassoExecucao[];
}

export const getRuntime = () => http.get<RuntimeInfo>('/agentes/runtime').then((r) => r.data);
export const executarAgente = (agenteId: string, mensagem: string, continuarDe?: string) =>
  http.post<{ id: string }>(`/agentes/${agenteId}/executar`, { mensagem, continuarDe }).then((r) => r.data);
export const listExecucoes = (agenteId: string) =>
  http.get<ExecucaoResumo[]>(`/agentes/${agenteId}/execucoes`).then((r) => r.data);
export const getExecucao = (agenteId: string, execId: string) =>
  http.get<Execucao>(`/agentes/${agenteId}/execucoes/${execId}`).then((r) => r.data);

export const erroApi = (e: unknown, padrao: string) =>
  (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
export const problemasApi = (e: unknown): string[] =>
  (e as { response?: { data?: { problemas?: string[] } } }).response?.data?.problemas ?? [];
