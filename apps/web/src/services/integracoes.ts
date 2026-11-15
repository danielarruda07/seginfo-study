import { http } from './http';

/** Como o servidor se conecta a cada sistema do laboratório (GET /api/integracoes). Nunca traz segredo. */
export interface Integracao {
  id: 'proxmox' | 'fortigate' | 'catalyst' | 'wazuh' | 'wazuh-indexador' | 'zabbix' | 'coolify' | 'spiderfoot' | 'mcp' | 'claude';
  nome: string;
  uso: string;
  configurada: boolean;
  endereco: string | null;
  identidade: string | null;
  tls: string | null;
  faltando: string[];
  variaveis: string[];
}

/** Resultado de uma consulta mínima, só leitura, feita pelo servidor no sistema. */
export interface TesteConexao {
  ok: boolean;
  detalhe: string;
  ms: number;
}

export const listIntegracoes = () =>
  http.get<{ integracoes: Integracao[] }>('/integracoes').then((r) => r.data.integracoes);

export const testarIntegracao = (id: Integracao['id']) =>
  http.post<TesteConexao>(`/integracoes/${id}/testar`).then((r) => r.data);
