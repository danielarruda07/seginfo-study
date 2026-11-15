import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import { createHash, timingSafeEqual } from 'node:crypto';
import { IngestBatchSchema } from '@seginfo/shared';
import { prisma, resolveUsuario } from './db.js';
import { verifyAccessJwt } from './auth.js';
import { guardarSenhas } from './radar.js';
import { escopoDoIp } from './radarEscopo.js';
import { gravarPericia } from './pericia.js';
import { preservarEventos } from './artefatosCaptura.js';
import { AmostraSchema, guardarAmostra } from './artefatos.js';

/**
 * Ingestão de eventos de ataque, vinda de COLETORES (sensor honeypot, script Windows).
 *
 * Três camadas, todas obrigatórias em produção:
 *  1. Cloudflare Access (Service Auth): só um Service Token válido passa pela borda.
 *  2. A API revalida o JWT do Access (assinatura, emissor, AUD da app `estudo-ingest`)
 *     e confere que o `common_name` é o Client ID esperado. Não confia na borda cegamente.
 *  3. Token próprio no header `X-Ingest-Token`, comparado em tempo constante.
 *
 * Fail-closed: sem a configuração completa a rota responde 503.
 * Em desenvolvimento a camada 1 e 2 são dispensadas (não há Access); o token continua valendo.
 */

const sha256 = (s: string) => createHash('sha256').update(s).digest();

/** Só estas fontes podem trazer senha tentada (e só com RADAR_GUARDAR_SENHAS=true). */
const FONTES_COM_SENHA = new Set(['cowrie', 'opencanary', 'dionaea', 'heralding', 'isca']);

function tokenValido(recebido: string | undefined): boolean {
  const esperado = process.env.INGEST_TOKEN;
  if (!esperado || !recebido) return false;
  // hash dos dois lados: tamanhos iguais, sem vazar o comprimento do token
  return timingSafeEqual(sha256(recebido), sha256(esperado));
}

const header = (req: FastifyRequest, nome: string): string | undefined => {
  const v = req.headers[nome];
  return Array.isArray(v) ? v[0] : v;
};

/** Valida o coletor. Retorna false se já respondeu com erro. */
async function autenticarColetor(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!process.env.INGEST_TOKEN || !process.env.INGEST_OWNER_EMAIL) {
    req.log.error('INGEST_TOKEN/INGEST_OWNER_EMAIL não configurados; recusando (fail-closed).');
    reply.status(503).send({ error: 'Ingestão não configurada.' });
    return false;
  }

  if (process.env.NODE_ENV === 'production') {
    const aud = process.env.CF_ACCESS_INGEST_AUD;
    const clientId = process.env.CF_ACCESS_INGEST_CLIENT_ID;
    if (!aud || !clientId || !process.env.CF_ACCESS_TEAM) {
      req.log.error('CF_ACCESS_TEAM/CF_ACCESS_INGEST_AUD/CF_ACCESS_INGEST_CLIENT_ID ausentes; recusando.');
      reply.status(503).send({ error: 'Ingestão não configurada.' });
      return false;
    }
    const jwt = header(req, 'cf-access-jwt-assertion');
    if (!jwt) {
      req.log.warn({ ip: req.ip }, 'ingest: sem JWT do Access');
      reply.status(401).send({ error: 'Não autenticado.' });
      return false;
    }
    try {
      const payload = await verifyAccessJwt(jwt, aud);
      if (payload.common_name !== clientId) {
        req.log.warn({ ip: req.ip }, 'ingest: Service Token inesperado');
        reply.status(401).send({ error: 'Não autenticado.' });
        return false;
      }
    } catch (e) {
      req.log.warn({ ip: req.ip, err: (e as Error).message }, 'ingest: JWT do Access inválido');
      reply.status(401).send({ error: 'Não autenticado.' });
      return false;
    }
  }

  if (!tokenValido(header(req, 'x-ingest-token'))) {
    req.log.warn({ ip: req.ip }, 'ingest: token inválido');
    reply.status(401).send({ error: 'Não autenticado.' });
    return false;
  }
  return true;
}

export async function registerIngestRoutes(app: FastifyInstance) {
  app.post('/api/ingest/amostra', { bodyLimit: 12 * 1_048_576 }, async (req, reply) => {
    if (!(await autenticarColetor(req, reply))) return reply;
    const b = AmostraSchema.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'Amostra inválida.' });
    const usuario = await resolveUsuario(process.env.INGEST_OWNER_EMAIL as string);
    try {
      const r = await guardarAmostra(usuario.id, b.data.sha256, b.data.base64);
      return r.count ? { ok: true } : reply.code(404).send({ error: 'Envie o laudo antes da amostra.' });
    } catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'Amostra recusada.' }); }
  });
  app.post('/api/ingest', { bodyLimit: 1_048_576 }, async (req, reply) => {
    if (!(await autenticarColetor(req, reply))) return reply;

    const parsed = IngestBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Payload inválido.' });
    }

    const owner = process.env.INGEST_OWNER_EMAIL as string;
    const usuario = await resolveUsuario(owner);
    const comSenha = guardarSenhas();

    const data = parsed.data.eventos.map((e) => {
      // chave de deduplicação: reenvio do mesmo evento não duplica (a senha NÃO entra na chave)
      const dedupKey = createHash('sha256')
        .update(
          [e.fonte, e.ocorridoEm, e.ipOrigem ?? '', e.portaDestino ?? '', e.acao, e.usuarioTentado ?? '',
            e.alvo ?? '', JSON.stringify(e.detalhes ?? {})].join('|'),
        )
        .digest('hex');
      return {
        usuarioId: usuario.id,
        fonte: e.fonte,
        ocorridoEm: new Date(e.ocorridoEm),
        ipOrigem: e.ipOrigem,
        paisOrigem: e.paisOrigem?.toUpperCase(),
        portaDestino: e.portaDestino,
        protocolo: e.protocolo,
        servico: e.servico,
        acao: e.acao,
        usuarioTentado: e.usuarioTentado,
        senhaTentada: comSenha && FONTES_COM_SENHA.has(e.fonte) ? e.senhaTentada : undefined,
        alvo: e.alvo,
        detalhes: (e.detalhes ?? {}) as Prisma.InputJsonObject,
        dedupKey,
        escopo: escopoDoIp(e.ipOrigem),
      };
    });

    const r = await prisma.ataqueEvento.createMany({ data, skipDuplicates: true });
    await preservarEventos(data);
    return { ok: true, recebidos: data.length, inseridos: r.count };
  });

  // Laudo de um alvo real do honeypot (gerado na VM do Wazuh antes do reset). Mesma autenticação.
  app.post('/api/ingest/pericia', { bodyLimit: 2_097_152 }, async (req, reply) => {
    if (!(await autenticarColetor(req, reply))) return reply;
    const r = await gravarPericia(process.env.INGEST_OWNER_EMAIL as string, req.body);
    if (!r.ok) return reply.status(400).send({ error: 'Laudo inválido.' });
    return { ok: true, id: r.id };
  });
}
