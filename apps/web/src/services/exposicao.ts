import { http } from './http';

/** Minha exposição: o que a internet vê dos domínios e IPs próprios (OSINT passivo, só pela API). */

export type TipoAlvo = 'dominio' | 'ip' | 'ip-publico' | 'email';
export type Severidade = 'alta' | 'media' | 'info';

export interface Mudanca {
  tipo: string;
  severidade: Severidade;
  texto: string;
  fonte?: string;
}

/** Resultado genérico de uma fonte extra: a tela só desenha destaques e seções. */
export type Tom = 'alta' | 'media' | 'info' | 'ok';
export interface ResultadoFonte {
  fonte: string;
  nome: string;
  observacao?: string;
  destaques: { rotulo: string; valor: string | number; tom?: Tom }[];
  secoes: { titulo: string; itens: { texto: string; tom?: Tom; link?: string; detalhe?: string }[]; vazio?: string }[];
}

export interface NomeCertificado { nome: string; primeiro: string; ultimo: string; certificados: number; curinga: boolean }

export interface ResultadoIp {
  ip: string;
  encontrado: boolean;
  portas?: number[];
  hostnames?: string[];
  softwares?: string[];
  tags?: string[];
  vulnerabilidades?: string[];
  vulnerabilidadesOmitidas?: number;
  observacao?: string;
  erro?: string;
}

export interface ResultadoExposicao {
  tipo: TipoAlvo;
  valor: string;
  certificados: {
    certificados: number; subdominios: number; nomes: NomeCertificado[]; nomesOmitidos: number;
    emissores: { nome: string; total: number }[];
  } | null;
  dns: {
    existe: boolean; a: string[]; aaaa: string[]; cname: string[]; mx: string[]; ns: string[]; txt: string[]; caa: string[];
    email: { spf: string | null; dmarc: string | null; politicaDmarc: string | null };
    avisos: string[];
  } | null;
  ip: { origem: string; resultados: ResultadoIp[] } | null;
  erros: { fonte: string; mensagem: string }[];
  extras?: ResultadoFonte[];
  desligadas?: { fonte: string; nome: string; faltando: string[] }[];
}

export interface ResumoExposicao { portas: number; subdominios: number | null; cves: number; avisosDns: number | null; ips: string[] }

export interface Varredura {
  id: string;
  criadoEm: string;
  erro: string | null;
  mudancas: Mudanca[];
  resumo: ResumoExposicao;
}

export interface VarreduraCompleta extends Varredura { resultado: ResultadoExposicao }

export interface AlvoExposicao {
  id: string;
  tipo: TipoAlvo;
  valor: string;
  rotulo: string | null;
  ativo: boolean;
  criadoEm: string;
  ultima: VarreduraCompleta | null;
}

export interface MudancaRegistrada extends Mudanca { id: string; alvoId: string; criadoEm: string }

export interface PainelExposicao {
  intervaloHoras: number;
  alvos: AlvoExposicao[];
  mudancas: MudancaRegistrada[];
}

export const getExposicao = () => http.get<PainelExposicao>('/exposicao').then((r) => r.data);

export const criarAlvo = (tipo: TipoAlvo, valor?: string, rotulo?: string) =>
  http.post<AlvoExposicao>('/exposicao/alvos', { tipo, valor, rotulo }).then((r) => r.data);

export const removerAlvo = (id: string) => http.delete(`/exposicao/alvos/${id}`).then(() => undefined);

/** crt.sh pode levar até 45 s: a varredura tem prazo maior que o padrão. */
export const varrerAlvo = (id: string) =>
  http.post<VarreduraCompleta>(`/exposicao/alvos/${id}/varrer`, {}, { timeout: 120_000 }).then((r) => r.data);

export const historicoAlvo = (id: string) => http.get<Varredura[]>(`/exposicao/alvos/${id}/historico`).then((r) => r.data);

export const nomeDoAlvo = (a: Pick<AlvoExposicao, 'tipo' | 'valor' | 'rotulo'>) =>
  a.rotulo || (a.tipo === 'ip-publico' ? 'Meu IP público' : a.valor);

const PESO: Record<Severidade, number> = { alta: 0, media: 1, info: 2 };

/** "O que mudou": mais grave primeiro; dentro da mesma gravidade, mais recente primeiro. */
export const ordenarMudancas = <T extends { severidade: Severidade; criadoEm: string }>(xs: T[]): T[] =>
  [...xs].sort((a, b) => PESO[a.severidade] - PESO[b.severidade] || b.criadoEm.localeCompare(a.criadoEm));

/** Diferencia "domínio" de "IP" pelo que o usuário digitou (a API valida de novo). */
export const tipoDoTexto = (s: string): TipoAlvo => (s.includes('@') ? 'email' : /^[\d.]+$|:/.test(s.trim()) ? 'ip' : 'dominio');
