import type { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { resolveUsuario } from './db.js';

/**
 * Autenticação via Cloudflare Access, com VERIFICAÇÃO da assinatura.
 *
 * O Access injeta o header `Cf-Access-Jwt-Assertion` (JWT assinado, RS256).
 * NÃO confiamos no header de e-mail em texto puro: a API vive na rede `coolify`,
 * compartilhada com outros containers, e qualquer um deles poderia forjá-lo.
 * Só um JWT com assinatura válida (chaves públicas do Cloudflare), emissor e
 * audiência (AUD) corretos é aceito.
 *
 * Produção: exige CF_ACCESS_TEAM e CF_ACCESS_AUD. Sem eles, recusa tudo (fail-closed).
 * Dev: sem Access; usa DEV_USER_EMAIL para destravar localmente.
 */
export interface AuthedRequest extends FastifyRequest {
  usuarioId: string;
  email: string;
}

const isProd = () => process.env.NODE_ENV === 'production';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(team: string) {
  jwks ??= createRemoteJWKSet(new URL(`https://${team}.cloudflareaccess.com/cdn-cgi/access/certs`));
  return jwks;
}

/**
 * Verifica um JWT do Cloudflare Access contra uma audiência (AUD) específica.
 * Usado pela ingestão de coletores (Service Token), que tem uma aplicação Access própria.
 * Lança se a assinatura, o emissor ou a audiência não conferirem.
 */
export async function verifyAccessJwt(token: string, audience: string) {
  const team = process.env.CF_ACCESS_TEAM;
  if (!team) throw new Error('CF_ACCESS_TEAM não configurado');
  const { payload } = await jwtVerify(token, getJwks(team), {
    issuer: `https://${team}.cloudflareaccess.com`,
    audience,
    algorithms: ['RS256'],
  });
  return payload;
}

/**
 * Valida a identidade e devolve o e-mail verificado, ou null (já respondeu 401/503).
 * Não toca no banco: serve também para proteger rotas sem estado (ex: /api/extract).
 */
export async function requireIdentity(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  if (!isProd()) {
    const dev = process.env.DEV_USER_EMAIL;
    if (dev) return dev;
    reply.status(401).send({ error: 'Não autenticado. Defina DEV_USER_EMAIL no ambiente de desenvolvimento.' });
    return null;
  }

  const team = process.env.CF_ACCESS_TEAM;
  const aud = process.env.CF_ACCESS_AUD;
  if (!team || !aud) {
    req.log.error('CF_ACCESS_TEAM/CF_ACCESS_AUD não configurados; recusando (fail-closed).');
    reply.status(503).send({ error: 'Autenticação não configurada no servidor.' });
    return null;
  }

  const raw = req.headers['cf-access-jwt-assertion'];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token) {
    reply.status(401).send({ error: 'Não autenticado (Cloudflare Access ausente).' });
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(team), {
      issuer: `https://${team}.cloudflareaccess.com`,
      audience: aud,
      algorithms: ['RS256'],
    });
    const email = typeof payload.email === 'string' ? payload.email : null;
    if (!email) {
      reply.status(401).send({ error: 'Token sem e-mail.' });
      return null;
    }
    return email;
  } catch (e) {
    req.log.warn({ err: (e as Error).message }, 'JWT do Cloudflare Access inválido');
    reply.status(401).send({ error: 'Token inválido.' });
    return null;
  }
}

/** Identidade verificada + usuário no banco. Retorna false se já respondeu com erro. */
export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const email = await requireIdentity(req, reply);
  if (!email) return false;

  const usuario = await resolveUsuario(email);
  (req as AuthedRequest).usuarioId = usuario.id;
  (req as AuthedRequest).email = usuario.email;
  return true;
}
