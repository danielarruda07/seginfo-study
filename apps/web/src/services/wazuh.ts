import { http } from './http';

export interface WazuhAgent {
  id: string | null; name: string | null; ip: string | null; status: string;
  version: string | null; lastKeepAlive: string | null; os: string | null;
}
export interface WazuhStatus {
  configurado: boolean; faltando: string[]; erro: string | null; consultadoEm: string | null;
  manager: { versao: string | null; hostname: string | null; timestamp: string | null; daemons: { nome: string | null; estado: string | null }[] } | null;
  agentes: { total: number; contagens: Record<string, number>; items: WazuhAgent[] } | null;
}
export interface WazuhAlert {
  id: string; fonte: string; ocorridoEm: string; ipOrigem: string | null; paisOrigem: string | null;
  servico: string | null; acao: string; alvo: string | null; detalhes: Record<string, unknown>;
}

export const getWazuhStatus = () => http.get<WazuhStatus>('/wazuh/status').then((r) => r.data);
export const getWazuhAlerts = (params: { dias: number; q?: string; page: number; limit: number }) =>
  http.get<{ total: number; page: number; limit: number; dias: number; items: WazuhAlert[] }>('/wazuh/alertas', { params }).then((r) => r.data);
