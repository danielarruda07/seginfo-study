import tls from 'node:tls';
import dns from 'node:dns';
import { isIP } from 'node:net';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { avaliarCabecalhos } from './exposicaoFontes/saudeSite.js';
import { ipNaoPublico } from './osint.js';

/**
 * Scanner de higiene de endpoint/API — NÃO destrutivo.
 *
 * Roda no servidor (alcança endpoints internos e externos), atrás do Cloudflare Access
 * (só o usuário autenticado dispara) e só contra o alvo que o usuário digita. Faz apenas
 * GET/HEAD/OPTIONS, com timeout e limite de requisições; nunca envia corpo nem tenta
 * explorar. Reporta higiene (TLS, cabeçalhos, métodos expostos, exposições comuns, auth,
 * CORS, tecnologia, superfície OpenAPI), não executa ataque. Uso restrito a alvos
 * autorizados pelo próprio operador.
 */

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

/** Resultado de um teste ativo seguro (uma requisição GET a mais, com marcador inofensivo). */
export interface TesteAtivo {
  tipo: 'reflexo' | 'open-redirect' | 'autorizacao';
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

const UA = 'seginfo-study-scanner/1.0 (teste autorizado)';
const TIMEOUT = 10_000;
const DIA_MS = 86_400_000;
const ORIGEM_PROBE = 'https://seginfo-probe.invalid';
const MAX_LOTE = 15;

const METODOS_ARRISCADOS = ['PUT', 'DELETE', 'TRACE', 'CONNECT', 'PATCH'];

/** Caminhos de exposição comum — sondagem GET, não destrutiva. */
const CAMINHOS_EXPOSICAO: { caminho: string; sensivel: boolean; sinal?: RegExp }[] = [
  { caminho: '/.git/HEAD', sensivel: true, sinal: /ref:\s*refs\// },
  { caminho: '/.env', sensivel: true, sinal: /=[^\n]/ },
  { caminho: '/actuator/health', sensivel: true, sinal: /"status"/i },
  { caminho: '/actuator/env', sensivel: true, sinal: /"propertySources"|"activeProfiles"/i },
  { caminho: '/server-status', sensivel: true, sinal: /Apache Server Status/i },
  { caminho: '/swagger.json', sensivel: true, sinal: /"swagger"|"openapi"/i },
  { caminho: '/openapi.json', sensivel: true, sinal: /"openapi"/i },
  { caminho: '/v3/api-docs', sensivel: true, sinal: /"openapi"/i },
  { caminho: '/.well-known/security.txt', sensivel: false },
  { caminho: '/robots.txt', sensivel: false },
];

/** Caminhos onde pode estar uma spec OpenAPI/Swagger legível (mapeamento de superfície). */
const CAMINHOS_OPENAPI = ['/openapi.json', '/swagger.json', '/v3/api-docs', '/api-docs', '/swagger/v1/swagger.json'];

/** Parâmetros comuns de redirecionamento — testados com destino-marcador, sem seguir. */
const PARAMS_REDIRECT = ['redirect', 'url', 'next', 'return', 'returnUrl', 'returnTo', 'dest', 'destination', 'continue', 'redirect_uri'];
/** Host-marcador inofensivo para o teste de open redirect (domínio reservado, não resolve). */
const HOST_MARCADOR = 'seginfo-redir-check.invalid';
/** Marcador inofensivo (só letras/dígitos, não é HTML nem script) para o teste de reflexo. */
const MARCADOR_REFLEXO = 'sgfRefl0PROBE';

// ---------- analisadores puros (testáveis sem rede) ----------

export function classificarMetodos(allow: string | null | undefined): { permitidos: string[]; arriscados: string[] } {
  const permitidos = (allow ?? '').split(',').map((m) => m.trim().toUpperCase()).filter(Boolean);
  const arriscados = permitidos.filter((m) => METODOS_ARRISCADOS.includes(m));
  return { permitidos, arriscados };
}

export function escopoDoIp(ip: string | null): ScanRelatorio['escopo'] {
  if (!ip || !isIP(ip)) return 'incerto';
  return ipNaoPublico(ip) ? 'interno' : 'externo';
}

export function parseCookie(raw: string): { nome: string; secure: boolean; httpOnly: boolean; sameSite: string | null } {
  const [par, ...attrs] = raw.split(';');
  const nome = (par.split('=')[0] ?? '').trim();
  const flags = attrs.map((a) => a.trim());
  const low = flags.map((f) => f.toLowerCase());
  const ss = flags.find((f) => /^samesite=/i.test(f));
  return {
    nome,
    secure: low.includes('secure'),
    httpOnly: low.includes('httponly'),
    sameSite: ss ? ss.split('=')[1] ?? null : null,
  };
}

/** Analisa a política CORS a partir da resposta a uma requisição com Origin de prova. */
export function analisarCors(origemEnviada: string, acao: string | null | undefined, acac: string | null | undefined): InfoCors {
  const a = (acao ?? '').trim();
  return {
    origemEnviada,
    acao: a || null,
    permiteCredenciais: /true/i.test(acac ?? ''),
    refleteOrigem: a === origemEnviada,
    curinga: a === '*',
  };
}

/** O corpo reflete o marcador sem codificar (indício de reflexo de entrada)? Pura. */
export function corpoReflete(corpo: string, marcador: string): boolean {
  return corpo.includes(marcador);
}

/** O Location aponta para o host-marcador (indício de open redirect)? Pura. */
export function locationApontaMarcador(location: string | null | undefined, hostMarcador: string): boolean {
  if (!location) return false;
  try {
    // resolve relativo contra uma base neutra para extrair o host de destino
    const u = new URL(location, 'https://base.local');
    return u.hostname === hostMarcador;
  } catch {
    // Location mal formado: cai no teste textual (ex.: "//host/..")
    return new RegExp(`(^|/|@)${hostMarcador.replace(/[.]/g, '\\.')}([/:?#]|$)`).test(location);
  }
}

/** Compara a resposta com e sem credencial para ver se a autorização é forçada. Pura. */
export function avaliarAutorizacao(statusSemCred: number, statusComCred: number): TesteAtivo {
  // se "sem credencial" já devolve conteúdo (2xx) e "com credencial" também, a rota não força auth
  const abertaSemCred = statusSemCred >= 200 && statusSemCred < 300;
  const indicio = abertaSemCred && statusComCred >= 200 && statusComCred < 300;
  return {
    tipo: 'autorizacao',
    parametro: null,
    indicio,
    detalhe: indicio
      ? `A rota respondeu ${statusSemCred} sem credencial e ${statusComCred} com credencial de prova: a autorização pode não estar sendo exigida.`
      : `Sem credencial: ${statusSemCred}; com credencial de prova: ${statusComCred}.`,
  };
}

/** Deriva nome/versão de tecnologia de cabeçalhos reveladores (fingerprint passivo). */
export function fingerprintTech(h: Record<string, string | undefined>): string[] {
  const get = (n: string) => h[n.toLowerCase()];
  const techs: string[] = [];
  const push = (v: string | undefined) => { if (v && !techs.includes(v)) techs.push(v); };
  push(get('server'));
  push(get('x-powered-by'));
  push(get('x-aspnet-version') ? `ASP.NET ${get('x-aspnet-version')}` : undefined);
  push(get('x-aspnetmvc-version') ? `ASP.NET MVC ${get('x-aspnetmvc-version')}` : undefined);
  push(get('x-generator'));
  push(get('x-drupal-cache') ? 'Drupal' : undefined);
  push(get('x-runtime') ? 'Rails/Rack' : undefined);
  if (/wp-/.test(get('link') ?? '') || /wordpress/i.test(get('x-powered-by') ?? '')) push('WordPress');
  const via = get('via');
  if (via) push(`via ${via}`);
  return techs;
}

/** Detecta visibilidade de controles operacionais (rate-limit, cache) nos cabeçalhos. */
export function detectarControles(h: Record<string, string | undefined>): { rateLimit: boolean; cacheControl: string | null; retryAfter: string | null } {
  const get = (n: string) => h[n.toLowerCase()];
  const rl = !!(get('ratelimit-limit') || get('x-ratelimit-limit') || get('x-rate-limit-limit') || get('ratelimit') || get('retry-after'));
  return { rateLimit: rl, cacheControl: get('cache-control') ?? null, retryAfter: get('retry-after') ?? null };
}

/** Procura, no início do corpo, sinais de erro verboso ou vazamento (stack trace, SQL, caminho interno). */
export function analisarCorpo(texto: string): { id: string; descricao: string }[] {
  const sinais: { id: string; descricao: string }[] = [];
  const t = texto.slice(0, 8192);
  if (/\bat [\w.$]+\([\w.]+:\d+\)/.test(t) || /Exception in thread|java\.lang\.[A-Z]\w+Exception/.test(t))
    sinais.push({ id: 'stack-java', descricao: 'Possível stack trace Java/JVM na resposta' });
  if (/Traceback \(most recent call last\)/.test(t)) sinais.push({ id: 'stack-python', descricao: 'Possível traceback Python na resposta' });
  if (/\b(at Object\.|at Module\.|node:internal\/)/.test(t)) sinais.push({ id: 'stack-node', descricao: 'Possível stack trace Node.js na resposta' });
  if (/(SQL syntax|SQLSTATE|ORA-\d{5}|psql:|near "\w+": syntax error)/i.test(t)) sinais.push({ id: 'erro-sql', descricao: 'Possível mensagem de erro de banco/SQL na resposta' });
  if (/([A-Za-z]:\\[\w\\]+|\/(?:home|var|usr|opt|srv)\/[\w./-]{3,})/.test(t)) sinais.push({ id: 'caminho-interno', descricao: 'Possível caminho de arquivo do servidor exposto na resposta' });
  if (/\b(?:10|172|192)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(t)) sinais.push({ id: 'ip-interno', descricao: 'Possível IP de rede interna exposto na resposta' });
  return sinais;
}

/** Resume uma spec OpenAPI/Swagger: conta rotas e operações e tira uma amostra. Pura. */
export function resumirOpenApi(url: string, obj: unknown): ResumoOpenApi | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const paths = o.paths;
  if (!paths || typeof paths !== 'object') return null;
  const info = (o.info as Record<string, unknown> | undefined) ?? {};
  const metodos = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
  const rotas = Object.keys(paths);
  let operacoes = 0;
  const amostra: string[] = [];
  for (const rota of rotas) {
    const item = (paths as Record<string, unknown>)[rota];
    if (!item || typeof item !== 'object') continue;
    for (const m of Object.keys(item as Record<string, unknown>)) {
      if (metodos.has(m.toLowerCase())) {
        operacoes++;
        if (amostra.length < 12) amostra.push(`${m.toUpperCase()} ${rota}`);
      }
    }
  }
  return {
    url,
    titulo: typeof info.title === 'string' ? info.title : null,
    versao: typeof info.version === 'string' ? info.version : null,
    rotas: rotas.length,
    operacoes,
    amostra,
  };
}

/** Monta os achados a partir dos dados já coletados. Pura: sem rede. */
export function montarAchados(d: {
  status: number | null;
  tls: InfoTlsScan | null;
  usaHttps: boolean;
  cabecalhos: { id: string; nome: string; presente: boolean }[];
  metodos: { arriscados: string[] } | null;
  cookies: { nome: string; secure: boolean; httpOnly: boolean; sameSite: string | null }[];
  cors: InfoCors | null;
  corpoSinais: { id: string; descricao: string }[];
  exposicoes: Exposicao[];
  testesAtivos: TesteAtivo[];
  servidor: string | null;
  poweredBy: string | null;
}): Achado[] {
  const a: Achado[] = [];

  // TLS
  if (d.usaHttps && d.tls) {
    if (!d.tls.cadeiaConfiavel) a.push({ id: 'tls-cadeia', severidade: 'alta', titulo: 'Cadeia TLS não confiável', detalhe: d.tls.erroCadeia ?? 'O certificado não validou contra as CAs públicas.', recomendacao: 'Verificar a cadeia de certificados e o emissor.' });
    if (d.tls.diasRestantes !== null) {
      if (d.tls.diasRestantes < 0) a.push({ id: 'tls-vencido', severidade: 'alta', titulo: 'Certificado TLS vencido', detalhe: `Venceu há ${Math.abs(d.tls.diasRestantes)} dia(s).`, recomendacao: 'Renovar o certificado imediatamente.' });
      else if (d.tls.diasRestantes <= 14) a.push({ id: 'tls-vence', severidade: 'alta', titulo: 'Certificado TLS vence em breve', detalhe: `Faltam ${d.tls.diasRestantes} dia(s).`, recomendacao: 'Programar a renovação.' });
      else if (d.tls.diasRestantes <= 30) a.push({ id: 'tls-vence30', severidade: 'media', titulo: 'Certificado TLS vence em menos de 30 dias', detalhe: `Faltam ${d.tls.diasRestantes} dia(s).`, recomendacao: 'Programar a renovação.' });
    }
    if (d.tls.protocolo && /TLSv1(\.[01])?$/.test(d.tls.protocolo)) a.push({ id: 'tls-protocolo', severidade: 'media', titulo: `Protocolo TLS obsoleto (${d.tls.protocolo})`, detalhe: 'TLS 1.0/1.1 estão descontinuados.', recomendacao: 'Exigir TLS 1.2+.' });
  } else if (!d.usaHttps && (d.status ?? 0) > 0) {
    a.push({ id: 'sem-https', severidade: 'alta', titulo: 'Endpoint sem HTTPS', detalhe: 'O alvo respondeu em HTTP puro; tráfego e credenciais trafegam sem cifra.', recomendacao: 'Servir por HTTPS e redirecionar HTTP → HTTPS.' });
  }

  // Cabeçalhos
  for (const c of d.cabecalhos) {
    if (c.presente) continue;
    const sev: Severidade = c.id === 'hsts' || c.id === 'csp' ? 'media' : 'baixa';
    a.push({ id: `cab-${c.id}`, severidade: sev, titulo: `Falta ${c.nome}`, detalhe: 'Cabeçalho de segurança ausente na resposta.', recomendacao: `Adicionar ${c.nome}.` });
  }

  // Métodos
  if (d.metodos && d.metodos.arriscados.length) {
    const temTrace = d.metodos.arriscados.includes('TRACE');
    a.push({ id: 'metodos', severidade: temTrace ? 'media' : 'baixa', titulo: `Métodos HTTP sensíveis expostos: ${d.metodos.arriscados.join(', ')}`, detalhe: temTrace ? 'TRACE pode permitir Cross-Site Tracing.' : 'Confirmar se PUT/DELETE/PATCH deveriam estar acessíveis sem autenticação.', recomendacao: 'Desabilitar métodos não usados; exigir auth nos de escrita.' });
  }

  // CORS
  if (d.cors) {
    if (d.cors.refleteOrigem && d.cors.permiteCredenciais) {
      a.push({ id: 'cors-credenciais', severidade: 'alta', titulo: 'CORS reflete qualquer origem com credenciais', detalhe: `Access-Control-Allow-Origin ecoou a origem de prova (${d.cors.origemEnviada}) e Allow-Credentials=true. Sites de terceiros poderiam ler respostas autenticadas.`, recomendacao: 'Usar uma allowlist fixa de origens; nunca refletir a origem recebida junto de credenciais.' });
    } else if (d.cors.refleteOrigem) {
      a.push({ id: 'cors-reflexo', severidade: 'media', titulo: 'CORS reflete a origem enviada', detalhe: `O servidor ecoou a origem de prova (${d.cors.origemEnviada}) em Access-Control-Allow-Origin. Sem credenciais o risco é menor; confirmar se é intencional.`, recomendacao: 'Preferir uma allowlist fixa a refletir a origem recebida.' });
    } else if (d.cors.curinga && d.cors.permiteCredenciais) {
      a.push({ id: 'cors-curinga-cred', severidade: 'media', titulo: 'CORS com curinga e credenciais', detalhe: 'Access-Control-Allow-Origin=* junto de Allow-Credentials=true é inconsistente (navegadores ignoram), mas sinaliza config CORS mal entendida.', recomendacao: 'Definir origens explícitas quando há credenciais.' });
    }
  }

  // Cookies
  for (const ck of d.cookies) {
    const faltas: string[] = [];
    if (!ck.secure) faltas.push('Secure');
    if (!ck.httpOnly) faltas.push('HttpOnly');
    if (faltas.length) a.push({ id: `cookie-${ck.nome}`, severidade: 'media', titulo: `Cookie "${ck.nome}" sem ${faltas.join(' e ')}`, detalhe: 'Cookie pode vazar por canal inseguro ou ser lido por script.', recomendacao: 'Marcar Secure, HttpOnly e SameSite.' });
    if ((ck.sameSite ?? '').toLowerCase() === 'none' && !ck.secure) a.push({ id: `cookie-ss-${ck.nome}`, severidade: 'media', titulo: `Cookie "${ck.nome}" com SameSite=None sem Secure`, detalhe: 'SameSite=None exige Secure; sem isso o navegador rejeita e o cookie trafega em contexto inseguro.', recomendacao: 'Adicionar Secure a cookies SameSite=None.' });
  }

  // Sinais de erro verboso no corpo
  for (const s of d.corpoSinais) {
    a.push({ id: `corpo-${s.id}`, severidade: 'media', titulo: 'Resposta expõe detalhe interno', detalhe: s.descricao, recomendacao: 'Devolver erros genéricos ao cliente; registrar o detalhe só no log.' });
  }

  // Exposições
  for (const e of d.exposicoes) {
    if (e.acessivel && e.sensivel) a.push({ id: `exp-${e.caminho}`, severidade: 'alta', titulo: `Exposição acessível: ${e.caminho}`, detalhe: `Respondeu ${e.status} com conteúdo compatível.`, recomendacao: 'Bloquear o acesso público a esse caminho.' });
  }

  // Testes ativos (seguros): sinalizam candidatos, não confirmam exploração
  for (const t of d.testesAtivos) {
    if (!t.indicio) continue;
    if (t.tipo === 'open-redirect') a.push({ id: `ativo-redirect-${t.parametro}`, severidade: 'media', titulo: `Possível open redirect no parâmetro "${t.parametro}"`, detalhe: `${t.detalhe} A confirmar: redirecionamento para destino externo controlado pela URL.`, recomendacao: 'Validar o destino contra uma allowlist; não redirecionar para URLs absolutas vindas do cliente.' });
    else if (t.tipo === 'reflexo') a.push({ id: `ativo-reflexo-${t.parametro}`, severidade: 'media', titulo: `Entrada refletida sem codificação (parâmetro "${t.parametro}")`, detalhe: `${t.detalhe} A confirmar: ponto candidato a XSS refletido (o scanner não injeta script, só um marcador inofensivo).`, recomendacao: 'Codificar a saída conforme o contexto (HTML/atributo/JS) e aplicar CSP.' });
    else if (t.tipo === 'autorizacao') a.push({ id: 'ativo-autorizacao', severidade: 'media', titulo: 'Autorização pode não estar sendo exigida', detalhe: `${t.detalhe} A confirmar com o dono da aplicação se a rota deveria ser protegida.`, recomendacao: 'Exigir autenticação/autorização nas rotas sensíveis e negar por padrão.' });
  }

  // Divulgação de versão
  if (d.servidor && /\d/.test(d.servidor)) a.push({ id: 'banner-server', severidade: 'baixa', titulo: 'Divulgação de versão no header Server', detalhe: `Server: ${d.servidor}`, recomendacao: 'Omitir a versão do servidor.' });
  if (d.poweredBy) a.push({ id: 'banner-powered', severidade: 'baixa', titulo: 'Header X-Powered-By exposto', detalhe: `X-Powered-By: ${d.poweredBy}`, recomendacao: 'Remover o header X-Powered-By.' });

  const ordem: Record<Severidade, number> = { alta: 0, media: 1, baixa: 2, info: 3 };
  return a.sort((x, y) => ordem[x.severidade] - ordem[y.severidade]);
}

// ---------- IO ----------

function resolverIp(host: string): Promise<string | null> {
  if (isIP(host)) return Promise.resolve(host);
  return new Promise((resolve) => {
    dns.lookup(host, (err, addr) => resolve(err ? null : addr));
  });
}

function lerTls(host: string, port: number): Promise<InfoTlsScan | null> {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port, servername: host, rejectUnauthorized: false, timeout: TIMEOUT }, () => {
      const cert = s.getPeerCertificate();
      const validoAte = cert?.valid_to ? new Date(cert.valid_to) : null;
      const ok = validoAte && !Number.isNaN(validoAte.getTime());
      const issuer = (cert?.issuer as Record<string, unknown> | undefined) ?? {};
      resolve({
        protocolo: s.getProtocol(),
        emissor: String(issuer.O ?? issuer.CN ?? 'desconhecido'),
        validoAte: ok ? validoAte!.toISOString().slice(0, 10) : null,
        diasRestantes: ok ? Math.floor((validoAte!.getTime() - Date.now()) / DIA_MS) : null,
        cadeiaConfiavel: s.authorized,
        erroCadeia: s.authorizationError ? String(s.authorizationError) : null,
      });
      s.end();
    });
    s.on('timeout', () => { s.destroy(); resolve(null); });
    s.on('error', () => resolve(null));
  });
}

