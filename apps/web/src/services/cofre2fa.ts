import axios from 'axios';
import type { VaultBlob } from '@seginfo/shared';
import { http } from './http';

/**
 * Cliente do segundo fator do Cofre. A sessão aberta por um código válido vale 15 min
 * (renovada a cada uso) e fica SÓ na memória da aba: recarregar a página pede o código de novo.
 */

export interface Status2fa {
  ativo: boolean;
  pendente: boolean;
  ativadoEm: string | null;
  codigosRestantes: number;
  bloqueadoAte: string | null;
  sessaoAte: string | null;
  temCofre: boolean;
}

export interface EventoCofre {
  id: string;
  tipo: string;
  detalhe: string;
  ip: string | null;
  agente: string | null;
  criadoEm: string;
}

export type BlobServidor = VaultBlob & { atualizadoEm: string };

let sessao: { token: string; expiraEm: number } | null = null;

export function temSessao(): boolean {
  return !!sessao && sessao.expiraEm > Date.now();
}
export function sessaoExpiraEm(): number | null {
  return temSessao() ? sessao!.expiraEm : null;
}
function guardarSessao(s: { token: string; expiraEm: string }) {
  sessao = { token: s.token, expiraEm: Date.parse(s.expiraEm) };
}
export function esquecerSessao(): void {
  sessao = null;
}
function cab() {
  return sessao ? { headers: { 'X-Cofre-Sessao': sessao.token } } : {};
}
/** Cada chamada com sessão válida empurra a expiração 15 min (o servidor faz o mesmo). */
function renovar() {
  if (sessao) sessao.expiraEm = Date.now() + 15 * 60_000;
}

/** Mensagem do servidor, ou uma genérica. */
export function mensagemErro(e: unknown, padrao = 'Falha ao falar com o servidor.'): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data as { error?: string } | undefined;
    if (d?.error) return d.error;
    if (!e.response) return 'Servidor fora do ar ou sem conexão.';
  }
  return e instanceof Error && e.message ? e.message : padrao;
}

/** Código de erro do servidor (2FA_NECESSARIO, 2FA_INATIVO, CONFLITO), se houver. */
export function codigoErro(e: unknown): string | undefined {
  if (!axios.isAxiosError(e)) return undefined;
  if (e.response?.status === 401 && (e.response.data as { codigo?: string })?.codigo === '2FA_NECESSARIO') esquecerSessao();
  return (e.response?.data as { codigo?: string } | undefined)?.codigo;
}

export const cofre2fa = {
  status: async (): Promise<Status2fa> => {
    const s = (await http.get('/cofre/2fa', cab())).data as Status2fa;
    if (s.sessaoAte && sessao) sessao.expiraEm = Date.parse(s.sessaoAte);
    if (!s.sessaoAte) esquecerSessao();
    return s;
  },
  iniciar: async (): Promise<{ segredo: string; otpauth: string }> => (await http.post('/cofre/2fa/iniciar', {})).data,
  /** Confirma o primeiro código e, na mesma chamada, guarda o Cofre cifrado no servidor. */
  ativar: async (codigo: string, cofre: VaultBlob): Promise<{ codigos: string[]; atualizadoEm: string }> => {
    const r = (await http.post('/cofre/2fa/ativar', { codigo, cofre })).data as { codigosRecuperacao: string[]; sessao: { token: string; expiraEm: string }; atualizadoEm: string };
    guardarSessao(r.sessao);
    return { codigos: r.codigosRecuperacao, atualizadoEm: r.atualizadoEm };
  },
  verificar: async (fator: { codigo?: string; recuperacao?: string }): Promise<{ codigosRestantes: number }> => {
    const r = (await http.post('/cofre/2fa/verificar', fator)).data as { sessao: { token: string; expiraEm: string }; codigosRestantes: number };
    guardarSessao(r.sessao);
    return { codigosRestantes: r.codigosRestantes };
  },
  sair: async (): Promise<void> => {
    try { await http.post('/cofre/2fa/sair', {}, cab()); } finally { esquecerSessao(); }
  },
  novosCodigos: async (fator: { codigo?: string; recuperacao?: string }): Promise<string[]> => {
    const r = (await http.post('/cofre/2fa/codigos', fator, cab())).data as { codigosRecuperacao: string[] };
    renovar();
    return r.codigosRecuperacao;
  },
  desativar: async (fator: { codigo?: string; recuperacao?: string }): Promise<void> => {
    await http.post('/cofre/2fa/desativar', fator, cab());
    esquecerSessao();
  },
  eventos: async (): Promise<EventoCofre[]> => (await http.get('/cofre/eventos', cab())).data,
  lerBlob: async (): Promise<BlobServidor | null> => {
    const r = (await http.get('/cofre', cab())).data as BlobServidor | null;
    renovar();
    return r;
  },
  /** `base`: data da versão carregada (null = não havia), ou undefined para sobrescrever. */
  gravarBlob: async (blob: VaultBlob, base: string | null | undefined): Promise<string> => {
    const r = (await http.put('/cofre', { ...blob, ...(base === undefined ? {} : { baseAtualizadoEm: base }) }, cab())).data as { atualizadoEm: string };
    renovar();
    return r.atualizadoEm;
  },
};

export const ROTULO_EVENTO: Record<string, string> = {
  '2fa_ativado': 'Segundo fator ativado',
  '2fa_ok': 'Código aceito (Cofre aberto)',
  '2fa_falha': 'Código recusado',
  '2fa_bloqueado': 'Tentativa durante bloqueio',
  recuperacao_usada: 'Código de recuperação usado',
  codigos_regenerados: 'Códigos de recuperação refeitos',
  '2fa_desativado': 'Segundo fator desativado',
  cofre_lido: 'Cofre baixado do servidor',
  cofre_salvo: 'Cofre salvo no servidor',
};
