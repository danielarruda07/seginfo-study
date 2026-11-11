import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  AnalisePostSchema, DIARIO_PROJETO, ESTRATEGIA_PADRAO, EstrategiaSchema, FORMATOS_POST, MetricasSchema,
  isUrlLinkedin, normalizarUrlLinkedin,
  type AnalisePost, type CatalogoIA, type Estrategia, type Metricas, type PostPublicado,
} from '@seginfo/shared';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';
import { analisarPost, ErroIA, gerarRascunho, iaConfigurada, MODELO } from './ia.js';

/**
 * Módulo LinkedIn no servidor: posts publicados, organização por IA (Claude) com envio ao
 * Segundo Cérebro, estratégia e diário do projeto. Registrado DENTRO do plugin de rotas de
 * estado: herda a identidade do Cloudflare Access e a verificação de origem.
 */

// ---------- validação ----------
const Url = z.string().trim().max(500).refine(isUrlLinkedin, 'URL do LinkedIn inválida');
const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Texto = z.string().trim().min(1).max(10_000);
const Formato = z.enum(FORMATOS_POST);

const NovoPost = z.object({ url: Url, publicadoEm: Data, texto: Texto, formato: Formato.optional(), metricas: MetricasSchema.optional() });
const EditarPost = NovoPost.partial();
const Importar = z.object({
  posts: z.array(NovoPost.extend({
    origem: z.enum(['manual', 'importacao']).optional(),
    // vindo da migração do navegador: análise já feita
    analise: AnalisePostSchema.extend({ analisadoEm: z.string(), modelo: z.string() }).optional(),
  })).min(1).max(5_000),
});
const Catalogo = z.object({
  trilhas: z.array(z.object({ id: z.string().max(100), titulo: z.string().max(200) })).max(200),
  topicos: z.array(z.object({ id: z.string().max(100), titulo: z.string().max(200), trilhaId: z.string().max(100) })).max(2_000),
});
const Nota = z.object({ titulo: z.string().max(200), trecho: z.string().max(2_000) });
const Rascunho = z.object({
  briefing: z.string().trim().min(5).max(3_000),
  pilar: z.string().max(80).optional(),
  formato: Formato,
  incluirDiario: z.boolean(),
  /** progresso de estudo montado no front (o estudo ainda vive no navegador) */
  estudo: z.string().max(20_000),
  notas: z.array(Nota).max(8),
});
const NovaEntrada = z.object({
  data: Data,
  titulo: z.string().trim().min(1).max(200),
  descricao: z.string().trim().min(1).max(4_000),
  categoria: z.enum(['funcionalidade', 'seguranca', 'infra', 'decisao', 'aprendizado', 'plano']),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});

// ---------- helpers ----------
type LinhaPost = Awaited<ReturnType<typeof prisma.linkedinPost.findFirstOrThrow>>;

function paraDto(p: LinhaPost): PostPublicado {
  return {
    id: p.id, url: p.url, publicadoEm: p.publicadoEm, texto: p.texto,
    formato: p.formato as PostPublicado['formato'],
    metricas: (p.metricas ?? {}) as Metricas,
    origem: p.origem as PostPublicado['origem'],
    analise: (p.analise ?? null) as AnalisePost | null,
    memoriaId: p.memoriaId,
  };
}

