import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { InformeProjetoInSchema, MarcoProjetoInSchema } from '@seginfo/shared';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';

const uid = (req: unknown) => (req as AuthedRequest).usuarioId;
const ids = (req: unknown) => (req as { params: { projetoId: string; id?: string } }).params;
const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
function camposAlterados(antes: unknown, depois: unknown): string[] {
  const a = antes && typeof antes === 'object' && !Array.isArray(antes) ? antes as Record<string, unknown> : {};
  const d = depois && typeof depois === 'object' && !Array.isArray(depois) ? depois as Record<string, unknown> : {};
  return Object.keys(d).filter((k) => !['id', 'projetoId', 'usuarioId', 'criadoEm', 'atualizadoEm'].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(d[k]));
}

async function recalcular(tx: Prisma.TransactionClient, projetoId: string) {
  const recente = await tx.linkedinProjetoInforme.findFirst({
    where: { projetoId, excluidoEm: null }, orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }, { id: 'desc' }],
  });
  await tx.linkedinProjeto.update({ where: { id: projetoId }, data: { condicao: recente?.condicao ?? 'sem_avaliacao', avanco: recente?.avanco ?? 0 } });
}

export async function registerLinkedinProjetoAndamentoRoutes(app: FastifyInstance) {
  const projeto = (req: unknown) => prisma.linkedinProjeto.findFirst({ where: { id: ids(req).projetoId, usuarioId: uid(req) }, select: { id: true } });

  app.get('/api/linkedin/projetos/:projetoId/andamento', async (req, reply) => {
    const p = await projeto(req);
    if (!p) return reply.status(404).send({ error: 'Projeto não encontrado.' });
    const [marcos, informes, eventos] = await Promise.all([
      prisma.linkedinProjetoMarco.findMany({ where: { projetoId: p.id }, orderBy: [{ prazo: 'asc' }, { criadoEm: 'asc' }] }),
      prisma.linkedinProjetoInforme.findMany({ where: { projetoId: p.id, excluidoEm: null }, orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }] }),
      prisma.linkedinProjetoEvento.findMany({ where: { projetoId: p.id }, orderBy: { criadoEm: 'desc' }, take: 100 }),
    ]);
    const autorIds = [...new Set([...informes.map((i) => i.autorId), ...eventos.map((e) => e.autorId)])];
    const usuarios = await prisma.usuario.findMany({ where: { id: { in: autorIds } }, select: { id: true, email: true } });
    return { marcos, informes, eventos: eventos.map((e) => ({ ...e, campos: camposAlterados(e.antes, e.depois) })), autores: Object.fromEntries(usuarios.map((u) => [u.id, u.email])) };
  });

  app.post('/api/linkedin/projetos/:projetoId/marcos', async (req, reply) => {
    const p = await projeto(req);
    if (!p) return reply.status(404).send({ error: 'Projeto não encontrado.' });
    const b = MarcoProjetoInSchema.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'Marco inválido.' });
    return prisma.$transaction(async (tx) => {
      const m = await tx.linkedinProjetoMarco.create({ data: { ...b.data, projetoId: p.id, concluidoEm: b.data.situacao === 'concluido' ? new Date() : null } });
      await tx.linkedinProjetoEvento.create({ data: { projetoId: p.id, autorId: uid(req), entidade: 'marco', entidadeId: m.id, acao: 'criar', depois: json(m) } });
      return m;
    });
  });

  app.patch('/api/linkedin/projetos/:projetoId/marcos/:id', async (req, reply) => {
    const p = await projeto(req);
    if (!p) return reply.status(404).send({ error: 'Projeto não encontrado.' });
    const b = MarcoProjetoInSchema.partial().strict().safeParse(req.body);
    if (!b.success || !Object.keys(b.data).length) return reply.status(400).send({ error: 'Marco inválido.' });
    const atual = await prisma.linkedinProjetoMarco.findFirst({ where: { id: ids(req).id, projetoId: p.id } });
    if (!atual) return reply.status(404).send({ error: 'Marco não encontrado.' });
    return prisma.$transaction(async (tx) => {
      const m = await tx.linkedinProjetoMarco.update({ where: { id: atual.id }, data: {
        ...b.data, ...(b.data.situacao ? { concluidoEm: b.data.situacao === 'concluido' ? atual.concluidoEm ?? new Date() : null } : {}),
      } });
      await tx.linkedinProjetoEvento.create({ data: { projetoId: p.id, autorId: uid(req), entidade: 'marco', entidadeId: m.id, acao: 'editar', antes: json(atual), depois: json(m) } });
      return m;
    });
  });

  app.post('/api/linkedin/projetos/:projetoId/informes', async (req, reply) => {
    const p = await projeto(req);
    if (!p) return reply.status(404).send({ error: 'Projeto não encontrado.' });
    const b = InformeProjetoInSchema.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'Informe inválido.' });
    return prisma.$transaction(async (tx) => {
      const i = await tx.linkedinProjetoInforme.create({ data: { ...b.data, projetoId: p.id, autorId: uid(req) } });
      await recalcular(tx, p.id);
      await tx.linkedinProjetoEvento.create({ data: { projetoId: p.id, autorId: uid(req), entidade: 'informe', entidadeId: i.id, acao: 'criar', depois: json(i) } });
      return i;
    });
  });

  app.patch('/api/linkedin/projetos/:projetoId/informes/:id', async (req, reply) => {
    const p = await projeto(req);
    if (!p) return reply.status(404).send({ error: 'Projeto não encontrado.' });
    const b = InformeProjetoInSchema.partial().strict().safeParse(req.body);
    if (!b.success || !Object.keys(b.data).length) return reply.status(400).send({ error: 'Informe inválido.' });
    const atual = await prisma.linkedinProjetoInforme.findFirst({ where: { id: ids(req).id, projetoId: p.id, excluidoEm: null } });
    if (!atual) return reply.status(404).send({ error: 'Informe não encontrado.' });
    return prisma.$transaction(async (tx) => {
      const i = await tx.linkedinProjetoInforme.update({ where: { id: atual.id }, data: b.data });
      await recalcular(tx, p.id);
      await tx.linkedinProjetoEvento.create({ data: { projetoId: p.id, autorId: uid(req), entidade: 'informe', entidadeId: i.id, acao: 'editar', antes: json(atual), depois: json(i) } });
      return i;
    });
  });

  app.delete('/api/linkedin/projetos/:projetoId/informes/:id', async (req, reply) => {
    const p = await projeto(req);
    if (!p) return reply.status(404).send({ error: 'Projeto não encontrado.' });
    const atual = await prisma.linkedinProjetoInforme.findFirst({ where: { id: ids(req).id, projetoId: p.id, excluidoEm: null } });
    if (!atual) return reply.status(404).send({ error: 'Informe não encontrado.' });
    await prisma.$transaction(async (tx) => {
      const i = await tx.linkedinProjetoInforme.update({ where: { id: atual.id }, data: { excluidoEm: new Date() } });
      await recalcular(tx, p.id);
      await tx.linkedinProjetoEvento.create({ data: { projetoId: p.id, autorId: uid(req), entidade: 'informe', entidadeId: i.id, acao: 'excluir', antes: json(atual), depois: json(i) } });
    });
    return { ok: true };
  });
}