async function seguirRedirects(url: string): Promise<{ status: number; urlFinal: string; headers: Headers; corpo: string; redirects: { status: number; para: string }[] }> {
  let atual = url;
  const redirects: { status: number; para: string }[] = [];
  for (let i = 0; i <= 5; i++) {
    const r = await fetch(atual, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA, Origin: ORIGEM_PROBE }, signal: AbortSignal.timeout(TIMEOUT) });
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc && i < 5) {
      const prox = new URL(loc, atual).toString();
      redirects.push({ status: r.status, para: prox });
      atual = prox;
      continue;
    }
    let corpo = '';
    const ct = r.headers.get('content-type') ?? '';
    if (/text|json|xml|html/i.test(ct)) {
      try { corpo = (await r.text()).slice(0, 8192); } catch { corpo = ''; }
    }
    return { status: r.status, urlFinal: atual, headers: r.headers, corpo, redirects };
  }
  throw new Error('redirecionamentos demais');
}

async function sondarExposicao(base: URL, item: { caminho: string; sensivel: boolean; sinal?: RegExp }): Promise<Exposicao> {
  try {
    const u = new URL(item.caminho, base.origin).toString();
    const r = await fetch(u, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) });
    let acessivel = r.status === 200;
    if (acessivel && item.sinal) {
      const corpo = (await r.text()).slice(0, 2048);
      acessivel = item.sinal.test(corpo);
    }
    return { caminho: item.caminho, status: r.status, acessivel, sensivel: item.sensivel };
  } catch {
    return { caminho: item.caminho, status: 0, acessivel: false, sensivel: item.sensivel };
  }
}

