import type { PericiaIn } from '@seginfo/shared';
import { http } from './http';

export interface PericiaResumo {
  arquivos: number;
  executaveis: number;
  persistencia: number;
  processos: number;
  conexoes: number;
  saidasBloqueadas: number;
  destinos: number;
  amostras: number;
  erros: number;
}

export interface PericiaItem {
  id: string;
  alvo: string;
  vmid: number;
  sistema: 'linux' | 'windows';
  sensor: string | null;
  janelaInicio: string;
  janelaFim: string;
  resumo: PericiaResumo;
  criadoEm: string;
}

export interface Invasor {
  ip: string;
  pais: string | null;
  logins: number;
  falhas: number;
  reconhecimentos: number;
  comandos: number;
  arquivos: number;
  tuneis: number;
  bloqueios: number;
  reflexoes: number;
  primeira: string;
  ultima: string;
}

export interface PericiaEvento {
  id: string;
  quando: string;
  fonte: string;
  acao: string;
  ip: string | null;
  pais: string | null;
  servico: string | null;
  porta: number | null;
  comando: string | null;
  mitre: unknown[];
}

export type PericiaDetalhe = PericiaItem & { dados: PericiaIn; invasores: Invasor[]; linhaTempo: PericiaEvento[]; linhaTempoTruncada: boolean };

export const listarPericias = () => http.get<PericiaItem[]>('/pericia').then((r) => r.data);
export const getPericia = (id: string) => http.get<PericiaDetalhe>(`/pericia/${encodeURIComponent(id)}`).then((r) => r.data);
export const getPericiaTecnicas = () => http.get<{ id: string; laudos: number }[]>('/pericia/tecnicas').then((r) => r.data);
