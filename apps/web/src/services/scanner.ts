import { http } from './http';
import { collection } from './store';

/** Espelho do relatório devolvido por POST /api/scan (apps/api/src/scanEndpoint.ts). */
export type Severidade = 'alta' | 'media' | 'baixa' | 'info';

export interface Achado {
  id: string;
  severidade: Severidade;
  titulo: string;
  detalhe: string;
  recomendacao?: string;
}

export interface InfoTlsScan {
  protocolo: string | null;
  emissor: string;
  validoAte: string | null;
  diasRestantes: number | null;
  cadeiaConfiavel: boolean;
  erroCadeia: string | null;
}

export interface Exposicao {
  caminho: string;
  status: number;
  acessivel: boolean;
  sensivel: boolean;
}

export interface ScanRelatorio {
  url: string;
  urlFinal: string;
  escopo: 'interno' | 'externo' | 'incerto';
  ipResolvido: string | null;
  alcancavel: boolean;
  erro: string | null;
  status: number | null;
  tempoMs: number | null;
  servidor: string | null;
  poweredBy: string | null;
  redirects: { status: number; para: string }[];
  tls: InfoTlsScan | null;
  cabecalhos: { nome: string; presente: boolean; valor: string | null; dica: string }[];
  metodos: { permitidos: string[]; arriscados: string[] } | null;
  cookies: { nome: string; secure: boolean; httpOnly: boolean; sameSite: string | null }[];
  exposicoes: Exposicao[];
  autenticacao: 'exigida' | 'aberta' | 'incerta';
  achados: Achado[];
  em: string;
}

export interface ScanRegistro extends ScanRelatorio {
  id: string;
}

const historico = collection<ScanRegistro>('scanner-historico');

export async function escanearEndpoint(url: string, exposicoes = true): Promise<ScanRelatorio> {
  const { data } = await http.post<ScanRelatorio>('/scan', { url, exposicoes });
  historico.add({ ...data });
  return data;
}

export function listarHistorico(): ScanRegistro[] {
  return historico.all().slice().reverse();
}

export function removerDoHistorico(id: string): void {
  historico.remove(id);
}

export function limparHistorico(): void {
  for (const r of historico.all()) historico.remove(r.id);
}

/** Contagem de achados por severidade, para resumos. */
export function contarSeveridade(achados: Achado[]): Record<Severidade, number> {
  const base: Record<Severidade, number> = { alta: 0, media: 0, baixa: 0, info: 0 };
  for (const a of achados) base[a.severidade]++;
  return base;
}
