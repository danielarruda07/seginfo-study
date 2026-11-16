import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PericiaInSchema } from '@seginfo/shared';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';
import { preservarEventos, preservarPericia } from './artefatosCaptura.js';
import { analisarArtefato, LIMITE_AMOSTRA, previaAmostra, validarAmostra } from './artefatosAnalise.js';

export const AmostraSchema = z.object({ sha256: z.string().regex(/^[a-f0-9]{64}$/), base64: z.string().max(Math.ceil(LIMITE_AMOSTRA / 3) * 4) });
export async function guardarAmostra(usuarioId: string, sha256: string, base64: string) {
  const previa = previaAmostra(validarAmostra(base64, sha256));
  return prisma.artefatoAtaque.updateMany({ where: { usuarioId, sha256, tipo: 'arquivo' },
    data: { amostraBase64: base64, conteudo: previa.texto, ...analisarArtefato(previa.texto, previa.modo === 'strings' ? 'elf' : 'texto') } });
}
const campos = { id: true, tipo: true, nome: true, sha256: true, formato: true, categoria: true, resumo: true,
  favorito: true, tags: true, criadoEm: true, _count: { select: { ocorrencias: true } } } as const;

export async function registerArtefatosRoutes(app: FastifyInstance) {
  const uid = (req: unknown) => (req as AuthedRequest).usuarioId;
  app.get('/api/artefatos', async (req, reply) => {
    const q = z.object({ q: z.string().trim().max(200).default(''), tipo: z.enum(['arquivo', 'comando', 'persistencia', 'processo']).optional(),
      categoria: z.string().max(50).optional(), alvo: z.string().max(128).optional(), favorito: z.enum(['true']).optional(),
      page: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(100).default(25),
      ordem: z.enum(['criadoEm', 'nome', 'tipo', 'categoria', 'favorito']).default('criadoEm'), direcao: z.enum(['asc', 'desc']).default('desc') }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'Filtros inválidos.' });
    const { page, limit, tipo, categoria, alvo, favorito, q: busca, ordem, direcao } = q.data;
    const where = { usuarioId: uid(req), ...(tipo ? { tipo } : {}), ...(categoria ? { categoria } : {}), ...(favorito ? { favorito: true } : {}),
      ...(alvo ? { ocorrencias: { some: { alvo: { contains: alvo, mode: 'insensitive' as const } } } } : {}),
      ...(busca ? { OR: ['nome', 'conteudo', 'sha256', 'resumo', 'notas'].map((campo) => ({ [campo]: { contains: busca, mode: 'insensitive' as const } })) } : {}) };
    const [total, items] = await Promise.all([prisma.artefatoAtaque.count({ where }), prisma.artefatoAtaque.findMany({ where,
      orderBy: [{ [ordem]: direcao }, { id: 'desc' }], skip: page * limit, take: limit, select: campos })]);
    return { total, items };
  });
  app.get('/api/artefatos/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await prisma.artefatoAtaque.findFirst({ where: { id, usuarioId: uid(req) }, select: { ...campos,
      conteudo: true, notas: true, atualizadoEm: true, ocorrencias: { orderBy: { quando: 'desc' }, take: 100 } } });
    if (!a) return reply.code(404).send({ error: 'Artefato não encontrado.' });
    const amostras = await prisma.artefatoAtaque.count({ where: { id, usuarioId: uid(req), amostraBase64: { not: null } } });
    return { ...a, temAmostra: amostras > 0 };
  });
  app.patch('/api/artefatos/:id', async (req, reply) => {
    const b = z.object({ notas: z.string().max(20000).optional(), tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(), favorito: z.boolean().optional() }).strict().safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'Anotações inválidas.' });
    const r = await prisma.artefatoAtaque.updateMany({ where: { id: (req.params as { id: string }).id, usuarioId: uid(req) }, data: b.data });
    return r.count ? { ok: true } : reply.code(404).send({ error: 'Artefato não encontrado.' });
  });
  app.get('/api/artefatos/:id/ocorrencias', async (req, reply) => {
    const q = z.object({ page: z.coerce.number().int().min(0).default(0) }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'Página inválida.' });
    return prisma.artefatoOcorrencia.findMany({ where: { artefatoId: (req.params as { id: string }).id, artefato: { usuarioId: uid(req) } },
      orderBy: [{ quando: 'desc' }, { id: 'desc' }], skip: q.data.page * 25, take: 25 });
  });
  app.put('/api/artefatos/:id/amostra', { bodyLimit: 12 * 1_048_576 }, async (req, reply) => {
    const b = AmostraSchema.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'Amostra inválida (limite de 8 MB).' });
    const a = await prisma.artefatoAtaque.findFirst({ where: { id: (req.params as { id: string }).id, usuarioId: uid(req), tipo: 'arquivo', sha256: b.data.sha256 }, select: { id: true } });
    if (!a) return reply.code(404).send({ error: 'Arquivo/hash não encontrado na biblioteca.' });
    try { await guardarAmostra(uid(req), b.data.sha256, b.data.base64); return { ok: true }; }
    catch (e) { return reply.code(400).send({ error: e instanceof Error ? e.message : 'Amostra recusada.' }); }
  });
  app.get('/api/artefatos/:id/amostra', async (req, reply) => {
    const a = await prisma.artefatoAtaque.findFirst({ where: { id: (req.params as { id: string }).id, usuarioId: uid(req) }, select: { sha256: true, amostraBase64: true } });
    if (!a?.amostraBase64 || !a.sha256) return reply.code(404).send({ error: 'Amostra ainda não recebida.' });
    return reply.header('Content-Disposition', `attachment; filename="${a.sha256}.bin"`).header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'no-store').type('application/octet-stream').send(Buffer.from(a.amostraBase64, 'base64'));
  });
  app.post('/api/artefatos/importar', async (req, reply) => {
    const b = z.object({ fonte: z.enum(['laudos', 'radar']), cursor: z.string().max(100).optional() }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'Importação inválida.' });
    const where = { usuarioId: uid(req) };
    const pagina = { ...(b.data.cursor ? { cursor: { id: b.data.cursor }, skip: 1 } : {}), orderBy: { id: 'asc' as const }, take: b.data.fonte === 'laudos' ? 5 : 100 };
    if (b.data.fonte === 'laudos') {
      const rows = await prisma.pericia.findMany({ where, ...pagina });
      for (const row of rows) { const d = PericiaInSchema.safeParse(row.dados); if (d.success) await preservarPericia(uid(req), row.id, d.data); }
      return { lidos: rows.length, cursor: rows.at(-1)?.id ?? null };
    }
    const rows = await prisma.ataqueEvento.findMany({ where: { ...where, acao: { in: ['comando', 'download'] } }, ...pagina });
    await preservarEventos(rows);
    return { lidos: rows.length, cursor: rows.at(-1)?.id ?? null };
  });
}
