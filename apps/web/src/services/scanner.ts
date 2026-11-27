import { http } from './http';
import { collection } from './store';
import type { RelatorioExport, SecaoRelatorio } from './exportarRelatorio';

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

export interface InfoCors {
  origemEnviada: string;
  acao: string | null;
  permiteCredenciais: boolean;
  refleteOrigem: boolean;
  curinga: boolean;
}

export interface ResumoOpenApi {
  url: string;
  titulo: string | null;
  versao: string | null;
  rotas: number;
  operacoes: number;
  amostra: string[];
}

export interface TesteAtivo {
  tipo: 'reflexo' | 'open-redirect' | 'autorizacao' | 'sqli-erro' | 'prompt-canario';
  parametro: string | null;
  indicio: boolean;
  detalhe: string;
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
  tecnologias: string[];
  redirects: { status: number; para: string }[];
  tls: InfoTlsScan | null;
  cabecalhos: { nome: string; presente: boolean; valor: string | null; dica: string }[];
  metodos: { permitidos: string[]; arriscados: string[] } | null;
  cookies: { nome: string; secure: boolean; httpOnly: boolean; sameSite: string | null }[];
  cors: InfoCors | null;
  controles: { rateLimit: boolean; cacheControl: string | null; retryAfter: string | null };
  corpoSinais: { id: string; descricao: string }[];
  openapi: ResumoOpenApi | null;
  exposicoes: Exposicao[];
  autenticacao: 'exigida' | 'aberta' | 'incerta';
  testesAtivos: TesteAtivo[];
  achados: Achado[];
  em: string;
}

export interface ScanRegistro extends ScanRelatorio {
  id: string;
}

const historico = collection<ScanRegistro>('scanner-historico');

export async function escanearEndpoint(url: string, exposicoes = true, ativos = false): Promise<ScanRelatorio> {
  const { data } = await http.post<ScanRelatorio>('/scan', { url, exposicoes, ativos });
  historico.add({ ...data });
  return data;
}

