import { http } from './http';

/** Como o servidor se conecta a cada sistema do laboratório (GET /api/integracoes). Nunca traz segredo. */
export interface Integracao {
  id: 'proxmox' | 'fortigate' | 'catalyst' | 'claude';
  nome: string;
  uso: string;
  configurada: boolean;
  endereco: string | null;
  identidade: string | null;
  tls: string | null;
  faltando: string[];
  variaveis: string[];
}

export const listIntegracoes = () =>
  http.get<{ integracoes: Integracao[] }>('/integracoes').then((r) => r.data.integracoes);
