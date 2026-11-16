import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { InspiracaoInSchema, MAX_INSPIRACOES, PerfilProSchema, VozAjustesInSchema, podeGerarVoz } from '@seginfo/shared';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';
import { extrairVaga, lerPrintDeInspiracao, gerarPerfilVoz, importarPerfilDoPdf, MODELO } from './ia.js';
import { estrategiaDe } from './linkedin.js';
import { iniciarTarefa } from './linkedinPipeline.js';
import { inspiracaoParaDto, perfilDe, pontos, vozDe } from './linkedinPerfilContexto.js';

/**
 * Perfil profissional, inspirações e perfil de voz do LinkedIn. Registrado no plugin de estado:
 * herda a identidade do Cloudflare Access. As tarefas de IA usam o mesmo mecanismo do pipeline
 * (consulta em GET /api/linkedin/tarefas/:id).
 */

const uid = (req: unknown) => (req as AuthedRequest).usuarioId;
const idDe = (req: unknown) => (req as { params: { id: string } }).params.id;
const invalido = (reply: FastifyReply) => reply.status(400).send({ error: 'payload inválido' });
const naoAchei = (reply: FastifyReply) => reply.status(404).send({ error: 'não encontrado' });
const responder = (r: ReturnType<typeof iniciarTarefa>, reply: FastifyReply) => ('erro' in r ? reply.status(429).send({ error: r.erro }) : r);

const MB = 1024 * 1024;
const bytesDeBase64 = (b64: string) => Math.floor((b64.length * 3) / 4);
const urlSegura = (u: string | undefined) => !u || /^https?:\/\/\S+$/i.test(u);

const Base64 = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/);