async function estrategiaDe(usuarioId: string): Promise<Estrategia> {
  const e = await prisma.linkedinEstrategia.findUnique({ where: { usuarioId } });
  return e ? { objetivo: e.objetivo, publico: e.publico, voz: e.voz, pilares: e.pilares } : ESTRATEGIA_PADRAO;
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Nota em Markdown para o Segundo Cérebro (uma por post). */
function notaDoPost(p: PostPublicado, catalogo: CatalogoIA) {
  const a = p.analise;
  const primeira = p.texto.split('\n').find((l) => l.trim())?.trim() ?? 'Post';
  const m = p.metricas;
  const linhas = [
    `**Post publicado no LinkedIn** em ${p.publicadoEm} — ${p.url}`,
    '',
    a ? `**Pilar:** ${a.pilar} · **Gancho:** ${a.tipoGancho} · **Formato:** ${p.formato}` : `**Formato:** ${p.formato}`,
  ];
  if (m.impressoes || m.reacoes || m.comentarios) {
    linhas.push(`**Métricas:** ${m.impressoes ?? '—'} impressões, ${m.reacoes ?? 0} reações, ${m.comentarios ?? 0} comentários, ${m.compartilhamentos ?? 0} compartilhamentos`);
  }
  linhas.push('', '## Texto', p.texto);
  if (a) {
    const topico = (id: string) => catalogo.topicos.find((t) => t.id === id)?.titulo ?? id;
    const trilha = (id: string) => catalogo.trilhas.find((t) => t.id === id)?.titulo ?? id;
    linhas.push(
      '', '## Resumo', a.resumo,
      '', '## Aprendizados reutilizáveis', ...a.aprendizados.map((x) => `- ${x}`),
      '', '## Ideias para próximos posts', ...a.ideiasDerivadas.map((x) => `- ${x}`),
      '', '## Ligações no estudo',
      `- Trilhas: ${a.trilhaIds.map(trilha).join(', ') || '—'}`,
      `- Tópicos: ${a.topicoIds.map(topico).join(', ') || '—'}`,
      `- Temas: ${a.temas.join(', ')}`,
    );
  }
  const tags = [...new Set(['linkedin', ...(a ? [slug(a.pilar), ...a.tags.map(slug)] : [])].filter(Boolean))].slice(0, 20);
  return { titulo: `LinkedIn · ${p.publicadoEm} · ${(a?.resumo ?? primeira).slice(0, 150)}`, conteudo: linhas.join('\n'), tags };
}

/** Cria ou atualiza a nota do post no Segundo Cérebro; devolve o id da nota. */
async function sincronizarCerebro(usuarioId: string, p: PostPublicado, catalogo: CatalogoIA): Promise<string> {
  const nota = notaDoPost(p, catalogo);
  if (p.memoriaId) {
    const r = await prisma.memoria.updateMany({
      where: { id: p.memoriaId, usuarioId },
      // se estava na lixeira, volta
      data: { ...nota, urlOrigem: p.url, excluirEm: null },
    });
    if (r.count) return p.memoriaId;
  }
  const m = await prisma.memoria.create({
    data: { usuarioId, ...nota, escopo: 'pessoal', origem: 'linkedin', urlOrigem: p.url },
  });
  await prisma.linkedinPost.updateMany({ where: { id: p.id, usuarioId }, data: { memoriaId: m.id } });
  return m.id;
}

/** Contexto da jornada para rascunhos: estratégia + histórico + diário (do banco) + estudo (do front). */
async function contextoDaJornada(usuarioId: string, estudo: string, incluirDiario: boolean): Promise<string> {
  const [estrategia, linhas, diario] = await Promise.all([
    estrategiaDe(usuarioId),
    prisma.linkedinPost.findMany({ where: { usuarioId }, orderBy: { publicadoEm: 'desc' }, take: 200 }),
    incluirDiario ? prisma.diarioEntrada.findMany({ where: { usuarioId } }) : Promise.resolve([]),
  ]);
  const posts = linhas.map(paraDto);
  const comAnalise = posts.filter((p) => p.analise);
  const pontos = (m: Metricas) => (m.reacoes ?? 0) + 2 * (m.comentarios ?? 0) + 3 * (m.compartilhamentos ?? 0) + 2 * (m.salvamentos ?? 0);
  const melhores = [...posts].sort((a, b) => pontos(b.metricas) - pontos(a.metricas)).slice(0, 3).filter((p) => pontos(p.metricas) > 0);
  const porPilar = new Map<string, number>();
  for (const p of comAnalise) porPilar.set(p.analise!.pilar, (porPilar.get(p.analise!.pilar) ?? 0) + 1);

  const partes = [
    `## Estratégia\nObjetivo: ${estrategia.objetivo}\nPúblico: ${estrategia.publico}\nVoz: ${estrategia.voz}\nPilares: ${estrategia.pilares.join(' | ')}`,
    `## Estudo\n${estudo}`,
    `## Histórico no LinkedIn\n${posts.length} posts registrados. Posts por pilar: ${[...porPilar].map(([p, n]) => `${p}: ${n}`).join('; ') || 'sem análises ainda'}.\n` +
      comAnalise.slice(0, 12).map((p) => `- ${p.publicadoEm} [${p.analise!.pilar}] ${p.analise!.resumo} (gancho: ${p.analise!.tipoGancho})`).join('\n') +
      (melhores.length ? `\nMelhores por engajamento:\n${melhores.map((p) => `- "${p.texto.split('\n')[0].slice(0, 160)}" — ${pontos(p.metricas)} pts`).join('\n')}` : '') +
      (comAnalise.length ? `\nIdeias derivadas ainda não usadas:\n- ${comAnalise.flatMap((p) => p.analise!.ideiasDerivadas).slice(0, 10).join('\n- ')}` : ''),
  ];
  if (incluirDiario) {
    const marcos = [...DIARIO_PROJETO, ...diario].sort((a, b) => a.data.localeCompare(b.data));
    partes.push(`## Diário de construção da SegInfo Study (projeto pessoal)\n${marcos.map((e) => `- ${e.data} [${e.categoria}] ${e.titulo}: ${e.descricao}`).join('\n')}`);
  }
  return partes.join('\n\n');
}

function responderErroIA(e: unknown, reply: FastifyReply) {
  if (e instanceof ErroIA) return reply.status(e.status).send({ error: e.message });
  throw e;
}

// ---------- rotas ----------
export async function registerLinkedinRoutes(app: FastifyInstance) {
  const uid = (req: unknown) => (req as AuthedRequest).usuarioId;
  const idDe = (req: unknown) => (req as { params: { id: string } }).params.id;

  app.get('/api/ia/status', async () => ({ configurada: iaConfigurada(), modelo: MODELO }));

  // ----- posts publicados -----
  app.get('/api/linkedin/posts', async (req) => {
    const linhas = await prisma.linkedinPost.findMany({ where: { usuarioId: uid(req) }, orderBy: { publicadoEm: 'desc' } });
    return linhas.map(paraDto);
  });

  app.post('/api/linkedin/posts', async (req, reply) => {
    const b = NovoPost.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    try {
      const p = await prisma.linkedinPost.create({
        data: {
          usuarioId: uid(req), url: b.data.url, urlNormalizada: normalizarUrlLinkedin(b.data.url),
          publicadoEm: b.data.publicadoEm, texto: b.data.texto, formato: b.data.formato ?? 'texto',
          metricas: (b.data.metricas ?? {}) as Prisma.InputJsonValue,
        },
      });
      return paraDto(p);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return reply.status(409).send({ error: 'Este post já está registrado.' });
      }
      throw e;
    }
  });

  app.patch('/api/linkedin/posts/:id', async (req, reply) => {
    const b = EditarPost.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const atual = await prisma.linkedinPost.findFirst({ where: { id: idDe(req), usuarioId: uid(req) } });
    if (!atual) return reply.status(404).send({ error: 'não encontrado' });
    const { url, metricas, texto, ...resto } = b.data;
    try {
      const p = await prisma.linkedinPost.update({
        where: { id: atual.id },
        data: {
          ...resto,
          ...(url ? { url, urlNormalizada: normalizarUrlLinkedin(url) } : {}),
          ...(metricas ? { metricas: metricas as Prisma.InputJsonValue } : {}),
          // texto mudou => a análise antiga não vale mais
          ...(texto !== undefined && texto !== atual.texto ? { texto, analise: Prisma.DbNull } : {}),
        },
      });
      return paraDto(p);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return reply.status(409).send({ error: 'Já existe outro post com esta URL.' });
      }
      throw e;
    }
  });

  app.delete('/api/linkedin/posts/:id', async (req) => {
    // a nota no Segundo Cérebro continua lá (é conhecimento, não só registro)
    await prisma.linkedinPost.deleteMany({ where: { id: idDe(req), usuarioId: uid(req) } });
    return { ok: true };
  });

  app.post('/api/linkedin/posts/importar', { bodyLimit: 20 * 1024 * 1024 }, async (req, reply) => {
    const b = Importar.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const r = await prisma.linkedinPost.createMany({
      data: b.data.posts.map((p) => ({
        usuarioId: uid(req), url: p.url, urlNormalizada: normalizarUrlLinkedin(p.url), publicadoEm: p.publicadoEm,
        texto: p.texto, formato: p.formato ?? 'texto', metricas: (p.metricas ?? {}) as Prisma.InputJsonValue,
        origem: p.origem ?? 'importacao', ...(p.analise ? { analise: p.analise as Prisma.InputJsonValue } : {}),
      })),
      skipDuplicates: true,
    });
    return { novos: r.count, duplicados: b.data.posts.length - r.count };
  });

  // ORGANIZAR: IA analisa o post e o servidor guarda a análise + a nota no Segundo Cérebro
  app.post('/api/linkedin/posts/:id/organizar', async (req, reply) => {
    const b = z.object({ catalogo: Catalogo }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const atual = await prisma.linkedinPost.findFirst({ where: { id: idDe(req), usuarioId: uid(req) } });
    if (!atual) return reply.status(404).send({ error: 'não encontrado' });
    try {
      const { pilares } = await estrategiaDe(uid(req));
      const analise = await analisarPost(atual, pilares, b.data.catalogo);
      const p = paraDto(await prisma.linkedinPost.update({ where: { id: atual.id }, data: { analise: analise as Prisma.InputJsonValue } }));
      const memoriaId = await sincronizarCerebro(uid(req), p, b.data.catalogo);
      return { ...p, memoriaId };
    } catch (e) {
      return responderErroIA(e, reply);
    }
  });

  app.post('/api/linkedin/posts/:id/cerebro', async (req, reply) => {
    const b = z.object({ catalogo: Catalogo }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const atual = await prisma.linkedinPost.findFirst({ where: { id: idDe(req), usuarioId: uid(req) } });
    if (!atual) return reply.status(404).send({ error: 'não encontrado' });
    return { memoriaId: await sincronizarCerebro(uid(req), paraDto(atual), b.data.catalogo) };
  });

  // EXPRESSAR: rascunho novo com o contexto da jornada
  app.post('/api/linkedin/rascunho', async (req, reply) => {
    const b = Rascunho.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    try {
      const contexto = await contextoDaJornada(uid(req), b.data.estudo, b.data.incluirDiario);
      return await gerarRascunho({ briefing: b.data.briefing, pilar: b.data.pilar, formato: b.data.formato, contexto, notas: b.data.notas });
    } catch (e) {
      return responderErroIA(e, reply);
    }
  });

  // ----- estratégia -----
  app.get('/api/linkedin/estrategia', async (req) => estrategiaDe(uid(req)));
  app.put('/api/linkedin/estrategia', async (req, reply) => {
    const b = EstrategiaSchema.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const e = await prisma.linkedinEstrategia.upsert({
      where: { usuarioId: uid(req) },
      update: b.data,
      create: { usuarioId: uid(req), ...b.data },
    });
    return { objetivo: e.objetivo, publico: e.publico, voz: e.voz, pilares: e.pilares };
  });

  // ----- diário (marcos criados pela tela; os do desenvolvimento estão no código) -----
  app.get('/api/linkedin/diario', async (req) => prisma.diarioEntrada.findMany({ where: { usuarioId: uid(req) }, orderBy: { data: 'desc' } }));
  app.post('/api/linkedin/diario', async (req, reply) => {
    const b = NovaEntrada.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    return prisma.diarioEntrada.create({ data: { ...b.data, tags: b.data.tags ?? [], usuarioId: uid(req) } });
  });
  app.delete('/api/linkedin/diario/:id', async (req) => {
    await prisma.diarioEntrada.deleteMany({ where: { id: idDe(req), usuarioId: uid(req) } });
    return { ok: true };
  });
}