async function obterMetodos(url: string): Promise<{ metodos: { permitidos: string[]; arriscados: string[] } | null; acao: string | null; acac: string | null }> {
  try {
    const r = await fetch(url, { method: 'OPTIONS', redirect: 'manual', headers: { 'User-Agent': UA, Origin: ORIGEM_PROBE, 'Access-Control-Request-Method': 'GET' }, signal: AbortSignal.timeout(TIMEOUT) });
    const allow = r.headers.get('allow') ?? r.headers.get('access-control-allow-methods');
    return {
      metodos: allow ? classificarMetodos(allow) : null,
      acao: r.headers.get('access-control-allow-origin'),
      acac: r.headers.get('access-control-allow-credentials'),
    };
  } catch {
    return { metodos: null, acao: null, acac: null };
  }
}

/** Busca a primeira spec OpenAPI/Swagger legível e a resume. */
async function descobrirOpenApi(base: URL): Promise<ResumoOpenApi | null> {
  for (const caminho of CAMINHOS_OPENAPI) {
    try {
      const u = new URL(caminho, base.origin).toString();
      const r = await fetch(u, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) });
      if (r.status !== 200) continue;
      const ct = r.headers.get('content-type') ?? '';
      if (!/json/i.test(ct)) continue;
      const obj = await r.json().catch(() => null);
      const resumo = resumirOpenApi(u, obj);
      if (resumo) return resumo;
    } catch {
      /* próximo caminho */
    }
  }
  return null;
}

