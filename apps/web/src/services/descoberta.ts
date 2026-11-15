import type { Ativo } from '@seginfo/shared';
import { http } from './http';

/** Resultado de GET /api/ambiente/descoberta: o que o servidor encontrou no laboratório (só leitura). */
export interface FonteDescoberta {
  fonte: 'proxmox' | 'fortigate' | 'switch';
  estado: 'ok' | 'parcial' | 'erro' | 'nao_configurado';
  itens: number;
  detalhe?: string;
}
export interface Descoberta {
  geradoEm: string;
  duracaoMs: number;
  fontes: FonteDescoberta[];
  ativos: Ativo[];
}

/** A varredura consulta Proxmox, FortiGate e switch: pode levar dezenas de segundos. */
export const getDescoberta = () => http.get<Descoberta>('/ambiente/descoberta', { timeout: 180_000 }).then((r) => r.data);
