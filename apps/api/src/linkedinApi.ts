import { randomBytes } from 'node:crypto';
import type { StatusContaLinkedin } from '@seginfo/shared';
import { prisma } from './db.js';
import { cifrarSegredo, decifrarSegredo } from './storage-crypto.js';

/**
 * Cliente da API oficial do LinkedIn para publicar no PERFIL do dono do app.
 *
 * - Produtos do app (self-serve): "Share on LinkedIn" (escopo w_member_social) e
 *   "Sign In with LinkedIn using OpenID Connect" (openid profile, para saber quem é o autor).
 * - O token de acesso dura cerca de 60 dias e fica cifrado no banco (STORAGE_TOKEN_KEY).
 *   Refresh token só existe para apps parceiros; sem ele, é preciso reconectar ao expirar.
 * - Não existe agendamento na API: quem agenda é o servidor (linkedinAgendador.ts).
 * - Só a API oficial. Nada de automação de navegador: isso põe a conta em risco.
 */

const AUTH = 'https://www.linkedin.com/oauth/v2';
const API = 'https://api.linkedin.com';
const ESCOPOS = 'openid profile w_member_social';

export const publicBase = () => process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
export const redirectUri = () => `${publicBase()}/api/linkedin/conta/callback`;

/** Nomes (não valores) das variáveis que faltam para conectar o LinkedIn. */
export function variaveisFaltando(): string[] {
  return ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'PUBLIC_BASE_URL', 'STORAGE_TOKEN_KEY'].filter((k) => !process.env[k]);
}

/** Versão da API conferida na documentação em 2026-11 (monikers li-lms-2025-11 a 2026-10). */
const VERSAO_CONHECIDA = '202610';

/**
 * Versão da API (cabeçalho LinkedIn-Version, AAAAMM). Cada versão vive cerca de 12 meses e
 * NÃO sai uma por mês (não houve 2025-12), então o padrão é uma versão conhecida. Quando ela
 * passa de 9 meses, usa-se a de dois meses atrás (dezembro vira novembro) para não parar de
 * funcionar sozinha. LINKEDIN_API_VERSION fixa um valor quando for preciso.
 */
export function versaoApi(agora = new Date()): string {
  const fixa = process.env.LINKEDIN_API_VERSION;
  if (fixa && /^\d{6}$/.test(fixa)) return fixa;
  const idadeMeses = (agora.getUTCFullYear() - Number(VERSAO_CONHECIDA.slice(0, 4))) * 12
    + (agora.getUTCMonth() + 1 - Number(VERSAO_CONHECIDA.slice(4)));
  if (idadeMeses <= 9) return VERSAO_CONHECIDA;
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - 2, 1));
  const mes = d.getUTCMonth() + 1 === 12 ? 11 : d.getUTCMonth() + 1;
  return `${d.getUTCFullYear()}${String(mes).padStart(2, '0')}`;
}

export class ErroLinkedin extends Error {
  constructor(public status: number, mensagem: string, public transitorio = false) {
    super(mensagem);
  }
}

// ---------- autorização (OAuth 2.0, 3 pernas) ----------
interface Pendente { usuarioId: string; expira: number }
const pendentes = new Map<string, Pendente>(); // state de uso único, 10 min

export function iniciarAutorizacao(usuarioId: string): string {
  const agora = Date.now();
  for (const [k, v] of pendentes) if (v.expira < agora) pendentes.delete(k);
  const state = randomBytes(24).toString('base64url');
  pendentes.set(state, { usuarioId, expira: agora + 10 * 60_000 });
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID as string,
    redirect_uri: redirectUri(),
    state,
    scope: ESCOPOS,
  });
  return `${AUTH}/authorization?${p.toString()}`;
}

interface TokenResp { access_token: string; expires_in: number; scope?: string; refresh_token?: string }