export async function registerLinkedinPerfilRoutes(app: FastifyInstance) {
  // ===================== perfil profissional =====================
  app.get('/api/linkedin/perfil-pro', async (req) => perfilDe(uid(req)));

  const SalvarPerfil = z.object({ perfil: PerfilProSchema, importado: z.boolean().optional() });
  app.put('/api/linkedin/perfil-pro', async (req, reply) => {
    const b = SalvarPerfil.safeParse(req.body);
    if (!b.success) return invalido(reply);
    const u = uid(req);
    const dados = b.data.perfil as Prisma.InputJsonValue;
    await prisma.linkedinPerfilPro.upsert({
      where: { usuarioId: u },
      update: { dados, ...(b.data.importado ? { importadoEm: new Date() } : {}) },
      create: { usuarioId: u, dados, importadoEm: b.data.importado ? new Date() : null },
    });
    return perfilDe(u);
  });

  // PDF do perfil (Mais > Salvar como PDF) lido pela IA. Não grava: a tela mostra o resultado para revisão.
  const PdfIn = z.object({ pdfBase64: Base64.max(14 * MB) });
  app.post('/api/linkedin/tarefas/perfil-pdf', { bodyLimit: 16 * MB }, async (req, reply) => {
    const b = PdfIn.safeParse(req.body);
    if (!b.success || bytesDeBase64(b.data.pdfBase64) > 10 * MB) return reply.status(400).send({ error: 'Envie um PDF de até 10 MB.' });
    if (!Buffer.from(b.data.pdfBase64.slice(0, 12), 'base64').toString('latin1').startsWith('%PDF')) {
      return reply.status(400).send({ error: 'O arquivo não parece ser um PDF.' });
    }
    return responder(iniciarTarefa(uid(req), () => importarPerfilDoPdf(b.data.pdfBase64)), reply);
  });

  const VagaIn = z.object({ texto: z.string().trim().min(80).max(15_000) });
  app.post('/api/linkedin/tarefas/vaga', async (req, reply) => {
    const b = VagaIn.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'Cole o texto da vaga (pelo menos 80 caracteres).' });
    return responder(iniciarTarefa(uid(req), () => extrairVaga(b.data.texto)), reply);
  });

  // ===================== inspirações =====================
  app.get('/api/linkedin/inspiracoes', async (req) => {
    const linhas = await prisma.linkedinInspiracao.findMany({ where: { usuarioId: uid(req) }, orderBy: { criadoEm: 'desc' } });
    return linhas.map(inspiracaoParaDto);
  });

  app.post('/api/linkedin/inspiracoes', async (req, reply) => {
    const b = InspiracaoInSchema.safeParse(req.body);
    if (!b.success || !urlSegura(b.data.url)) return invalido(reply);
    const u = uid(req);
    if ((await prisma.linkedinInspiracao.count({ where: { usuarioId: u } })) >= MAX_INSPIRACOES) {
      return reply.status(400).send({ error: `Limite de ${MAX_INSPIRACOES} inspirações. Remova as que não servem mais.` });
    }
    const d = b.data;
    const nova = await prisma.linkedinInspiracao.create({
      data: {
        usuarioId: u, tipo: d.tipo, autor: d.autor, url: d.url ?? '', texto: d.texto ?? '', motivo: d.motivo ?? '',
        aspectos: [...new Set(d.aspectos ?? [])], observacaoVisual: d.observacaoVisual ?? '', frequencia: d.frequencia ?? '',
      },
    });
    return inspiracaoParaDto(nova);
  });

  app.patch('/api/linkedin/inspiracoes/:id', async (req, reply) => {
    const b = InspiracaoInSchema.partial().safeParse(req.body);
    if (!b.success || !urlSegura(b.data.url)) return invalido(reply);
    const u = uid(req);
    const { aspectos, ...resto } = b.data;
    const r = await prisma.linkedinInspiracao.updateMany({
      where: { id: idDe(req), usuarioId: u },
      data: { ...resto, ...(aspectos ? { aspectos: [...new Set(aspectos)] } : {}) },
    });
    if (!r.count) return naoAchei(reply);
    const linha = await prisma.linkedinInspiracao.findFirstOrThrow({ where: { id: idDe(req), usuarioId: u } });
    return inspiracaoParaDto(linha);
  });

  app.delete('/api/linkedin/inspiracoes/:id', async (req) => {
    await prisma.linkedinInspiracao.deleteMany({ where: { id: idDe(req), usuarioId: uid(req) } });
    return { ok: true };
  });

  // Print de um post que admiro: a IA descreve o visual. A imagem não é guardada, só o texto.
  const ImagemIn = z.object({
    imagemBase64: Base64.max(8 * MB),
    tipo: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  });
  app.post('/api/linkedin/tarefas/imagem-inspiracao', { bodyLimit: 9 * MB }, async (req, reply) => {
    const b = ImagemIn.safeParse(req.body);
    if (!b.success || bytesDeBase64(b.data.imagemBase64) > 5 * MB) return reply.status(400).send({ error: 'Envie uma imagem JPG, PNG, WebP ou GIF de até 5 MB.' });
    return responder(iniciarTarefa(uid(req), () => lerPrintDeInspiracao(b.data.imagemBase64, b.data.tipo)), reply);
  });

  // ===================== perfil de voz =====================
  app.get('/api/linkedin/voz', async (req) => vozDe(uid(req)));

  app.put('/api/linkedin/voz/ajustes', async (req, reply) => {
    const b = VozAjustesInSchema.safeParse(req.body);
    if (!b.success) return invalido(reply);
    const u = uid(req);
    await prisma.linkedinVoz.upsert({ where: { usuarioId: u }, update: { ajustes: b.data.ajustes }, create: { usuarioId: u, ajustes: b.data.ajustes } });
    return vozDe(u);
  });

  app.post('/api/linkedin/tarefas/voz', async (req, reply) => {
    const u = uid(req);
    const [totalPosts, totalInspiracoes] = await Promise.all([
      prisma.linkedinPost.count({ where: { usuarioId: u } }),
      prisma.linkedinInspiracao.count({ where: { usuarioId: u } }),
    ]);
    if (!podeGerarVoz(totalPosts, totalInspiracoes)) {
      return reply.status(400).send({ error: 'Falta material: registre pelo menos 3 posts seus (aba Publicados) ou 2 inspirações.' });
    }
    return responder(iniciarTarefa(u, async () => {
      const [recentes, inspiracoes, estrategia, atual] = await Promise.all([
        prisma.linkedinPost.findMany({ where: { usuarioId: u }, orderBy: { publicadoEm: 'desc' }, take: 200 }),
        prisma.linkedinInspiracao.findMany({ where: { usuarioId: u }, orderBy: { criadoEm: 'desc' }, take: MAX_INSPIRACOES }),
        estrategiaDe(u),
        vozDe(u),
      ]);
      // os 30 mais recentes (a voz muda) e os 10 mais engajados (o que funcionou), sem repetir
      const maisEngajados = [...recentes].sort((a, b) => pontos(b.metricas) - pontos(a.metricas)).filter((p) => pontos(p.metricas) > 0).slice(0, 10);
      const escolhidos = [...new Map([...recentes.slice(0, 30), ...maisEngajados].map((p) => [p.id, p])).values()];
      const perfil = await gerarPerfilVoz({
        posts: escolhidos.map((p) => ({ id: p.id, data: p.publicadoEm, texto: p.texto, pontos: pontos(p.metricas) })),
        inspiracoes: inspiracoes.map((i) => ({ ...i })),
        ajustes: atual.ajustes,
        vozEscrita: estrategia.voz,
      });
      const dados = {
        perfil: perfil as Prisma.InputJsonValue, baseadoEmPosts: recentes.length, baseadoEmInspiracoes: inspiracoes.length,
        modelo: MODELO, geradoEm: new Date(),
      };
      await prisma.linkedinVoz.upsert({ where: { usuarioId: u }, update: dados, create: { usuarioId: u, ...dados } });
      return vozDe(u);
    }), reply);
  });
}
