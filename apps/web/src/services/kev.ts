import { z } from 'zod';
import { http } from './http';
import { read, write, registerSchema } from './store';

export interface KevItem {
  cve: string;
  fabricante: string;
  produto: string;
  nome: string;
  adicionadoEm: string;
  prazo: string | null;
  descricao: string;
  acao: string;
  ransomware: boolean;
  /** termo acompanhado que casou com fabricante/produto */
  termo: string;
}

export interface KevResposta {
  versao: string;
  publicadoEm: string;
  totalCatalogo: number;
  desatualizado: boolean;
  itens: KevItem[];
}

const TERMOS_KEY = 'kev:termos';
registerSchema(TERMOS_KEY, { safeParse: (v) => z.array(z.string().max(60)).max(25).safeParse(v) });

/** Produtos típicos do homelab. Edite na tela para refletir o seu inventário real. */
export const TERMOS_PADRAO = ['Fortinet', 'Proxmox', 'Cisco IOS', 'Wazuh', 'Docker', 'Nginx', 'PostgreSQL', 'Cloudflare'];

export function getTermos(): string[] {
  return read<string[]>(TERMOS_KEY, TERMOS_PADRAO);
}

export function setTermos(termos: string[]): void {
  write(TERMOS_KEY, [...new Set(termos.map((t) => t.trim()).filter((t) => t.length >= 2))].slice(0, 25));
}

export const getKev = (termos: string[], dias: number) =>
  http.get<KevResposta>('/kev', { params: { termos: termos.join(','), dias }, timeout: 30_000 }).then((r) => r.data);