async function pedirToken(corpo: Record<string, string>): Promise<TokenResp> {
  const res = await fetch(`${AUTH}/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.LINKEDIN_CLIENT_ID as string,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET as string,
      ...corpo,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string } & Partial<TokenResp>;
  if (!res.ok || !json.access_token) {
    throw new ErroLinkedin(502, `O LinkedIn recusou a autorização (${json.error ?? res.status}).`);
  }
  return json as TokenResp;
}

/** Troca o `code` pelo token, descobre o autor e guarda a conta (token cifrado). */
export async function concluirAutorizacao(code: string, state: string, usuarioId: string): Promise<void> {
  const p = pendentes.get(state);
  pendentes.delete(state);
  if (!p || p.expira < Date.now() || p.usuarioId !== usuarioId) {
    throw new ErroLinkedin(400, 'Estado de autorização inválido ou expirado. Tente conectar de novo.');
  }
  const t = await pedirToken({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  const res = await fetch(`${API}/v2/userinfo`, { headers: { Authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(30_000) });
  const eu = (await res.json().catch(() => ({}))) as { sub?: string; name?: string };
  if (!res.ok || !eu.sub) throw new ErroLinkedin(502, 'Não consegui ler o perfil no LinkedIn (o produto "Sign In with LinkedIn using OpenID Connect" está no app?).');
  const dados = {
    personUrn: `urn:li:person:${eu.sub}`,
    nome: (eu.name ?? '').slice(0, 200),
    accessTokenCifrado: cifrarSegredo(t.access_token),
    refreshTokenCifrado: t.refresh_token ? cifrarSegredo(t.refresh_token) : null,
    expiraEm: new Date(Date.now() + t.expires_in * 1000),
    escopos: t.scope ?? ESCOPOS,
    ultimoErro: null,
    conectadoEm: new Date(),
  };
  await prisma.linkedinConta.upsert({ where: { usuarioId }, update: dados, create: { usuarioId, ...dados } });
}

/** Token válido para chamar a API; renova com o refresh token quando o app tiver um. */
async function tokenDe(usuarioId: string): Promise<{ token: string; personUrn: string }> {
  const conta = await prisma.linkedinConta.findUnique({ where: { usuarioId } });
  if (!conta) throw new ErroLinkedin(409, 'LinkedIn não conectado. Conecte em Marca pessoal & IA.');
  if (conta.expiraEm.getTime() > Date.now() + 60_000) {
    return { token: decifrarSegredo(conta.accessTokenCifrado), personUrn: conta.personUrn };
  }
  if (conta.refreshTokenCifrado) {
    try {
      const t = await pedirToken({ grant_type: 'refresh_token', refresh_token: decifrarSegredo(conta.refreshTokenCifrado) });
      await prisma.linkedinConta.update({
        where: { usuarioId },
        data: {
          accessTokenCifrado: cifrarSegredo(t.access_token),
          ...(t.refresh_token ? { refreshTokenCifrado: cifrarSegredo(t.refresh_token) } : {}),
          expiraEm: new Date(Date.now() + t.expires_in * 1000), ultimoErro: null,
        },
      });
      return { token: t.access_token, personUrn: conta.personUrn };
    } catch { /* cai no erro de expiração abaixo */ }
  }
  const msg = 'A autorização do LinkedIn expirou (dura cerca de 60 dias). Reconecte em Marca pessoal & IA.';
  await prisma.linkedinConta.update({ where: { usuarioId }, data: { ultimoErro: msg } });
  throw new ErroLinkedin(401, msg);
}

export async function statusDaConta(usuarioId: string): Promise<StatusContaLinkedin> {
  const faltando = variaveisFaltando();
  const conta = await prisma.linkedinConta.findUnique({
    where: { usuarioId }, select: { nome: true, expiraEm: true, ultimoErro: true },
  });
  return {
    configurado: faltando.length === 0,
    faltando,
    conectado: conta !== null,
    nome: conta?.nome || null,
    expiraEm: conta?.expiraEm.toISOString() ?? null,
    diasRestantes: conta ? Math.floor((conta.expiraEm.getTime() - Date.now()) / 86_400_000) : null,
    ultimoErro: conta?.ultimoErro ?? null,
  };
}

/** A conta consegue publicar agora? (conectada e com token dentro da validade) */
export async function contaPronta(usuarioId: string): Promise<boolean> {
  const c = await prisma.linkedinConta.findUnique({ where: { usuarioId }, select: { expiraEm: true, refreshTokenCifrado: true } });
  return !!c && (c.expiraEm.getTime() > Date.now() + 60_000 || !!c.refreshTokenCifrado);
}

// ---------- texto do post ("little text format") ----------

/**
 * O campo `commentary` da API usa um formato próprio: os caracteres | { } @ [ ] ( ) < > # \ * _ ~
 * são reservados e, sem escape, cortam ou deformam o texto. Hashtags viram o modelo
 * {hashtag|\#|tag}; todo o resto é escapado com barra invertida.
 */
export function paraLittleText(texto: string): string {
  const escapar = (s: string) => s.replace(/[\\|{}@[\]()<>#*_~]/g, '\\$&');
  const hashtag = /(^|[\s(])#([\p{L}\p{N}_]+)/gu;
  let saida = '';
  let pos = 0;
  for (const m of texto.matchAll(hashtag)) {
    const inicio = m.index ?? 0;
    saida += escapar(texto.slice(pos, inicio)) + escapar(m[1]) + `{hashtag|\\#|${m[2]}}`;
    pos = inicio + m[0].length;
  }
  return saida + escapar(texto.slice(pos));
}

// ---------- publicação ----------

export interface Publicado { urn: string; url: string }

/**
 * Publica um post de TEXTO no perfil. Mídia (imagem, documento, vídeo) exige upload em etapas
 * e ainda não é feita por aqui: esses formatos seguem pelo canal "lembrete".
 */
export async function publicarTexto(usuarioId: string, texto: string): Promise<Publicado> {
  const { token, personUrn } = await tokenDe(usuarioId);
  let res: Response;
  try {
    res = await fetch(`${API}/rest/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': versaoApi(),
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: personUrn,
        commentary: paraLittleText(texto),
        visibility: 'PUBLIC',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    // sem resposta: pode ter publicado ou não. Não é seguro repetir sozinho.
    throw new ErroLinkedin(504, 'O LinkedIn não respondeu. Confira no seu perfil se o post saiu antes de tentar de novo.');
  }
  if (res.status === 201) {
    const urn = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id') ?? '';
    if (!urn) throw new ErroLinkedin(502, 'O LinkedIn aceitou o post, mas não devolveu o identificador. Confira no seu perfil e registre o link à mão.');
    return { urn, url: `https://www.linkedin.com/feed/update/${urn}/` };
  }
  const corpo = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
  const detalhe = (corpo.message ?? corpo.code ?? '').slice(0, 200);
  if (res.status === 401) {
    const msg = 'O LinkedIn recusou o token (expirado ou revogado). Reconecte em Marca pessoal & IA.';
    await prisma.linkedinConta.updateMany({ where: { usuarioId }, data: { ultimoErro: msg } });
    throw new ErroLinkedin(401, msg);
  }
  if (res.status === 429) throw new ErroLinkedin(429, 'Limite de publicações da API do LinkedIn atingido. Tente mais tarde.', true);
  if (res.status === 422 && /duplicate/i.test(detalhe)) throw new ErroLinkedin(409, 'O LinkedIn recusou por ser conteúdo duplicado: este texto já foi publicado.');
  // 5xx: o LinkedIn respondeu com erro, então o post NÃO foi criado; pode tentar de novo
  throw new ErroLinkedin(502, `O LinkedIn recusou a publicação (${res.status}${detalhe ? `: ${detalhe}` : ''}).`, res.status >= 500);
}

export async function desconectar(usuarioId: string): Promise<void> {
  await prisma.linkedinConta.deleteMany({ where: { usuarioId } });
}
