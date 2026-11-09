import { api } from './api';

/**
 * Modo de persistência:
 * - 'servidor': apps/api + PostgreSQL disponível (produção, ou dev com a API no ar)
 * - 'local': fallback para localStorage (API offline)
 *
 * Detecta uma vez por sessão via /health.
 */
let cached: 'servidor' | 'local' | null = null;

export async function detectMode(): Promise<'servidor' | 'local'> {
  if (cached) return cached;
  try {
    await api.health();
    cached = 'servidor';
  } catch {
    cached = 'local';
  }
  return cached;
}

export function getModeSync(): 'servidor' | 'local' | null {
  return cached;
}
