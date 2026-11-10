import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from './db.js';
import { requireUser, type AuthedRequest } from './auth.js';
import { registerRadarRoutes } from './radar.js';
import { registerStorageRoutes } from './storage-routes.js';
import { registerMemoriaRoutes } from './memorias.js';

/** Registra todas as rotas de estado do usuário, todas protegidas por requireUser. */
export async function registerStateRoutes(app: FastifyInstance) {
  // Este plugin é encapsulado: o hook vale só para as rotas de estado registradas aqui
  // (/health e /api/extract ficam fora e têm tratamento próprio em server.ts).
  app.addHook('preHandler', async (req, reply) => {
    const ok = await requireUser(req, reply);
    if (!ok) return reply; // resposta de erro já enviada; interrompe a cadeia
  });

  const uid = (req: unknown) => (req as AuthedRequest).usuarioId;

  // ---------- Progresso ----------
  app.get('/api/progresso', async (req) => prisma.progresso.findMany({ where: { usuarioId: uid(req) } }));

  const ProgressoBody = z.object({
    topicoId: z.string(),
    status: z.enum(['a_estudar', 'estudando', 'concluido']).optional(),
    anotacoes: z.string().optional(),
  });
  app.put('/api/progresso', async (req, reply) => {
    const b = ProgressoBody.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const { topicoId, ...rest } = b.data;
    return prisma.progresso.upsert({
      where: { usuarioId_topicoId: { usuarioId: uid(req), topicoId } },
      update: rest,
      create: { usuarioId: uid(req), topicoId, status: rest.status ?? 'a_estudar', anotacoes: rest.anotacoes ?? '' },
    });
  });

  // ---------- Sessões ----------
  app.get('/api/sessoes', async (req) => prisma.sessao.findMany({ where: { usuarioId: uid(req) }, orderBy: { data: 'desc' } }));
  app.post('/api/sessoes', async (req, reply) => {
    const b = z.object({ data: z.string(), minutos: z.number().int().positive(), trilhaId: z.string().optional(), topicoId: z.string().optional(), nota: z.string().optional() }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    return prisma.sessao.create({ data: { ...b.data, nota: b.data.nota ?? '', usuarioId: uid(req) } });
  });
  app.delete('/api/sessoes/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.sessao.deleteMany({ where: { id, usuarioId: uid(req) } });
    return { ok: true };
  });

  // ---------- Metas ----------
  app.get('/api/metas', async (req) => prisma.meta.findMany({ where: { usuarioId: uid(req) }, orderBy: { prazo: 'asc' } }));
  app.post('/api/metas', async (req, reply) => {
    const b = z.object({ titulo: z.string(), prazo: z.string(), trilhaId: z.string().optional(), concluida: z.boolean().optional() }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    return prisma.meta.create({ data: { ...b.data, concluida: b.data.concluida ?? false, usuarioId: uid(req) } });
  });
  app.patch('/api/metas/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = z.object({ concluida: z.boolean().optional(), titulo: z.string().optional(), prazo: z.string().optional() }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    await prisma.meta.updateMany({ where: { id, usuarioId: uid(req) }, data: b.data });
    return { ok: true };
  });
  app.delete('/api/metas/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.meta.deleteMany({ where: { id, usuarioId: uid(req) } });
    return { ok: true };
  });

  // ---------- Posts ----------
  app.get('/api/posts', async (req) => prisma.post.findMany({ where: { usuarioId: uid(req) }, orderBy: { criadoEm: 'desc' } }));
  app.post('/api/posts', async (req, reply) => {
    const b = z.object({ titulo: z.string(), gancho: z.string().optional(), corpo: z.string().optional(), topicoId: z.string().optional(), publicado: z.boolean().optional() }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    return prisma.post.create({ data: { titulo: b.data.titulo, gancho: b.data.gancho ?? '', corpo: b.data.corpo ?? '', topicoId: b.data.topicoId, publicado: b.data.publicado ?? false, usuarioId: uid(req) } });
  });
  app.patch('/api/posts/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.post.updateMany({ where: { id, usuarioId: uid(req) }, data: req.body as Record<string, unknown> });
    return { ok: true };
  });
  app.delete('/api/posts/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.post.deleteMany({ where: { id, usuarioId: uid(req) } });
    return { ok: true };
  });

  // ---------- Arsenal ----------
  app.get('/api/arsenal', async (req) => prisma.arsenalItem.findMany({ where: { usuarioId: uid(req) }, orderBy: [{ favorito: 'desc' }, { atualizadoEm: 'desc' }] }));
  const ArsenalBody = z.object({
    id: z.string().optional(),
    tipo: z.enum(['prompt', 'skill', 'agente']),
    nome: z.string(),
    slug: z.string().optional(),
    dominio: z.string().optional(),
    resumo: z.string().optional(),
    conteudo: z.string().optional(),
    quandoUsar: z.string().optional(),
    requisitos: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    artefatos: z.any().optional(),
    favorito: z.boolean().optional(),
  });
  app.post('/api/arsenal', async (req, reply) => {
    const b = ArsenalBody.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const { id, ...rest } = b.data;
    const data = {
      tipo: rest.tipo, nome: rest.nome, slug: rest.slug ?? '', dominio: rest.dominio ?? 'geral',
      resumo: rest.resumo ?? '', conteudo: rest.conteudo ?? '', quandoUsar: rest.quandoUsar ?? '',
      requisitos: rest.requisitos ?? [], tags: rest.tags ?? [], artefatos: rest.artefatos ?? [], favorito: rest.favorito ?? false,
    };
    if (id) {
      await prisma.arsenalItem.updateMany({ where: { id, usuarioId: uid(req) }, data });
      return { id };
    }
    return prisma.arsenalItem.create({ data: { ...data, usuarioId: uid(req) } });
  });
  app.delete('/api/arsenal/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.arsenalItem.deleteMany({ where: { id, usuarioId: uid(req) } });
    return { ok: true };
  });

  // ---------- Biblioteca ----------
  app.get('/api/biblioteca', async (req) => prisma.biblioItem.findMany({ where: { usuarioId: uid(req) }, orderBy: [{ favorito: 'desc' }, { criadoEm: 'desc' }] }));
  app.post('/api/biblioteca', async (req, reply) => {
    const b = z.object({
      id: z.string().optional(), url: z.string().url(), titulo: z.string().optional(), dominio: z.string().optional(),
      textoOriginal: z.string().optional(), resumo: z.string().optional(), palavrasChave: z.array(z.string()).optional(),
      categoria: z.string().optional(), tags: z.array(z.string()).optional(), estado: z.string().optional(),
      favorito: z.boolean().optional(), anotacoes: z.string().optional(), topicoId: z.string().optional(), fonteResumo: z.string().optional(),
    }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const { id, ...r } = b.data;
    const data = {
      url: r.url, titulo: r.titulo ?? '', dominio: r.dominio ?? '', textoOriginal: r.textoOriginal ?? '',
      resumo: r.resumo ?? '', palavrasChave: r.palavrasChave ?? [], categoria: r.categoria ?? 'geral',
      tags: r.tags ?? [], estado: r.estado ?? 'para_ler', favorito: r.favorito ?? false, anotacoes: r.anotacoes ?? '',
      topicoId: r.topicoId, fonteResumo: r.fonteResumo ?? 'local',
    };
    if (id) { await prisma.biblioItem.updateMany({ where: { id, usuarioId: uid(req) }, data }); return { id }; }
    return prisma.biblioItem.create({ data: { ...data, usuarioId: uid(req) } });
  });
  app.patch('/api/biblioteca/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.biblioItem.updateMany({ where: { id, usuarioId: uid(req) }, data: req.body as Record<string, unknown> });
    return { ok: true };
  });
  app.delete('/api/biblioteca/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.biblioItem.deleteMany({ where: { id, usuarioId: uid(req) } });
    return { ok: true };
  });

  // ---------- Cofre (blob cifrado) ----------
  app.get('/api/cofre', async (req) => {
    const blob = await prisma.cofreBlob.findUnique({ where: { usuarioId: uid(req) } });
    return blob ?? null;
  });
  app.put('/api/cofre', async (req, reply) => {
    const b = z.object({ versao: z.literal(1), salt: z.string(), iv: z.string(), ciphertext: z.string(), autoLockMin: z.number().int().optional() }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const data = { versao: b.data.versao, salt: b.data.salt, iv: b.data.iv, ciphertext: b.data.ciphertext, autoLockMin: b.data.autoLockMin ?? 5 };
    return prisma.cofreBlob.upsert({ where: { usuarioId: uid(req) }, update: data, create: { ...data, usuarioId: uid(req) } });
  });

  // ---------- Importação do navegador (localStorage -> servidor, uma vez) ----------
  app.post('/api/import', async (req, reply) => {
    const b = z.object({
      progresso: z.array(z.any()).optional(),
      sessoes: z.array(z.any()).optional(),
      metas: z.array(z.any()).optional(),
      posts: z.array(z.any()).optional(),
      arsenal: z.array(z.any()).optional(),
      biblioteca: z.array(z.any()).optional(),
      cofre: z.any().optional(),
    }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const u = uid(req);
    const d = b.data;
    const counts = { progresso: 0, sessoes: 0, metas: 0, posts: 0, arsenal: 0, biblioteca: 0, cofre: 0 };

    for (const p of d.progresso ?? []) {
      await prisma.progresso.upsert({
        where: { usuarioId_topicoId: { usuarioId: u, topicoId: p.topicoId } },
        update: { status: p.status ?? 'a_estudar', anotacoes: p.anotacoes ?? '' },
        create: { usuarioId: u, topicoId: p.topicoId, status: p.status ?? 'a_estudar', anotacoes: p.anotacoes ?? '' },
      });
      counts.progresso++;
    }
    for (const s of d.sessoes ?? []) { await prisma.sessao.create({ data: { usuarioId: u, data: s.data, minutos: s.minutos, trilhaId: s.trilhaId, topicoId: s.topicoId, nota: s.nota ?? '' } }); counts.sessoes++; }
    for (const m of d.metas ?? []) { await prisma.meta.create({ data: { usuarioId: u, titulo: m.titulo, prazo: m.prazo, trilhaId: m.trilhaId, concluida: !!m.concluida } }); counts.metas++; }
    for (const p of d.posts ?? []) { await prisma.post.create({ data: { usuarioId: u, titulo: p.titulo, gancho: p.gancho ?? '', corpo: p.corpo ?? '', publicado: !!p.publicado } }); counts.posts++; }
    for (const a of d.arsenal ?? []) { await prisma.arsenalItem.create({ data: { usuarioId: u, tipo: a.tipo, nome: a.nome, slug: a.slug ?? '', dominio: a.dominio ?? 'geral', resumo: a.resumo ?? '', conteudo: a.conteudo ?? '', quandoUsar: a.quandoUsar ?? '', requisitos: a.requisitos ?? [], tags: a.tags ?? [], artefatos: a.artefatos ?? [], favorito: !!a.favorito } }); counts.arsenal++; }
    for (const b2 of d.biblioteca ?? []) { await prisma.biblioItem.create({ data: { usuarioId: u, url: b2.url, titulo: b2.titulo ?? '', dominio: b2.dominio ?? '', textoOriginal: b2.textoOriginal ?? '', resumo: b2.resumo ?? '', palavrasChave: b2.palavrasChave ?? [], categoria: b2.categoria ?? 'geral', tags: b2.tags ?? [], estado: b2.estado ?? 'para_ler', favorito: !!b2.favorito, anotacoes: b2.anotacoes ?? '', fonteResumo: b2.fonteResumo ?? 'local' } }); counts.biblioteca++; }
    if (d.cofre && d.cofre.ciphertext) {
      await prisma.cofreBlob.upsert({
        where: { usuarioId: u },
        update: { versao: 1, salt: d.cofre.salt, iv: d.cofre.iv, ciphertext: d.cofre.ciphertext },
        create: { usuarioId: u, versao: 1, salt: d.cofre.salt, iv: d.cofre.iv, ciphertext: d.cofre.ciphertext },
      });
      counts.cofre = 1;
    }
    return { ok: true, imported: counts };
  });

  // ---------- Radar de Ataques (análise; herda o hook de identidade acima) ----------
  await registerRadarRoutes(app);

  // ---------- Armazenamento externo (OneDrive) e backups ----------
  await registerStorageRoutes(app);

  // ---------- Segundo Cérebro (memórias + busca) ----------
  await registerMemoriaRoutes(app);
}