/** Escaneia um lote de URLs (até 15) numa só chamada e guarda cada relatório no histórico. */
export async function escanearLote(urls: string[], exposicoes = true, ativos = false): Promise<ScanRelatorio[]> {
  const { data } = await http.post<{ relatorios: (ScanRelatorio | { erroLote: string; url: string })[] }>('/scan', { urls, exposicoes, ativos });
  const ok = data.relatorios.filter((r): r is ScanRelatorio => 'achados' in r);
  for (const r of ok) historico.add({ ...r });
  return ok;
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

const SEV_TXT: Record<Severidade, string> = { alta: 'ALTA', media: 'MÉDIA', baixa: 'BAIXA', info: 'INFO' };

/** Gera o laudo em Markdown para exportar/anexar a um relatório de pentest. */
export function laudoMarkdown(r: ScanRelatorio): string {
  const c = contarSeveridade(r.achados);
  const L: string[] = [];
  L.push(`# Laudo de higiene — ${r.url}`);
  L.push('');
  L.push(`- Data: ${new Date(r.em).toLocaleString('pt-BR')}`);
  L.push(`- Escopo: ${r.escopo}${r.ipResolvido ? ` (${r.ipResolvido})` : ''}`);
  L.push(`- HTTP: ${r.status ?? '—'} · Auth: ${r.autenticacao} · Tempo: ${r.tempoMs ?? '—'} ms`);
  if (r.urlFinal !== r.url) L.push(`- URL final: ${r.urlFinal}`);
  if (r.tecnologias.length) L.push(`- Tecnologias: ${r.tecnologias.join(', ')}`);
  L.push(`- Achados: ${c.alta} alto(s), ${c.media} médio(s), ${c.baixa + c.info} baixo(s)/info`);
  L.push('');
  if (r.achados.length) {
    L.push('## Achados');
    for (const a of r.achados) {
      L.push(`- **[${SEV_TXT[a.severidade]}] ${a.titulo}** — ${a.detalhe}${a.recomendacao ? ` _Recomendação: ${a.recomendacao}_` : ''}`);
    }
    L.push('');
  }
  if (r.tls) {
    L.push('## TLS');
    L.push(`- Protocolo: ${r.tls.protocolo ?? '?'} · Emissor: ${r.tls.emissor}`);
    L.push(`- Válido até: ${r.tls.validoAte ?? '?'}${r.tls.diasRestantes != null ? ` (${r.tls.diasRestantes} dias)` : ''} · Cadeia: ${r.tls.cadeiaConfiavel ? 'confiável' : 'NÃO confiável'}`);
    L.push('');
  }
  L.push('## Cabeçalhos de segurança');
  for (const h of r.cabecalhos) L.push(`- ${h.presente ? '✓' : '✗'} ${h.nome}${h.presente ? '' : ` — falta: ${h.dica}`}`);
  L.push('');
  if (r.cors?.acao) {
    L.push('## CORS');
    L.push(`- Access-Control-Allow-Origin: ${r.cors.acao}${r.cors.permiteCredenciais ? ' · Allow-Credentials: true' : ''}`);
    L.push('');
  }
  if (r.openapi) {
    L.push('## Superfície (OpenAPI)');
    L.push(`- ${r.openapi.titulo ?? 'spec'} ${r.openapi.versao ?? ''} em ${r.openapi.url}`);
    L.push(`- ${r.openapi.rotas} rota(s), ${r.openapi.operacoes} operação(ões)`);
    for (const op of r.openapi.amostra) L.push(`  - ${op}`);
    L.push('');
  }
  if (r.testesAtivos.length) {
    L.push('## Testes ativos (seguros, a confirmar)');
    for (const t of r.testesAtivos) {
      L.push(`- [${t.indicio ? 'INDÍCIO' : 'ok'}] ${t.tipo}${t.parametro ? ` (${t.parametro})` : ''} — ${t.detalhe}`);
    }
    L.push('');
  }
  if (r.metodos?.permitidos.length) L.push(`Métodos (OPTIONS): ${r.metodos.permitidos.join(', ')}`);
  if (r.exposicoes.length) L.push(`Exposições sondadas: ${r.exposicoes.map((e) => `${e.caminho} (${e.status}${e.acessivel ? ', acessível' : ''})`).join(' · ')}`);
  return L.join('\n');
}

/** Dispara o download de um texto como arquivo no navegador. */
export function baixarArquivo(nome: string, conteudo: string, tipo = 'text/plain'): void {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}


/** Seções de um relatório de scan (reutilizadas no relatório único e no de lote). */
function secoesDoScan(r: ScanRelatorio, prefixo = ''): SecaoRelatorio[] {
  const p = prefixo ? `${prefixo} — ` : '';
  const secoes: SecaoRelatorio[] = [];
  secoes.push({
    titulo: `${p}Achados`,
    texto: r.achados.length ? undefined : ['Nenhum achado nesta varredura.'],
    itens: r.achados.map((a) => ({ severidade: a.severidade, titulo: a.titulo, detalhe: a.detalhe, recomendacao: a.recomendacao })),
  });
  if (r.tls) {
    secoes.push({ titulo: `${p}TLS / certificado`, tabela: { colunas: ['Item', 'Valor'], linhas: [
      ['Protocolo', r.tls.protocolo], ['Emissor', r.tls.emissor],
      ['Válido até', r.tls.validoAte ? `${r.tls.validoAte}${r.tls.diasRestantes != null ? ` (${r.tls.diasRestantes} dias)` : ''}` : null],
      ['Cadeia', r.tls.cadeiaConfiavel ? 'confiável' : `NÃO confiável${r.tls.erroCadeia ? ` (${r.tls.erroCadeia})` : ''}`],
    ] } });
  }
  secoes.push({ titulo: `${p}Cabeçalhos de segurança`, tabela: { colunas: ['Cabeçalho', 'Situação', 'Valor / dica'],
    linhas: r.cabecalhos.map((h) => [h.nome, h.presente ? 'presente' : 'ausente', h.presente ? h.valor : h.dica]) } });
  const extras: (string | null)[][] = [];
  if (r.cors?.acao) extras.push(['CORS', `Allow-Origin=${r.cors.acao}${r.cors.permiteCredenciais ? ' · credenciais' : ''}${r.cors.refleteOrigem ? ' · reflete a origem' : ''}`]);
  if (r.metodos?.permitidos.length) extras.push(['Métodos (OPTIONS)', r.metodos.permitidos.join(', ')]);
  if (r.tecnologias.length) extras.push(['Tecnologias', r.tecnologias.join(', ')]);
  extras.push(['Rate-limit visível', r.controles.rateLimit ? 'sim' : 'não']);
  if (r.controles.cacheControl) extras.push(['Cache-Control', r.controles.cacheControl]);
  if (r.redirects.length) extras.push(['Redirecionamentos', r.redirects.map((x) => `${x.status}→${x.para}`).join(' · ')]);
  secoes.push({ titulo: `${p}Superfície e controles`, tabela: { colunas: ['Item', 'Valor'], linhas: extras } });
  if (r.openapi) {
    secoes.push({ titulo: `${p}Superfície da API (OpenAPI)`, texto: [`${r.openapi.titulo ?? 'spec'} ${r.openapi.versao ?? ''} em ${r.openapi.url} — ${r.openapi.rotas} rota(s), ${r.openapi.operacoes} operação(ões).`],
      codigo: r.openapi.amostra.join('\n') || undefined });
  }
  if (r.testesAtivos.length) {
    secoes.push({ titulo: `${p}Testes ativos (seguros, a confirmar)`, tabela: { colunas: ['Teste', 'Parâmetro', 'Indício', 'Detalhe'],
      linhas: r.testesAtivos.map((t) => [t.tipo, t.parametro, t.indicio ? 'SIM' : 'não', t.detalhe]) } });
  }
  if (r.exposicoes.length) {
    secoes.push({ titulo: `${p}Exposições sondadas`, tabela: { colunas: ['Caminho', 'HTTP', 'Acessível', 'Sensível'],
      linhas: r.exposicoes.map((e) => [e.caminho, e.status, e.acessivel ? 'SIM' : 'não', e.sensivel ? 'sim' : 'não']) } });
  }
  return secoes;
}

/** Relatório exportável (HTML/PDF) de um scan. */
export function relatorioDoScan(r: ScanRelatorio): RelatorioExport {
  const c = contarSeveridade(r.achados);
  return {
    titulo: 'Relatório de varredura de endpoint',
    subtitulo: r.url,
    confidencial: true,
    meta: [
      ['Alvo', r.url], ...(r.urlFinal !== r.url ? [['URL final', r.urlFinal] as [string, string]] : []),
      ['Data', new Date(r.em).toLocaleString('pt-BR')], ['Escopo', `${r.escopo}${r.ipResolvido ? ` (${r.ipResolvido})` : ''}`],
      ['HTTP', String(r.status ?? '—')], ['Autenticação', r.autenticacao], ['Tempo de resposta', r.tempoMs != null ? `${r.tempoMs} ms` : '—'],
      ['Método', 'Não destrutivo: GET/HEAD/OPTIONS' + (r.testesAtivos.length ? ' + testes ativos benignos' : '')],
    ],
    resumo: { alta: c.alta, media: c.media, baixa: c.baixa, info: c.info },
    secoes: r.alcancavel ? secoesDoScan(r) : [{ titulo: 'Resultado', texto: [`Alvo inalcançável: ${r.erro ?? 'sem resposta'}.`] }],
  };
}

/** Relatório único (HTML/PDF) consolidando um lote de scans. */
export function relatorioDoLote(rs: ScanRelatorio[]): RelatorioExport {
  const todos = rs.flatMap((r) => r.achados);
  const c = contarSeveridade(todos);
  return {
    titulo: 'Relatório de varredura de endpoints (lote)',
    subtitulo: `${rs.length} alvo(s)`,
    confidencial: true,
    meta: [['Data', new Date().toLocaleString('pt-BR')], ['Alvos', rs.map((r) => r.url).join(' · ')]],
    resumo: { alta: c.alta, media: c.media, baixa: c.baixa, info: c.info },
    secoes: [
      { titulo: 'Visão por alvo', tabela: { colunas: ['Alvo', 'HTTP', 'Altos', 'Médios', 'Baixos/Info'],
        linhas: rs.map((r) => { const k = contarSeveridade(r.achados); return [r.url, r.status, k.alta, k.media, k.baixa + k.info]; }) } },
      ...rs.flatMap((r) => secoesDoScan(r, r.url)),
    ],
  };
}