const CAB_DICA: Record<string, string> = {
  'Strict-Transport-Security': 'força HTTPS no navegador',
  'Content-Security-Policy': 'limita de onde vêm scripts e conteúdos',
  'X-Frame-Options': 'impede a página dentro de iframe (clickjacking)',
  'X-Content-Type-Options': 'nosniff evita interpretar arquivo com o tipo errado',
  'Referrer-Policy': 'controla o que vaza no Referer',
  'Permissions-Policy': 'desliga câmera, microfone etc. não usados',
};

// ---------- testes ativos seguros (uma requisição GET a mais, marcador inofensivo) ----------

/** Devolve a URL com um parâmetro setado/sobrescrito (mantém os demais). */
function comParametro(base: URL, nome: string, valor: string): string {
  const u = new URL(base.toString());
  u.searchParams.set(nome, valor);
  return u.toString();
}

/** Reflexo: injeta um marcador inofensivo e vê se ele volta cru no corpo. */
async function testarReflexo(base: URL): Promise<TesteAtivo | null> {
  // testa um parâmetro existente, senão um nome comum
  const nome = [...base.searchParams.keys()][0] ?? 'q';
  try {
    const alvo = comParametro(base, nome, MARCADOR_REFLEXO);
    const r = await fetch(alvo, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) });
    const ct = r.headers.get('content-type') ?? '';
    if (!/text|html|xml|json/i.test(ct)) return { tipo: 'reflexo', parametro: nome, indicio: false, detalhe: 'Resposta não textual; reflexo não avaliado.' };
    const corpo = (await r.text()).slice(0, 16384);
    const refletiu = corpoReflete(corpo, MARCADOR_REFLEXO);
    return { tipo: 'reflexo', parametro: nome, indicio: refletiu, detalhe: refletiu ? `O valor do parâmetro "${nome}" voltou sem codificação no corpo.` : `O marcador em "${nome}" não apareceu cru na resposta.` };
  } catch {
    return null;
  }
}

