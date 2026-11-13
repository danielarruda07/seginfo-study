import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AgenteConfigSchema, AgenteInSchema, AvaliacaoInSchema, revisarAgente } from '@seginfo/shared';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';
import { buscarNaBase, tagsDaBase } from './memorias.js';
import { registerExecucaoRoutes } from './agenteRuntime.js';

/**
 * Agents: projetos de agentes de IA, avaliações e teste da base de conhecimento.
 * A execução (playground) fica em agenteRuntime.ts.
 * Registrado DENTRO do plugin de rotas de estado: herda a identidade verificada do Access
 * e a checagem de Origin das rotas que gravam dados.
 */

const MAX_AGENTES = 100;
const MAX_AVALIACOES = 500;

export async function registerAgenteRoutes(app: FastifyInstance) {
  const uid = (req: unknown) => (req as AuthedRequest).usuarioId;
  const params = (req: unknown) => (req as { params: { id: string; avId?: string } }).params;

  /** Um agente só vai para "ativo" sem erros de revisão (aprovação humana nas ações de escrita). */
  const bloqueiosParaAtivar = (status: string, config: z.infer<typeof AgenteConfigSchema>) =>
    status === 'ativo' ? revisarAgente(config).filter((r) => r.nivel === 'erro').map((r) => r.texto) : [];

  app.get('/api/agentes', async (req) => {
    const usuarioId = uid(req);
    const [agentes, avaliacoes, ultimas, pendentes] = await Promise.all([
      prisma.agente.findMany({
        where: { usuarioId }, orderBy: { atualizadoEm: 'desc' },
        select: { id: true, nome: true, resumo: true, status: true, config: true, atualizadoEm: true },
      }),
      prisma.agenteAvaliacao.findMany({ where: { usuarioId }, select: { agenteId: true, resultado: true }, take: 20_000 }),
      // última execução de cada agente (a tela mostra "executado há X" e o passo seguinte)
      prisma.agenteExecucao.findMany({
        where: { usuarioId }, orderBy: { criadoEm: 'desc' }, distinct: ['agenteId'],
        select: { agenteId: true, status: true, criadoEm: true },
      }),
      // execuções paradas esperando a decisão humana numa ação de escrita
      prisma.agenteExecucao.findMany({
        where: { usuarioId, status: 'aguardando_aprovacao' }, orderBy: { criadoEm: 'desc' },
        select: { id: true, agenteId: true }, take: 500,
      }),
    ]);

    const ultimaPorAgente = new Map(ultimas.map((e) => [e.agenteId, { status: e.status, criadoEm: e.criadoEm }]));
    const aprovacao = new Map<string, { total: number; maisRecente: string }>();
    for (const p of pendentes) {
      const atual = aprovacao.get(p.agenteId);
      if (atual) atual.total++;
      else aprovacao.set(p.agenteId, { total: 1, maisRecente: p.id });
    }

    const placar = new Map<string, { total: number; ok: number; parcial: number; falha: number }>();
    for (const a of avaliacoes) {
      const p = placar.get(a.agenteId) ?? { total: 0, ok: 0, parcial: 0, falha: 0 };
      p.total++;
      if (a.resultado === 'ok') p.ok++;
      else if (a.resultado === 'parcial') p.parcial++;
      else p.falha++;
      placar.set(a.agenteId, p);
    }

    return agentes.map(({ config, ...a }) => {
      const cfg = AgenteConfigSchema.safeParse(config);
      const revisao = cfg.success ? revisarAgente(cfg.data) : null;
      return {
        ...a,
        ferramentas: cfg.success ? cfg.data.ferramentas.length : 0,
        ferramentasEscrita: cfg.success ? cfg.data.ferramentas.filter((f) => f.permissao === 'escrita').length : 0,
        baseTags: cfg.success ? cfg.data.conhecimento.tags : [],
        avaliacoes: placar.get(a.id) ?? { total: 0, ok: 0, parcial: 0, falha: 0 },
        ultimaExecucao: ultimaPorAgente.get(a.id) ?? null,
        aguardandoAprovacao: aprovacao.get(a.id) ?? null,
        revisao: revisao
          ? { erros: revisao.filter((r) => r.nivel === 'erro').length, avisos: revisao.filter((r) => r.nivel === 'aviso').length }
          : null,
      };
    });
  });

  // Tags do Segundo Cérebro disponíveis para formar a base de conhecimento.
  app.get('/api/agentes/base/tags', async (req) => ({ tags: await tagsDaBase(uid(req)) }));

  // Testa a recuperação: o que o agente enxergaria na base dele para esta pergunta.
  app.post('/api/agentes/base/buscar', async (req, reply) => {
    const b = z.object({ agenteId: z.string().min(1), q: z.string().trim().min(1).max(200) }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'informe o agente e a pergunta' });
    const agente = await prisma.agente.findFirst({ where: { id: b.data.agenteId, usuarioId: uid(req) }, select: { config: true } });
    if (!agente) return reply.status(404).send({ error: 'agente não encontrado' });
    const cfg = AgenteConfigSchema.safeParse(agente.config);
    const tags = cfg.success ? cfg.data.conhecimento.tags : [];
    return { tags, resultados: await buscarNaBase(uid(req), b.data.q, tags) };
  });

  app.get('/api/agentes/:id', async (req, reply) => {
    const a = await prisma.agente.findFirst({ where: { id: params(req).id, usuarioId: uid(req) } });
    if (!a) return reply.status(404).send({ error: 'agente não encontrado' });
    return a;
  });

  app.post('/api/agentes', async (req, reply) => {
    const b = AgenteInSchema.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const bloqueios = bloqueiosParaAtivar(b.data.status, b.data.config);
    if (bloqueios.length > 0) return reply.status(422).send({ error: 'O agente não pode ficar ativo com pendências graves.', problemas: bloqueios });
    if (await prisma.agente.count({ where: { usuarioId: uid(req) } }) >= MAX_AGENTES) {
      return reply.status(409).send({ error: `Limite de ${MAX_AGENTES} agentes atingido.` });
    }
    return prisma.agente.create({
      data: {
        usuarioId: uid(req), nome: b.data.nome, resumo: b.data.resumo, status: b.data.status,
        config: b.data.config as Prisma.InputJsonObject,
      },
    });
  });

  app.put('/api/agentes/:id', async (req, reply) => {
    const b = AgenteInSchema.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const bloqueios = bloqueiosParaAtivar(b.data.status, b.data.config);
    if (bloqueios.length > 0) return reply.status(422).send({ error: 'O agente não pode ficar ativo com pendências graves.', problemas: bloqueios });
    const r = await prisma.agente.updateMany({
      where: { id: params(req).id, usuarioId: uid(req) },
      data: { nome: b.data.nome, resumo: b.data.resumo, status: b.data.status, config: b.data.config as Prisma.InputJsonObject },
    });
    if (r.count === 0) return reply.status(404).send({ error: 'agente não encontrado' });
    return { ok: true };
  });

  // Só se exclui o que já foi arquivado: dois passos conscientes, nunca um clique só.
  app.delete('/api/agentes/:id', async (req, reply) => {
    const a = await prisma.agente.findFirst({ where: { id: params(req).id, usuarioId: uid(req) }, select: { status: true } });
    if (!a) return reply.status(404).send({ error: 'agente não encontrado' });
    if (a.status !== 'arquivado') return reply.status(409).send({ error: 'Arquive o agente antes de excluir.' });
    await prisma.agente.deleteMany({ where: { id: params(req).id, usuarioId: uid(req) } });
    return { ok: true };
  });

  // ---------- avaliações (casos de teste executados) ----------
  app.get('/api/agentes/:id/avaliacoes', async (req, reply) => {
    const agente = await prisma.agente.findFirst({ where: { id: params(req).id, usuarioId: uid(req) }, select: { id: true } });
    if (!agente) return reply.status(404).send({ error: 'agente não encontrado' });
    return prisma.agenteAvaliacao.findMany({
      where: { agenteId: agente.id, usuarioId: uid(req) }, orderBy: { criadoEm: 'desc' }, take: MAX_AVALIACOES,
    });
  });

  app.post('/api/agentes/:id/avaliacoes', async (req, reply) => {
    const b = AvaliacaoInSchema.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const agente = await prisma.agente.findFirst({ where: { id: params(req).id, usuarioId: uid(req) }, select: { id: true } });
    if (!agente) return reply.status(404).send({ error: 'agente não encontrado' });
    return prisma.agenteAvaliacao.create({
      data: {
        usuarioId: uid(req), agenteId: agente.id, caso: b.data.caso, criterio: b.data.criterio,
        resultado: b.data.resultado, latenciaMs: b.data.latenciaMs, observacao: b.data.observacao,
      },
    });
  });

  app.delete('/api/agentes/:id/avaliacoes/:avId', async (req, reply) => {
    const p = params(req);
    const r = await prisma.agenteAvaliacao.deleteMany({ where: { id: p.avId, agenteId: p.id, usuarioId: uid(req) } });
    if (r.count === 0) return reply.status(404).send({ error: 'avaliação não encontrada' });
    return { ok: true };
  });

  // ---------- execução (playground) ----------
  await registerExecucaoRoutes(app);
}
