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
 * explorar. Reporta higiene (TLS, cabeçalhos, métodos expostos, exposições comuns, auth),
 * não executa ataque. Uso restrito a alvos autorizados pelo próprio operador.
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

const UA = 'seginfo-study-scanner/1.0 (teste autorizado)';
const TIMEOUT = 10_000;
const DIA_MS = 86_400_000;

const METODOS_ARRISCADOS = ['PUT', 'DELETE', 'TRACE', 'CONNECT', 'PATCH'];

/** Caminhos de exposição comum — sondagem GET, não destrutiva. */
const CAMINHOS_EXPOSICAO: { caminho: string; sensivel: boolean; sinal?: RegExp }[] = [
  { caminho: '/.git/HEAD', sensivel: true, sinal: /ref:\s*refs\// },
  { caminho: '/.env', sensivel: true, sinal: /=[^\n]/ },
  { caminho: '/actuator/health', sensivel: true, sinal: /"status"/i },
  { caminho: '/server-status', sensivel: true, sinal: /Apache Server Status/i },
  { caminho: '/swagger.json', sensivel: true, sinal: /"swagger"|"openapi"/i },
  { caminho: '/openapi.json', sensivel: true, sinal: /"openapi"/i },
  { caminho: '/.well-known/security.txt', sensivel: false },
  { caminho: '/robots.txt', sensivel: false },
];

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

/** Monta os achados a partir dos dados já coletados. Pura: sem rede. */
export function montarAchados(d: {
  status: number | null;
  tls: InfoTlsScan | null;
  usaHttps: boolean;
  cabecalhos: { id: string; nome: string; presente: boolean }[];
  metodos: { arriscados: string[] } | null;
  cookies: { nome: string; secure: boolean; httpOnly: boolean }[];
  exposicoes: Exposicao[];
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

  // Cookies
  for (const ck of d.cookies) {
    const faltas: string[] = [];
    if (!ck.secure) faltas.push('Secure');
    if (!ck.httpOnly) faltas.push('HttpOnly');
    if (faltas.length) a.push({ id: `cookie-${ck.nome}`, severidade: 'media', titulo: `Cookie "${ck.nome}" sem ${faltas.join(' e ')}`, detalhe: 'Cookie pode vazar por canal inseguro ou ser lido por script.', recomendacao: 'Marcar Secure, HttpOnly e SameSite.' });
  }

  // Exposições
  for (const e of d.exposicoes) {
    if (e.acessivel && e.sensivel) a.push({ id: `exp-${e.caminho}`, severidade: 'alta', titulo: `Exposição acessível: ${e.caminho}`, detalhe: `Respondeu ${e.status} com conteúdo compatível.`, recomendacao: 'Bloquear o acesso público a esse caminho.' });
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

async function seguirRedirects(url: string): Promise<{ status: number; urlFinal: string; headers: Headers; redirects: { status: number; para: string }[] }> {
  let atual = url;
  const redirects: { status: number; para: string }[] = [];
  for (let i = 0; i <= 5; i++) {
    const r = await fetch(atual, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) });
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc && i < 5) {
      const prox = new URL(loc, atual).toString();
      redirects.push({ status: r.status, para: prox });
      atual = prox;
      continue;
    }
    return { status: r.status, urlFinal: atual, headers: r.headers, redirects };
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

async function obterMetodos(url: string): Promise<{ permitidos: string[]; arriscados: string[] } | null> {
  try {
    const r = await fetch(url, { method: 'OPTIONS', redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) });
    const allow = r.headers.get('allow') ?? r.headers.get('access-control-allow-methods');
    if (!allow) return null;
    return classificarMetodos(allow);
  } catch {
    return null;
  }
}

const CAB_DICA: Record<string, string> = {
  'Strict-Transport-Security': 'força HTTPS no navegador',
  'Content-Security-Policy': 'limita de onde vêm scripts e conteúdos',
  'X-Frame-Options': 'impede a página dentro de iframe (clickjacking)',
  'X-Content-Type-Options': 'nosniff evita interpretar arquivo com o tipo errado',
  'Referrer-Policy': 'controla o que vaza no Referer',
  'Permissions-Policy': 'desliga câmera, microfone etc. não usados',
};

export async function escanear(urlBruta: string, opts: { exposicoes: boolean }): Promise<ScanRelatorio> {
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
    redirects: [], tls: null, cabecalhos: [], metodos: null, cookies: [], exposicoes: [],
    autenticacao: 'incerta', achados: [], em,
  };

  // requisição principal
  let headers: Headers | null = null;
  try {
    const t0 = Date.now();
    const res = await seguirRedirects(u.toString());
    base.tempoMs = Date.now() - t0;
    base.alcancavel = true;
    base.status = res.status;
    base.urlFinal = res.urlFinal;
    base.redirects = res.redirects;
    headers = res.headers;
    base.servidor = headers.get('server');
    base.poweredBy = headers.get('x-powered-by');
    base.autenticacao = res.status === 401 || res.status === 403 ? 'exigida' : res.status >= 200 && res.status < 300 ? 'aberta' : 'incerta';
    const setCookies = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
    base.cookies = setCookies.map(parseCookie);
  } catch (e) {
    base.erro = e instanceof Error ? e.message : 'falha ao conectar';
    return base;
  }

  // cabeçalhos de segurança (reusa a avaliação da área de exposição)
  const mapaHeaders = Object.fromEntries(headers.entries());
  const av = avaliarCabecalhos(mapaHeaders);
  base.cabecalhos = av.map((c) => ({ nome: c.nome, presente: c.presente, valor: c.valor, dica: CAB_DICA[c.nome] ?? c.dica ?? '' }));

  // TLS, métodos e exposições em paralelo
  const [tlsInfo, metodos, exposicoes] = await Promise.all([
    usaHttps ? lerTls(u.hostname, port) : Promise.resolve(null),
    obterMetodos(u.toString()),
    opts.exposicoes ? Promise.all(CAMINHOS_EXPOSICAO.map((c) => sondarExposicao(u, c))) : Promise.resolve([] as Exposicao[]),
  ]);
  base.tls = tlsInfo;
  base.metodos = metodos;
  base.exposicoes = exposicoes;

  base.achados = montarAchados({
    status: base.status,
    tls: base.tls,
    usaHttps,
    cabecalhos: av.map((c) => ({ id: c.id, nome: c.nome, presente: c.presente })),
    metodos: base.metodos,
    cookies: base.cookies,
    exposicoes: base.exposicoes,
    servidor: base.servidor,
    poweredBy: base.poweredBy,
  });

  return base;
}

// ---------- rota ----------

export function registerScanRoutes(app: FastifyInstance) {
  const Body = z.object({ url: z.string().url(), exposicoes: z.boolean().optional() });
  app.post('/api/scan', async (req, reply) => {
    const b = Body.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'Informe uma URL http/https válida.' });
    try {
      return await escanear(b.data.url, { exposicoes: b.data.exposicoes ?? true });
    } catch (e) {
      return reply.status(400).send({ error: e instanceof Error ? e.message : 'falha no scan' });
    }
  });
}