/** Open redirect: seta destino-marcador em parâmetros comuns e olha o Location sem seguir. */
async function testarOpenRedirect(base: URL): Promise<TesteAtivo[]> {
  const marcador = `https://${HOST_MARCADOR}/or`;
  const resultados = await Promise.all(PARAMS_REDIRECT.map(async (nome): Promise<TesteAtivo | null> => {
    try {
      const alvo = comParametro(base, nome, marcador);
      const r = await fetch(alvo, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) });
      if (r.status < 300 || r.status >= 400) return null;
      const indicio = locationApontaMarcador(r.headers.get('location'), HOST_MARCADOR);
      if (!indicio) return null;
      return { tipo: 'open-redirect', parametro: nome, indicio: true, detalhe: `Resposta ${r.status} com Location para o destino-marcador.` };
    } catch {
      return null;
    }
  }));
  return resultados.filter((t): t is TesteAtivo => t !== null);
}

/** Autorização: compara a resposta sem e com uma credencial de prova (Bearer inválido). */
async function testarAutorizacao(url: string, statusSemCred: number): Promise<TesteAtivo | null> {
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA, Authorization: 'Bearer seginfo-probe-invalido' }, signal: AbortSignal.timeout(TIMEOUT) });
    return avaliarAutorizacao(statusSemCred, r.status);
  } catch {
    return null;
  }
}

