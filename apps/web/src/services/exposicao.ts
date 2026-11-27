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

/** Relatório exportável (HTML/PDF) da última varredura de exposição de um alvo. */
export function relatorioDaExposicao(alvo: AlvoExposicao): import('./exportarRelatorio').RelatorioExport {
  const u = alvo.ultima;
  const meta: [string, string][] = [['Alvo', nomeDoAlvo(alvo)], ['Tipo', alvo.tipo]];
  if (!u) {
    return { titulo: 'Relatório de exposição externa', subtitulo: nomeDoAlvo(alvo), confidencial: true, meta,
      secoes: [{ titulo: 'Resultado', texto: ['Alvo ainda não varrido.'] }] };
  }
  meta.push(['Data da varredura', new Date(u.criadoEm).toLocaleString('pt-BR')], ['Método', 'OSINT passivo (sem contato ativo com o alvo)']);
  const r = u.resultado;
  const secoes: import('./exportarRelatorio').SecaoRelatorio[] = [];
  secoes.push({ titulo: 'Resumo', tabela: { colunas: ['Indicador', 'Valor'], linhas: [
    ['Portas expostas', u.resumo.portas], ['Subdomínios', u.resumo.subdominios ?? '—'], ['CVEs associados', u.resumo.cves],
    ['Avisos de DNS/e-mail', u.resumo.avisosDns ?? '—'], ['IPs', u.resumo.ips.join(', ') || '—'],
  ] } });
  if (u.mudancas.length) {
    secoes.push({ titulo: 'Mudanças desde a varredura anterior', itens: u.mudancas.map((m) => ({ severidade: m.severidade, titulo: m.texto, local: m.fonte })) });
  }
  if (r.ip?.resultados.length) {
    secoes.push({ titulo: 'IPs e serviços', tabela: { colunas: ['IP', 'Portas', 'Hostnames', 'Software', 'CVEs'],
      linhas: r.ip.resultados.map((x) => [x.ip, (x.portas ?? []).join(', '), (x.hostnames ?? []).join(', '), (x.softwares ?? []).join(', '),
        [...(x.vulnerabilidades ?? []), ...(x.vulnerabilidadesOmitidas ? [`+${x.vulnerabilidadesOmitidas}`] : [])].join(', ')]) } });
  }
  if (r.dns) {
    secoes.push({ titulo: 'DNS e e-mail', texto: r.dns.avisos.length ? r.dns.avisos : undefined, tabela: { colunas: ['Registro', 'Valor'], linhas: [
      ['A', r.dns.a.join(', ')], ['AAAA', r.dns.aaaa.join(', ')], ['CNAME', r.dns.cname.join(', ')], ['MX', r.dns.mx.join(', ')],
      ['NS', r.dns.ns.join(', ')], ['CAA', r.dns.caa.join(', ')], ['SPF', r.dns.email.spf], ['DMARC', r.dns.email.dmarc],
    ] } });
  }
  if (r.certificados) {
    secoes.push({ titulo: 'Certificados (transparência)', texto: [`${r.certificados.certificados} certificado(s), ${r.certificados.subdominios} subdomínio(s).`],
      tabela: { colunas: ['Nome', 'Primeiro', 'Último', 'Certificados', 'Curinga'],
        linhas: r.certificados.nomes.map((n) => [n.nome, n.primeiro, n.ultimo, n.certificados, n.curinga ? 'sim' : 'não']) } });
  }
  for (const f of r.extras ?? []) {
    secoes.push({ titulo: f.nome, texto: f.observacao ? [f.observacao] : undefined,
      tabela: { colunas: ['Item', 'Valor'], linhas: [
        ...f.destaques.map((d) => [d.rotulo, d.valor] as (string | number)[]),
        ...f.secoes.flatMap((s) => s.itens.map((i) => [s.titulo, `${i.texto}${i.detalhe ? ` — ${i.detalhe}` : ''}`])),
      ] } });
  }
  if (r.erros.length) secoes.push({ titulo: 'Fontes com erro', tabela: { colunas: ['Fonte', 'Mensagem'], linhas: r.erros.map((e) => [e.fonte, e.mensagem]) } });
  return { titulo: 'Relatório de exposição externa', subtitulo: nomeDoAlvo(alvo), confidencial: true, meta, secoes };
}
