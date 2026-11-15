import type { Mudanca } from './exposicaoFontes/tipos.js';

/**
 * Para onde vão as mudanças da "Minha exposição" além da tela: hoje só o stdout (uma linha JSON por
 * mudança). A preencher: syslog para o Wazuh e Telegram para as graves.
 */
export async function notificarMudancas(e: { alvo: string; tipoAlvo: string; quando: string; mudancas: Mudanca[] }): Promise<void> {
  for (const m of e.mudancas) {
    process.stdout.write(`${JSON.stringify({ evento: 'seginfo.exposicao.mudanca', quando: e.quando, alvo: e.alvo, tipoAlvo: e.tipoAlvo, ...m })}\n`);
  }
}
