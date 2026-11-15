import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from './db.js';
import { requireUser, type AuthedRequest } from './auth.js';
import { registerRadarRoutes } from './radar.js';
import { registerPericiaRoutes } from './pericia.js';
import { registerMemoriaRoutes } from './memorias.js';
import { origemOk, registerStorageRoutes } from './storage-routes.js';
import { registerKevRoutes } from './kev.js';
import { registerLinkedinRoutes } from './linkedin.js';
import { registerLinkedinPipelineRoutes } from './linkedinPipeline.js';
import { registerAgenteRoutes } from './agentes.js';
import { registerIntegracoesRoutes } from './integracoes.js';
import { registerWazuhRoutes } from './wazuh.js';
import { registerDescobertaRoutes } from './descoberta.js';
import { exigirSessaoCofre, registerCofre2faRoutes, registrarEvento } from './cofre2fa.js';

/** Registra todas as rotas de estado do usuário, todas protegidas por requireUser. */
export async function registerStateRoutes(app: FastifyInstance) {
  // Este plugin é encapsulado: o hook vale só para as rotas de estado registradas aqui
  // (/health e /api/extract ficam fora e têm tratamento próprio em server.ts).
  app.addHook('preHandler', async (req, reply) => {
    const ok = await requireUser(req, reply);
    if (!ok) return reply; // resposta de erro já enviada; interrompe a cadeia
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !origemOk(req)) {
      return reply.status(403).send({ error: 'Origem não permitida.' });
    }
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
    const b = z.object({ data: z.string(), minutos: z.number().int().positive(), trilhaId: z.string().optional(), topicoId: z.string().optional(), labId: z.string().optional(), nota: z.string().optional() }).safeParse(req.body);
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
  // Os rascunhos (/api/posts) viraram o pipeline do LinkedIn: ficam em linkedinPipeline.ts,
  // registrado mais abaixo junto com projetos, ideias, agendamento e conta.

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
  app.patch('/api/biblioteca/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = z.object({
      url: z.string().url().optional(), titulo: z.string().max(500).optional(), dominio: z.string().max(200).optional(),
      textoOriginal: z.string().max(200_000).optional(), resumo: z.string().max(20_000).optional(),
      palavrasChave: z.array(z.string().max(100)).max(100).optional(), categoria: z.string().max(100).optional(),
      tags: z.array(z.string().max(100)).max(100).optional(), estado: z.enum(['para_ler', 'lendo', 'lido']).optional(),
      favorito: z.boolean().optional(), anotacoes: z.string().max(20_000).optional(), topicoId: z.string().nullable().optional(),
      fonteResumo: z.string().max(50).optional(),
    }).strict().safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const r = await prisma.biblioItem.updateMany({ where: { id, usuarioId: uid(req) }, data: b.data });
    if (!r.count) return reply.status(404).send({ error: 'não encontrado' });
    return { ok: true };
  });
  app.delete('/api/biblioteca/:id', async (req) => {
    const { id } = req.params as { id: string };
    await prisma.biblioItem.deleteMany({ where: { id, usuarioId: uid(req) } });
    return { ok: true };
  });

  // ---------- Cofre (blob cifrado) ----------
  // Só com segundo fator ativo e sessão aberta por um código válido (ver cofre2fa.ts).
  await registerCofre2faRoutes(app);
  app.get('/api/cofre', async (req, reply) => {
    if (!(await exigirSessaoCofre(req, reply))) return reply;
    const blob = await prisma.cofreBlob.findUnique({ where: { usuarioId: uid(req) } });
    await registrarEvento(req, 'cofre_lido');
    return blob ?? null;
  });
  app.put('/api/cofre', async (req, reply) => {
    if (!(await exigirSessaoCofre(req, reply))) return reply;
    const b = z.object({
      versao: z.literal(1), salt: z.string().max(100), iv: z.string().max(100), ciphertext: z.string().max(5_000_000),
      autoLockMin: z.number().int().optional(),
      // data da versão que o navegador carregou: se outra aba/aparelho salvou depois, recusa (409)
      baseAtualizadoEm: z.string().nullable().optional(),
    }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const atual = await prisma.cofreBlob.findUnique({ where: { usuarioId: uid(req) }, select: { atualizadoEm: true } });
    if (b.data.baseAtualizadoEm !== undefined && atual && atual.atualizadoEm.toISOString() !== b.data.baseAtualizadoEm) {
      return reply.status(409).send({ error: 'O Cofre foi alterado em outro aparelho ou aba. Recarregue antes de salvar.', codigo: 'CONFLITO' });
    }
    const data = { versao: b.data.versao, salt: b.data.salt, iv: b.data.iv, ciphertext: b.data.ciphertext, autoLockMin: b.data.autoLockMin ?? 5 };
    const salvo = await prisma.cofreBlob.upsert({ where: { usuarioId: uid(req) }, update: data, create: { ...data, usuarioId: uid(req) } });
    await registrarEvento(req, 'cofre_salvo');
    return { atualizadoEm: salvo.atualizadoEm.toISOString() };
  });

  // ---------- Importação do navegador (localStorage -> servidor, uma vez) ----------
  app.post('/api/import', async (req, reply) => {
    const b = z.object({
      progresso: z.array(z.any()).optional(),
      sessoes: z.array(z.object({ id: z.string().min(1).max(100), data: z.string().max(32), minutos: z.number().int().positive(), trilhaId: z.string().optional(), topicoId: z.string().optional(), labId: z.string().optional(), nota: z.string().max(20_000).optional() })).max(10_000).optional(),
      metas: z.array(z.object({ id: z.string().min(1).max(100), titulo: z.string().max(500), prazo: z.string().max(32), trilhaId: z.string().optional(), concluida: z.boolean().optional() })).max(10_000).optional(),
      posts: z.array(z.object({ id: z.string().min(1).max(100), titulo: z.string().max(500), gancho: z.string().max(2_000).optional(), corpo: z.string().max(50_000).optional(), direcaoVisual: z.string().max(5_000).optional(), textoAlternativo: z.string().max(1_000).optional(), roteiroSlides: z.string().max(10_000).optional(), topicoId: z.string().optional(), publicado: z.boolean().optional() })).max(10_000).optional(),
      arsenal: z.array(z.object({ id: z.string().min(1).max(100), tipo: z.enum(['prompt', 'skill', 'agente']), nome: z.string().max(500), slug: z.string().optional(), dominio: z.string().optional(), resumo: z.string().optional(), conteudo: z.string().optional(), quandoUsar: z.string().optional(), requisitos: z.array(z.string()).optional(), tags: z.array(z.string()).optional(), artefatos: z.array(z.any()).optional(), favorito: z.boolean().optional() })).max(10_000).optional(),
      biblioteca: z.array(z.object({ id: z.string().min(1).max(100), url: z.string().url(), titulo: z.string().optional(), dominio: z.string().optional(), textoOriginal: z.string().optional(), resumo: z.string().optional(), palavrasChave: z.array(z.string()).optional(), categoria: z.string().optional(), tags: z.array(z.string()).optional(), estado: z.enum(['para_ler', 'lendo', 'lido']).optional(), favorito: z.boolean().optional(), anotacoes: z.string().optional(), topicoId: z.string().optional(), fonteResumo: z.string().optional() })).max(10_000).optional(),
      cofre: z.object({ versao: z.literal(1), salt: z.string(), iv: z.string(), ciphertext: z.string(), autoLockMin: z.number().int().optional() }).nullable().optional(),
    }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const u = uid(req);
    const d = b.data;
    const counts = { progresso: 0, sessoes: 0, metas: 0, posts: 0, arsenal: 0, biblioteca: 0, cofre: 0 };

    // Coleções locais têm IDs estáveis. Preservá-los torna a importação repetível:
    // uma nova tentativa atualiza o mesmo registro em vez de criar cópias.
    const salvarPorId = async (
      find: () => Promise<{ usuarioId: string } | null>,
      update: () => Promise<unknown>,
      create: () => Promise<unknown>,
    ) => {
      const existente = await find();
      if (existente) {
        // IDs pertencentes a outro usuário são ignorados, nunca sobrescritos.
        if (existente.usuarioId !== u) return false;
        await update();
        return true;
      }
      await create();
      return true;
    };

    for (const p of d.progresso ?? []) {
      await prisma.progresso.upsert({
        where: { usuarioId_topicoId: { usuarioId: u, topicoId: p.topicoId } },
        update: { status: p.status ?? 'a_estudar', anotacoes: p.anotacoes ?? '' },
        create: { usuarioId: u, topicoId: p.topicoId, status: p.status ?? 'a_estudar', anotacoes: p.anotacoes ?? '' },
      });
      counts.progresso++;
    }
    for (const s of d.sessoes ?? []) {
      const data = { data: s.data, minutos: s.minutos, trilhaId: s.trilhaId, topicoId: s.topicoId, nota: s.nota ?? '' };
      if (await salvarPorId(() => prisma.sessao.findUnique({ where: { id: s.id }, select: { usuarioId: true } }),
        () => prisma.sessao.updateMany({ where: { id: s.id, usuarioId: u }, data }),
        () => prisma.sessao.create({ data: { ...data, id: s.id, usuarioId: u } }))) counts.sessoes++;
    }
    for (const m of d.metas ?? []) {
      const data = { titulo: m.titulo, prazo: m.prazo, trilhaId: m.trilhaId, concluida: !!m.concluida };
      if (await salvarPorId(() => prisma.meta.findUnique({ where: { id: m.id }, select: { usuarioId: true } }),
        () => prisma.meta.updateMany({ where: { id: m.id, usuarioId: u }, data }),
        () => prisma.meta.create({ data: { ...data, id: m.id, usuarioId: u } }))) counts.metas++;
    }
    for (const p of d.posts ?? []) {
      const data = { titulo: p.titulo, gancho: p.gancho ?? '', corpo: p.corpo ?? '', topicoId: p.topicoId, publicado: !!p.publicado };
      if (await salvarPorId(() => prisma.post.findUnique({ where: { id: p.id }, select: { usuarioId: true } }),
        // só sobrescreve o que ainda é rascunho: a importação não pode trocar o texto de um post
        // aprovado ou agendado (a aprovação vale para um texto) nem reabrir um publicado
        () => prisma.post.updateMany({ where: { id: p.id, usuarioId: u, status: 'rascunho' }, data: { ...data, ...(p.publicado ? { status: 'publicado' } : {}) } }),
        () => prisma.post.create({ data: { ...data, id: p.id, usuarioId: u, status: p.publicado ? 'publicado' : 'rascunho' } }))) counts.posts++;
    }
    for (const a of d.arsenal ?? []) {
      const data = { tipo: a.tipo, nome: a.nome, slug: a.slug ?? '', dominio: a.dominio ?? 'geral', resumo: a.resumo ?? '', conteudo: a.conteudo ?? '', quandoUsar: a.quandoUsar ?? '', requisitos: a.requisitos ?? [], tags: a.tags ?? [], artefatos: a.artefatos ?? [], favorito: !!a.favorito };
      if (await salvarPorId(() => prisma.arsenalItem.findUnique({ where: { id: a.id }, select: { usuarioId: true } }),
        () => prisma.arsenalItem.updateMany({ where: { id: a.id, usuarioId: u }, data }),
        () => prisma.arsenalItem.create({ data: { ...data, id: a.id, usuarioId: u } }))) counts.arsenal++;
    }
    for (const b2 of d.biblioteca ?? []) {
      const data = { url: b2.url, titulo: b2.titulo ?? '', dominio: b2.dominio ?? '', textoOriginal: b2.textoOriginal ?? '', resumo: b2.resumo ?? '', palavrasChave: b2.palavrasChave ?? [], categoria: b2.categoria ?? 'geral', tags: b2.tags ?? [], estado: b2.estado ?? 'para_ler', favorito: !!b2.favorito, anotacoes: b2.anotacoes ?? '', topicoId: b2.topicoId, fonteResumo: b2.fonteResumo ?? 'local' };
      if (await salvarPorId(() => prisma.biblioItem.findUnique({ where: { id: b2.id }, select: { usuarioId: true } }),
        () => prisma.biblioItem.updateMany({ where: { id: b2.id, usuarioId: u }, data }),
        () => prisma.biblioItem.create({ data: { ...data, id: b2.id, usuarioId: u } }))) counts.biblioteca++;
    }
    // O Cofre NÃO entra por aqui: no servidor ele só é gravado pela tela do Cofre, com o segundo
    // fator ativo e sessão aberta (PUT /api/cofre). Assim esta rota não vira um atalho sem 2FA.
    return { ok: true, imported: counts, cofreIgnorado: !!d.cofre };
  });

  // ---------- Radar de Ataques (análise; herda o hook de identidade acima) ----------
  await registerRadarRoutes(app);
  await registerPericiaRoutes(app);

  // ---------- Armazenamento externo (OneDrive) e backups ----------
  await registerStorageRoutes(app);

  // ---------- Segundo Cérebro (memórias + busca) ----------
  await registerMemoriaRoutes(app);

  // ---------- Ameaças: catálogo CISA KEV filtrado pelos produtos acompanhados ----------
  await registerKevRoutes(app);

  // LinkedIn: posts publicados, IA (Claude) e diário do projeto
  await registerLinkedinRoutes(app);
  // LinkedIn: rascunhos no pipeline, projetos, ideias, agendamento e conexão com a API
  await registerLinkedinPipelineRoutes(app);

  // Agents: projetos de agentes de IA, avaliações e teste da base de conhecimento
  await registerAgenteRoutes(app);

  // Meu Ambiente: como o servidor se conecta a cada sistema (sem segredos)
  await registerIntegracoesRoutes(app);
  await registerWazuhRoutes(app);
  // Meu Ambiente: "Sincronizar com o ambiente" (descoberta só com leitura; o navegador aplica)
  await registerDescobertaRoutes(app);
}
