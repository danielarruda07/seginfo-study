import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './db.js';
import { cifrarSegredo, decifrarSegredo } from './storage-crypto.js';

/**
 * Cliente do OneDrive PESSOAL via Microsoft Graph.
 *
 * - OAuth2 authorization code + PKCE, cliente CONFIDENCIAL (o segredo fica só no servidor),
 *   tenant `consumers` (somente contas Microsoft pessoais).
 * - Escopo mínimo: Files.ReadWrite.AppFolder. O app só enxerga a própria pasta
 *   (/Apps/<nome do app>) e o resto do OneDrive fica inacessível.
 * - O refresh token é rotacionado a cada uso e guardado cifrado (STORAGE_TOKEN_KEY).
 */

const AUTH_BASE = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPE = 'Files.ReadWrite.AppFolder offline_access';
const PASTA_BACKUPS = 'backups';
const LIMITE_UPLOAD_SIMPLES = 240 * 1024 * 1024; // o limite da Graph é 250 MB (PUT simples)

type ErroComCodigo = Error & { code?: string };

export const publicBase = () => process.env.PUBLIC_BASE_URL?.replace(/\/$/, '');
export const redirectUri = () => `${publicBase()}/api/storage/onedrive/callback`;

/** Nomes (não valores) das variáveis que ainda faltam para o armazenamento funcionar. */
export function variaveisFaltando(): string[] {
  const obrigatorias = ['MS_CLIENT_ID', 'MS_CLIENT_SECRET', 'PUBLIC_BASE_URL', 'STORAGE_TOKEN_KEY', 'BACKUP_PUBLIC_KEY_B64'];
  return obrigatorias.filter((k) => !process.env[k]);
}

// ---------- autorização (PKCE) ----------
interface Pendente { verifier: string; usuarioId: string; expira: number }
const pendentes = new Map<string, Pendente>(); // state -> verifier; uso único, expira em 10 min

export function iniciarAutorizacao(usuarioId: string): string {
  const agora = Date.now();
  for (const [k, v] of pendentes) if (v.expira < agora) pendentes.delete(k);

  const state = randomBytes(24).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  pendentes.set(state, { verifier, usuarioId, expira: agora + 10 * 60_000 });

  const p = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID as string,
    response_type: 'code',
    redirect_uri: redirectUri(),
    response_mode: 'query',
    scope: SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${AUTH_BASE}/authorize?${p.toString()}`;
}

interface TokenResp { access_token: string; refresh_token?: string; expires_in: number }

async function tokenRequest(corpo: Record<string, string>): Promise<TokenResp> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID as string,
      client_secret: process.env.MS_CLIENT_SECRET as string,
      ...corpo,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string } & Partial<TokenResp>;
  if (!res.ok) {
    const err: ErroComCodigo = new Error(`Falha no token da Microsoft (${json.error ?? res.status}).`);
    err.code = json.error;
    throw err;
  }
  return json as TokenResp;
}

const cacheAccess = new Map<string, { token: string; expira: number }>();

/** Troca o code por tokens. O `state` é de uso único e precisa ser do mesmo usuário. */
export async function concluirAutorizacao(code: string, state: string, usuarioId: string) {
  const p = pendentes.get(state);
  pendentes.delete(state);
  if (!p || p.expira < Date.now() || p.usuarioId !== usuarioId) {
    throw new Error('Estado de autorização inválido ou expirado. Tente conectar de novo.');
  }
  const t = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: p.verifier,
    scope: SCOPE,
  });
  if (!t.refresh_token) throw new Error('A Microsoft não devolveu refresh token (escopo offline_access).');
  cacheAccess.set(usuarioId, { token: t.access_token, expira: Date.now() + t.expires_in * 1000 });
  return { refreshToken: t.refresh_token, accessToken: t.access_token };
}

/** Access token válido, renovando com o refresh token (e guardando o novo refresh token). */
export async function obterAccessToken(usuarioId: string): Promise<string> {
  const c = cacheAccess.get(usuarioId);
  if (c && c.expira > Date.now() + 60_000) return c.token;

  const conta = await prisma.armazenamentoConta.findUnique({ where: { usuarioId } });
  if (!conta) throw new Error('OneDrive não conectado.');

  let t: TokenResp;
  try {
    t = await tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: decifrarSegredo(conta.refreshTokenCifrado),
      scope: SCOPE,
    });
  } catch (e) {
    if ((e as ErroComCodigo).code === 'invalid_grant') {
      await prisma.armazenamentoConta.update({
        where: { usuarioId },
        data: { ultimoErro: 'Autorização expirada ou revogada. Reconecte o OneDrive.' },
      });
    }
    throw e;
  }
  if (t.refresh_token) {
    await prisma.armazenamentoConta.update({
      where: { usuarioId },
      data: { refreshTokenCifrado: cifrarSegredo(t.refresh_token) },
    });
  }
  cacheAccess.set(usuarioId, { token: t.access_token, expira: Date.now() + t.expires_in * 1000 });
  return t.access_token;
}

export function esquecerAccessToken(usuarioId: string) {
  cacheAccess.delete(usuarioId);
}

// ---------- Microsoft Graph ----------
async function graph(token: string, caminho: string, init: RequestInit = {}, timeoutMs = 30_000) {
  return fetch(`${GRAPH}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

/** Nome do dono do drive, só para exibir na tela. Falha silenciosa. */
export async function nomeDoDrive(token: string): Promise<string | null> {
  try {
    const res = await graph(token, '/me/drive?$select=owner');
    if (!res.ok) return null;
    const j = (await res.json()) as { owner?: { user?: { displayName?: string } } };
    return j.owner?.user?.displayName ?? null;
  } catch {
    return null;
  }
}

export async function enviarBackup(token: string, nome: string, dados: Buffer): Promise<{ id: string }> {
  if (dados.length > LIMITE_UPLOAD_SIMPLES) {
    throw new Error('Backup acima de 240 MB: upload em sessão ainda não implementado.');
  }
  const res = await graph(
    token,
    `/me/drive/special/approot:/${PASTA_BACKUPS}/${encodeURIComponent(nome)}:/content?@microsoft.graph.conflictBehavior=rename`,
    { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(dados) },
    5 * 60_000,
  );
  if (!res.ok) throw new Error(`Upload para o OneDrive falhou (HTTP ${res.status}).`);
  const j = (await res.json()) as { id: string };
  return { id: j.id };
}

export async function listarBackups(token: string): Promise<{ id: string; name: string }[]> {
  const res = await graph(token, `/me/drive/special/approot:/${PASTA_BACKUPS}:/children?$select=id,name&$top=200`);
  if (res.status === 404) return []; // pasta ainda não existe
  if (!res.ok) throw new Error(`Listagem no OneDrive falhou (HTTP ${res.status}).`);
  const j = (await res.json()) as { value: { id: string; name: string }[] };
  return j.value;
}

export async function apagarItem(token: string, id: string): Promise<void> {
  const res = await graph(token, `/me/drive/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`Exclusão no OneDrive falhou (HTTP ${res.status}).`);
}
