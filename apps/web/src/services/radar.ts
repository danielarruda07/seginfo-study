import type { AtaqueFonte } from '@seginfo/shared';
import { http } from './http';

export interface RadarResumo {
  dias: number;
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
  /** Livre por coletor; nunca traz senha. Ex.: { mitre, regra, nivel, comando, url }. */
  detalhes?: Record<string, unknown>;
}

export interface RadarEventosFiltro {
  ip?: string;
  servico?: string;
  acao?: string;
  fonte?: AtaqueFonte;
  pais?: string;
  q?: string;
  page: number;
  limit: number;
}

export const getRadarResumo = (dias: number) =>
  http.get<RadarResumo>('/radar/resumo', { params: { dias, tz: new Date().getTimezoneOffset() } }).then((r) => r.data);

export const getRadarEventos = (f: RadarEventosFiltro) =>
  http.get<{ total: number; items: RadarEvento[] }>('/radar/eventos', { params: f }).then((r) => r.data);