export async function escanear(urlBruta: string, opts: { exposicoes: boolean; openapi?: boolean; ativos?: boolean }): Promise<ScanRelatorio> {
  const em = new Date().toISOString();
  let u: URL;
  try {
    u = new URL(urlBruta);
  } catch {
    throw new Error('URL inválida');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Só http/https são aceitos');

  const usaHttps = u.protocol === 'https:';
  const port = u.port ? Number(u.port) : usaHttps ? 443 : 80;
  const ip = await resolverIp(u.hostname);

  const base: ScanRelatorio = {
    url: u.toString(), urlFinal: u.toString(), escopo: escopoDoIp(ip), ipResolvido: ip,
    alcancavel: false, erro: null, status: null, tempoMs: null, servidor: null, poweredBy: null,
    tecnologias: [], redirects: [], tls: null, cabecalhos: [], metodos: null, cookies: [],
    cors: null, controles: { rateLimit: false, cacheControl: null, retryAfter: null }, corpoSinais: [],
    openapi: null, exposicoes: [], autenticacao: 'incerta', testesAtivos: [], achados: [], em,
  };

  // requisição principal
  let headers: Headers | null = null;
  let corpo = '';
  try {
    const t0 = Date.now();
    const res = await seguirRedirects(u.toString());
    base.tempoMs = Date.now() - t0;
    base.alcancavel = true;
    base.status = res.status;
    base.urlFinal = res.urlFinal;
    base.redirects = res.redirects;
    headers = res.headers;
    corpo = res.corpo;
    base.servidor = headers.get('server');
    base.poweredBy = headers.get('x-powered-by');
    base.autenticacao = res.status === 401 || res.status === 403 ? 'exigida' : res.status >= 200 && res.status < 300 ? 'aberta' : 'incerta';
    const setCookies = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    base.cookies = setCookies.map(parseCookie);
  } catch (e) {
    base.erro = e instanceof Error ? e.message : 'falha ao conectar';
    return base;
  }

  const mapaHeaders = Object.fromEntries(headers.entries());
  const av = avaliarCabecalhos(mapaHeaders);
  base.cabecalhos = av.map((c) => ({ nome: c.nome, presente: c.presente, valor: c.valor, dica: CAB_DICA[c.nome] ?? '' }));
  base.tecnologias = fingerprintTech(mapaHeaders);
  base.controles = detectarControles(mapaHeaders);
  base.cors = analisarCors(ORIGEM_PROBE, mapaHeaders['access-control-allow-origin'], mapaHeaders['access-control-allow-credentials']);
  base.corpoSinais = analisarCorpo(corpo);

  // TLS, métodos+CORS, exposições e OpenAPI em paralelo
  const [tlsInfo, metodosInfo, exposicoes, openapi] = await Promise.all([
    usaHttps ? lerTls(u.hostname, port) : Promise.resolve(null),
    obterMetodos(u.toString()),
    opts.exposicoes ? Promise.all(CAMINHOS_EXPOSICAO.map((c) => sondarExposicao(u, c))) : Promise.resolve([] as Exposicao[]),
    opts.openapi === false ? Promise.resolve(null) : descobrirOpenApi(u),
  ]);
  base.tls = tlsInfo;
  base.metodos = metodosInfo.metodos;
  base.exposicoes = exposicoes;
  base.openapi = openapi;
  // se o OPTIONS (preflight) trouxe cabeçalho CORS e o GET não, usa o do OPTIONS
  if ((!base.cors || !base.cors.acao) && metodosInfo.acao) base.cors = analisarCors(ORIGEM_PROBE, metodosInfo.acao, metodosInfo.acac);

  // testes ativos seguros (opt-in): só se o alvo respondeu
  if (opts.ativos && base.alcancavel) {
    const [reflexo, redirects, autz] = await Promise.all([
      testarReflexo(u),
      testarOpenRedirect(u),
      testarAutorizacao(u.toString(), base.status ?? 0),
    ]);
    const ativos: TesteAtivo[] = [];
    if (reflexo) ativos.push(reflexo);
    ativos.push(...redirects);
    if (autz) ativos.push(autz);
    base.testesAtivos = ativos;
  }

  base.achados = montarAchados({
    status: base.status,
    tls: base.tls,
    usaHttps,
    cabecalhos: av.map((c) => ({ id: c.id, nome: c.nome, presente: c.presente })),
    metodos: base.metodos,
    cookies: base.cookies,
    cors: base.cors,
    corpoSinais: base.corpoSinais,
    exposicoes: base.exposicoes,
    testesAtivos: base.testesAtivos,
    servidor: base.servidor,
    poweredBy: base.poweredBy,
  });

  return base;
}

// ---------- rota ----------

export function registerScanRoutes(app: FastifyInstance) {
  const Body = z.object({
    url: z.string().url().optional(),
    urls: z.array(z.string().url()).max(MAX_LOTE).optional(),
    exposicoes: z.boolean().optional(),
    openapi: z.boolean().optional(),
    ativos: z.boolean().optional(),
  }).refine((b) => b.url || (b.urls && b.urls.length), { message: 'Informe url ou urls.' });

  app.post('/api/scan', async (req, reply) => {
    const b = Body.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'Informe uma URL http/https válida (ou uma lista em "urls").' });
    const opts = { exposicoes: b.data.exposicoes ?? true, openapi: b.data.openapi, ativos: b.data.ativos ?? false };
    try {
      if (b.data.urls && b.data.urls.length) {
        const relatorios = await Promise.all(
          b.data.urls.map((url) => escanear(url, opts).catch((e) => ({ erroLote: e instanceof Error ? e.message : 'falha', url }))),
        );
        return { relatorios };
      }
      return await escanear(b.data.url!, opts);
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'falha no scan' });
    }
  });
}
