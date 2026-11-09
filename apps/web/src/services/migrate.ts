import { read } from './store';
import { api } from './api';

/**
 * Importa o que está no localStorage para o servidor (uma vez).
 * Lê cada chave do namespace e envia no formato que /api/import espera.
 */
export async function importarDoNavegador(): Promise<{ imported: Record<string, number> }> {
  const statusMap = read<Record<string, { status?: string; anotacoes?: string } | string>>('status', {});
  const anotacoes = read<Record<string, string>>('anotacoes', {});

  // progresso: combina os mapas status + anotacoes por tópico
  const topicoIds = new Set([...Object.keys(statusMap), ...Object.keys(anotacoes)]);
  const progresso = [...topicoIds].map((topicoId) => {
    const s = statusMap[topicoId];
    const status = typeof s === 'string' ? s : s?.status ?? 'a_estudar';
    return { topicoId, status, anotacoes: anotacoes[topicoId] ?? '' };
  });

  const payload = {
    progresso,
    sessoes: read('sessoes', []),
    metas: read('metas', []),
    posts: read('posts', []),
    arsenal: read('arsenal', []),
    biblioteca: read('biblioteca', []),
    cofre: read('vault:blob', null),
  };

  return api.importData(payload) as Promise<{ imported: Record<string, number> }>;
}
