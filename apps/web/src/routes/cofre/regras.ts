import type { VaultEntry } from '@seginfo/shared';
import { idadeConfirmacao } from '@/lib/confirmacao';

/** Regras puras do Cofre (nada aqui toca em segredo decifrado). Testes em regras.test.ts. */

/** O que a tela mostra no lugar de um segredo. Tamanho fixo: não revela o comprimento real. */
export const MASCARA = '••••••••••••';

/** Força da senha-mestra, de 0 a 6 (comprimento + variedade). */
export function senhaMestraScore(senha: string): number {
  if (!senha) return 0;
  return [senha.length >= 12, senha.length >= 16, /[a-z]/.test(senha), /[A-Z]/.test(senha), /\d/.test(senha), /[^a-zA-Z0-9]/.test(senha)]
    .filter(Boolean).length;
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Filtra por título, usuário, URL ou notas (nunca pelo segredo) e ordena por título. */
export function filtrarCredenciais(entries: VaultEntry[], busca: string): VaultEntry[] {
  const q = norm(busca.trim());
  const lista = q ? entries.filter((e) => [e.titulo, e.usuario, e.url, e.notas].some((v) => norm(v ?? '').includes(q))) : [...entries];
  return lista.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
}

export interface EstadoTeste {
  texto: string;
  tone: 'ok' | 'warning' | 'muted';
  rotulo: string;
}

/** Quando a credencial foi testada por último e se vale testar de novo. */
export function estadoTeste(confirmadoEm: string | undefined, hoje = new Date()): EstadoTeste {
  if (!confirmadoEm) return { texto: 'Nunca testada', tone: 'muted', rotulo: 'Não testada' };
  const i = idadeConfirmacao(confirmadoEm, hoje);
  return i.rever
    ? { texto: `${i.texto} · vale testar de novo`, tone: 'warning', rotulo: 'Testar de novo' }
    : { texto: i.texto, tone: 'ok', rotulo: 'Testada' };
}

/** Link clicável só para http(s); qualquer outro esquema (javascript:, data:) fica como texto. */
export function hrefSeguro(url: string): string | null {
  const u = url.trim();
  if (!u) return null;
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
  try {
    const p = new URL(comEsquema);
    return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : null;
  } catch {
    return null;
  }
}
