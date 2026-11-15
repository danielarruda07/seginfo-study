import type { AtaqueFonte } from '@seginfo/shared';
import type { AmbienteFiltro } from '@seginfo/shared';
import { http } from './http';
import { getAmbiente } from './ambiente';

/** internet = IP público; interno = rede privada/reservada (exercícios do range) ou sem IP. */
export type RadarEscopo = 'internet' | 'interno' | 'todos';

export interface RadarResumo {
  dias: number;
  escopo?: RadarEscopo;
  total: number;
  truncado: boolean;
  ipsUnicos: number;
  falhasLogin: number;
  lockouts: number;
  granularidade: 'hora' | 'dia';
  topIps: { ip: string; pais: string | null; total: number }[];
  topServicos: { nome: string; total: number }[];
  topUsuarios: { nome: string; total: number }[];
  /** true só se o servidor tiver RADAR_GUARDAR_SENHAS=true. */
  senhasHabilitadas: boolean;
  topSenhas: { nome: string; total: number }[];
  topPaises: { nome: string; total: number }[];
  porAcao: { nome: string; total: number }[];
  mitre: { id: string; nome: string; eventos: number }[];
  timeline: { bucket: string; total: number }[];
}

export interface RadarEvento {
  id: string;
  fonte: string;
  ocorridoEm: string;
  /** nulo em lockout (o evento 4740 do Windows não traz IP). */
  ipOrigem: string | null;
  paisOrigem: string | null;
  portaDestino: number | null;
  servico: string | null;
  protocolo?: string | null;
  acao: string;
  usuarioTentado: string | null;
  alvo: string | null;
  escopo?: 'internet' | 'interno';
  ambiente?: string;
  /** Livre por coletor; nunca traz senha. Ex.: { mitre, regra, nivel, comando, url }. */
  detalhes?: Record<string, unknown>;
}

export interface RadarEventosFiltro {
  ambiente?: AmbienteFiltro;
  ip?: string;
  servico?: string;
  acao?: string;
  fonte?: AtaqueFonte;
  pais?: string;
  escopo?: RadarEscopo;
  q?: string;
  page: number;
  limit: number;
}

export const getRadarResumo = (dias: number, escopo: RadarEscopo = 'todos', ambiente: AmbienteFiltro = 'todos') =>
  http.get<RadarResumo>('/radar/resumo', { params: { dias, escopo, ambiente, tz: new Date().getTimezoneOffset() } }).then((r) => r.data);

export const getRadarEventos = (f: RadarEventosFiltro) =>
  http.get<{ total: number; items: RadarEvento[] }>('/radar/eventos', { params: f }).then((r) => r.data);

/** Todos os eventos de uma sessão do honeypot (mesmo detalhes.sessao), em ordem cronológica. */
export const getRadarSessao = (id: string, ip: string) =>
  http.get<{ sessao: string; truncado: boolean; items: RadarEvento[] }>('/radar/sessao', { params: { id, ip, ambiente: getAmbiente() } }).then((r) => r.data);
