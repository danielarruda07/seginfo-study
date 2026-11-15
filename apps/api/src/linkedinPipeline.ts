import type { FastifyInstance, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import {
  AgendarInSchema, avaliarAgendamento, diaLocal, FORMATOS_POST, IdeiaInSchema, isUrlLinkedin, normalizarUrlLinkedin,
  ProjetoInSchema, RefinarInSchema, RegistrarPublicacaoInSchema, textoDoPost,
  type TarefaIA,
} from '@seginfo/shared';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';
import { ErroIA, gerarRascunho, planejarPauta, refinarTexto } from './ia.js';
import {
  concluirAutorizacao, contaPronta, desconectar, iniciarAutorizacao, statusDaConta, variaveisFaltando,
} from './linkedinApi.js';
import { bloqueiosDoServidor, ErroPublicacao, fusoDoLinkedin, publicarPelaApi } from './linkedinAgendador.js';
import { contextoDaJornada, estrategiaDe, paraDto } from './linkedin.js';
import { ideiaDoRadar } from './linkedinRadar.js';

/**
 * Pipeline do LinkedIn: projetos, backlog de ideias, ciclo de vida do rascunho
 * (rascunho → aprovado → agendado → publicado), versões, tarefas de IA em segundo plano e
 * a conexão com a API do LinkedIn. Registrado dentro do plugin de rotas de estado: herda a
 * identidade do Cloudflare Access e a verificação de origem.
 */

const MAX_VERSOES = 30;
const Formato = z.enum(FORMATOS_POST);
const Id = z.string().min(1).max(100);

const NovoRascunho = z.object({
  titulo: z.string().trim().min(1).max(200),
  gancho: z.string().max(2_000).optional(),
  corpo: z.string().max(50_000).optional(),
  direcaoVisual: z.string().max(5_000).optional(),
  textoAlternativo: z.string().max(1_000).optional(),
  roteiroSlides: z.string().max(10_000).optional(),
  topicoId: z.string().max(100).nullable().optional(),
  publicado: z.boolean().optional(),
  formato: Formato.optional(),
  projetoId: Id.nullable().optional(),
  ideiaId: Id.nullable().optional(),
  origemVersao: z.string().max(40).optional(),
});
const EditarRascunho = NovoRascunho.partial().strict();

const uid = (req: unknown) => (req as AuthedRequest).usuarioId;
const idDe = (req: unknown) => (req as { params: { id: string } }).params.id;
const invalido = (reply: FastifyReply) => reply.status(400).send({ error: 'payload inválido' });
const naoAchei = (reply: FastifyReply) => reply.status(404).send({ error: 'não encontrado' });

async function projetoDoUsuario(usuarioId: string, projetoId: string | null | undefined): Promise<boolean> {
  if (!projetoId) return true;
  return (await prisma.linkedinProjeto.count({ where: { id: projetoId, usuarioId } })) === 1;
}

/** Guarda uma versão do texto e mantém só as mais recentes. */
async function guardarVersao(tx: Prisma.TransactionClient, post: { id: string; usuarioId: string; gancho: string; corpo: string }, origem: string) {
  const ultima = await tx.postVersao.findFirst({ where: { postId: post.id }, orderBy: { numero: 'desc' }, select: { numero: true, gancho: true, corpo: true } });
  if (ultima && ultima.gancho === post.gancho && ultima.corpo === post.corpo) return;
  await tx.postVersao.create({
    data: { postId: post.id, usuarioId: post.usuarioId, numero: (ultima?.numero ?? 0) + 1, gancho: post.gancho, corpo: post.corpo, origem: origem.slice(0, 40) },
  });
  const antigas = await tx.postVersao.findMany({ where: { postId: post.id }, orderBy: { numero: 'desc' }, skip: MAX_VERSOES, select: { id: true } });
  if (antigas.length) await tx.postVersao.deleteMany({ where: { id: { in: antigas.map((v) => v.id) } } });
}

// ---------- tarefas de IA em segundo plano (memória; somem se a API reiniciar) ----------
interface Tarefa extends TarefaIA { usuarioId: string; criadaEm: number }
const tarefas = new Map<string, Tarefa>();
const VIDA_TAREFA_MS = 20 * 60_000;

function iniciarTarefa(usuarioId: string, trabalho: () => Promise<unknown>): { tarefaId: string } | { erro: string } {
  const agora = Date.now();
  for (const [k, t] of tarefas) if (t.criadaEm < agora - VIDA_TAREFA_MS) tarefas.delete(k);
  const emAndamento = [...tarefas.values()].filter((t) => t.usuarioId === usuarioId && t.status === 'rodando').length;
  if (emAndamento >= 2) return { erro: 'Já há duas tarefas de IA em andamento. Espere uma terminar.' };
  const id = randomUUID();
  const tarefa: Tarefa = { id, usuarioId, status: 'rodando', resultado: null, erro: null, criadaEm: agora };
  tarefas.set(id, tarefa);
  void trabalho()
    .then((r) => { tarefa.status = 'pronta'; tarefa.resultado = r; })
    .catch((e: unknown) => {
      tarefa.status = 'erro';
      tarefa.erro = e instanceof ErroIA ? e.message : `Falha na tarefa de IA: ${(e as Error).message}`.slice(0, 300);
    });
  return { tarefaId: id };
}

export async function registerLinkedinPipelineRoutes(app: FastifyInstance) {
  // ===================== rascunhos (tabela Post) =====================
  app.get('/api/posts', async (req) => prisma.post.findMany({ where: { usuarioId: uid(req) }, orderBy: { atualizadoEm: 'desc' } }));

  app.post('/api/posts', async (req, reply) => {
    const b = NovoRascunho.safeParse(req.body);
    if (!b.success) return invalido(reply);
    const u = uid(req);
    const { origemVersao, publicado, ...d } = b.data;
    if (!(await projetoDoUsuario(u, d.projetoId))) return reply.status(400).send({ error: 'Projeto não encontrado.' });
    const ideia = d.ideiaId ? await prisma.linkedinIdeia.findFirst({ where: { id: d.ideiaId, usuarioId: u } }) : null;
    if (d.ideiaId && !ideia) return reply.status(400).send({ error: 'Ideia não encontrada.' });
    return prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          usuarioId: u, titulo: d.titulo, gancho: d.gancho ?? '', corpo: d.corpo ?? '', direcaoVisual: d.direcaoVisual ?? '',
          textoAlternativo: d.textoAlternativo ?? '', roteiroSlides: d.roteiroSlides ?? '', topicoId: d.topicoId ?? null,
          formato: d.formato ?? ideia?.formato ?? 'texto', projetoId: d.projetoId ?? ideia?.projetoId ?? null, ideiaId: d.ideiaId ?? null,
          ...(publicado ? { publicado: true, status: 'publicado', publicadoEm: new Date() } : {}),
        },
      });
      if (post.gancho || post.corpo) await guardarVersao(tx, post, origemVersao ?? 'manual');
      if (ideia && ideia.status === 'nova') await tx.linkedinIdeia.update({ where: { id: ideia.id }, data: { status: 'em_rascunho' } });
      return post;
    });
  });

  app.patch('/api/posts/:id', async (req, reply) => {
    const b = EditarRascunho.safeParse(req.body);
    if (!b.success) return invalido(reply);
    const u = uid(req);
    const atual = await prisma.post.findFirst({ where: { id: idDe(req), usuarioId: u } });
    if (!atual) return naoAchei(reply);
    const { origemVersao, publicado, ...d } = b.data;
    if (!(await projetoDoUsuario(u, d.projetoId))) return reply.status(400).send({ error: 'Projeto não encontrado.' });
    if (d.ideiaId && !(await prisma.linkedinIdeia.count({ where: { id: d.ideiaId, usuarioId: u } }))) return reply.status(400).send({ error: 'Ideia não encontrada.' });

    const mudouTexto = (d.gancho !== undefined && d.gancho !== atual.gancho) || (d.corpo !== undefined && d.corpo !== atual.corpo);
    const mudouFormato = d.formato !== undefined && d.formato !== atual.formato;
    if (atual.status === 'publicando') return reply.status(409).send({ error: 'Este rascunho está sendo publicado agora. Espere terminar.' });
    if (atual.status === 'publicado' && (mudouTexto || mudouFormato) && publicado !== false) {
      return reply.status(409).send({ error: 'Este rascunho já foi publicado. Crie um novo para mudar o texto.' });
    }
    // a aprovação vale para um texto e um formato: mudou, volta para rascunho
    const desfazAprovacao = (mudouTexto || mudouFormato) && ['aprovado', 'agendado', 'falhou'].includes(atual.status);
    const estado: Prisma.PostUpdateInput = desfazAprovacao ? { status: 'rascunho', agendadoPara: null, aprovadoEm: null, ultimoErro: '' } : {};
    if (publicado === true && atual.status !== 'publicado') Object.assign(estado, { status: 'publicado', publicado: true, publicadoEm: new Date(), agendadoPara: null });
    if (publicado === false && atual.status === 'publicado') Object.assign(estado, { status: 'rascunho', publicado: false, publicadoEm: null, linkedinPostId: null });

    return prisma.$transaction(async (tx) => {
      const post = await tx.post.update({ where: { id: atual.id }, data: { ...d, ...estado } });
      if (mudouTexto) await guardarVersao(tx, post, origemVersao ?? 'manual');
      return post;
    });
  });

  app.delete('/api/posts/:id', async (req) => {
    const u = uid(req);
    const post = await prisma.post.findFirst({ where: { id: idDe(req), usuarioId: u }, select: { id: true, ideiaId: true, status: true } });
    if (!post) return { ok: true };
    await prisma.post.delete({ where: { id: post.id } });
    // a ideia volta para o backlog se nenhum outro rascunho a usa e ela não chegou a ser publicada
    if (post.ideiaId && post.status !== 'publicado' && !(await prisma.post.count({ where: { usuarioId: u, ideiaId: post.ideiaId } }))) {
      await prisma.linkedinIdeia.updateMany({ where: { id: post.ideiaId, usuarioId: u, status: 'em_rascunho' }, data: { status: 'nova' } });
    }
    return { ok: true };
  });

  // ----- ações do ciclo de vida -----
  const carregar = (req: unknown) => prisma.post.findFirst({ where: { id: idDe(req), usuarioId: uid(req) } });

  app.post('/api/linkedin/rascunhos/:id/aprovar', async (req, reply) => {
    const b = z.object({ riscosExtras: z.array(z.string().max(120)).max(20).optional() }).safeParse(req.body ?? {});
    if (!b.success) return invalido(reply);
    const post = await carregar(req);
    if (!post) return naoAchei(reply);
    if (!['rascunho', 'falhou', 'aprovado'].includes(post.status)) return reply.status(409).send({ error: 'Só um rascunho pode ser aprovado.' });
    const bloqueios = bloqueiosDoServidor(post, b.data.riscosExtras);
    if (bloqueios.length) return reply.status(422).send({ error: 'O texto ainda não pode ser aprovado.', bloqueios });
    return prisma.post.update({ where: { id: post.id }, data: { status: 'aprovado', aprovadoEm: new Date(), agendadoPara: null, ultimoErro: '' } });
  });

  app.post('/api/linkedin/rascunhos/:id/voltar', async (req, reply) => {
    const post = await carregar(req);
    if (!post) return naoAchei(reply);
    if (!['aprovado', 'agendado', 'falhou'].includes(post.status)) return reply.status(409).send({ error: 'Este rascunho não está aprovado nem agendado.' });
    return prisma.post.update({ where: { id: post.id }, data: { status: 'rascunho', agendadoPara: null, aprovadoEm: null, ultimoErro: '' } });
  });

  app.post('/api/linkedin/rascunhos/:id/agendar', async (req, reply) => {
    const b = AgendarInSchema.safeParse(req.body);
    if (!b.success) return invalido(reply);
    const u = uid(req);
    const post = await carregar(req);
    if (!post) return naoAchei(reply);
    if (!['aprovado', 'agendado', 'falhou'].includes(post.status)) return reply.status(409).send({ error: 'Aprove o rascunho antes de agendar.' });
    const bloqueios = bloqueiosDoServidor(post);
    if (bloqueios.length) return reply.status(422).send({ error: 'O texto não passa mais na verificação. Volte para rascunho e corrija.', bloqueios });
    if (b.data.canal === 'api') {
      if (post.formato !== 'texto') return reply.status(400).send({ error: 'Pela API só sai post de texto por enquanto. Use o lembrete para este formato.' });
      if (!(await contaPronta(u))) return reply.status(409).send({ error: 'Conecte (ou reconecte) o LinkedIn em Marca pessoal & IA para publicar pela API.' });
    }
    const [agendados, publicados] = await Promise.all([
      prisma.post.findMany({ where: { usuarioId: u, status: 'agendado', id: { not: post.id } }, select: { agendadoPara: true } }),
      prisma.linkedinPost.findMany({ where: { usuarioId: u, publicadoEm: { gte: diaLocal(new Date(Date.now() - 2 * 86_400_000), fusoDoLinkedin()) } }, select: { publicadoEm: true } }),
    ]);
    const ocupados = [
      ...agendados.flatMap((a) => (a.agendadoPara ? [a.agendadoPara.toISOString()] : [])),
      // 15:00 UTC cai no mesmo dia em qualquer fuso das Américas
      ...publicados.map((p) => `${p.publicadoEm}T15:00:00.000Z`),
    ];
    const av = avaliarAgendamento(b.data.quando, new Date(), ocupados, fusoDoLinkedin());
    if (av.erro) return reply.status(400).send({ error: av.erro });
    if (av.conflito && !b.data.forcar) return reply.status(409).send({ error: av.conflito, conflito: true });
    return prisma.post.update({
      where: { id: post.id },
      data: { status: 'agendado', agendadoPara: new Date(b.data.quando), canal: b.data.canal, tentativas: 0, ultimoErro: '' },
    });
  });

  app.post('/api/linkedin/rascunhos/:id/desagendar', async (req, reply) => {
    const post = await carregar(req);
    if (!post) return naoAchei(reply);
    if (post.status !== 'agendado') return reply.status(409).send({ error: 'Este rascunho não está agendado.' });
    return prisma.post.update({ where: { id: post.id }, data: { status: 'aprovado', agendadoPara: null, ultimoErro: '' } });
  });

  app.post('/api/linkedin/rascunhos/:id/publicar', async (req, reply) => {
    try {
      return await publicarPelaApi(uid(req), idDe(req), false);
    } catch (e) {
      if (e instanceof ErroPublicacao) return reply.status(e.status).send({ error: e.message });
      throw e;
    }
  });

  // "Publiquei à mão": cria o registro em Publicados e fecha o rascunho
  app.post('/api/linkedin/rascunhos/:id/registrar', async (req, reply) => {
    const b = RegistrarPublicacaoInSchema.safeParse(req.body);
    if (!b.success || !isUrlLinkedin(b.data.url)) return reply.status(400).send({ error: 'Cole o link do post no LinkedIn (começa com https://www.linkedin.com/).' });
    const u = uid(req);
    const post = await carregar(req);
    if (!post) return naoAchei(reply);
    if (post.status === 'publicando') return reply.status(409).send({ error: 'Este rascunho está sendo publicado agora. Espere terminar.' });
    const urlNormalizada = normalizarUrlLinkedin(b.data.url);
    const existente = await prisma.linkedinPost.findFirst({ where: { usuarioId: u, urlNormalizada } });
    const registro = existente ?? await prisma.linkedinPost.create({
      data: {
        usuarioId: u, url: b.data.url, urlNormalizada, publicadoEm: b.data.publicadoEm,
        texto: textoDoPost(post.gancho, post.corpo), formato: post.formato, projetoId: post.projetoId,
      },
    });
    const rascunho = await prisma.post.update({
      where: { id: post.id },
      data: { status: 'publicado', publicado: true, publicadoEm: new Date(`${b.data.publicadoEm}T12:00:00.000Z`), linkedinPostId: registro.id, agendadoPara: post.agendadoPara, ultimoErro: '' },
    });
    return { rascunho, post: paraDto(registro) };
  });

  // ----- versões -----
  app.get('/api/linkedin/rascunhos/:id/versoes', async (req, reply) => {
    const post = await carregar(req);
    if (!post) return naoAchei(reply);
    return prisma.postVersao.findMany({
      where: { postId: post.id }, orderBy: { numero: 'desc' },
      select: { id: true, numero: true, gancho: true, corpo: true, origem: true, criadoEm: true },
    });
  });

  app.post('/api/linkedin/rascunhos/:id/versoes/:versaoId/restaurar', async (req, reply) => {
    const post = await carregar(req);
    if (!post) return naoAchei(reply);
    if (post.status === 'publicando' || post.status === 'publicado') return reply.status(409).send({ error: 'Não dá para restaurar uma versão de um post publicado.' });
    const { versaoId } = req.params as { versaoId: string };
    const v = await prisma.postVersao.findFirst({ where: { id: versaoId, postId: post.id } });
    if (!v) return naoAchei(reply);
    return prisma.$transaction(async (tx) => {
      const novo = await tx.post.update({
        where: { id: post.id },
        data: { gancho: v.gancho, corpo: v.corpo, status: 'rascunho', agendadoPara: null, aprovadoEm: null, ultimoErro: '' },
      });
      await guardarVersao(tx, novo, `restaurar:${v.numero}`);
      return novo;
    });
  });

  // ===================== projetos =====================
  app.get('/api/linkedin/projetos', async (req) => prisma.linkedinProjeto.findMany({ where: { usuarioId: uid(req) }, orderBy: [{ status: 'asc' }, { criadoEm: 'desc' }] }));

  app.post('/api/linkedin/projetos', async (req, reply) => {
    const b = ProjetoInSchema.safeParse(req.body);
    if (!b.success) return invalido(reply);
    if ((await prisma.linkedinProjeto.count({ where: { usuarioId: uid(req) } })) >= 100) return reply.status(400).send({ error: 'Limite de 100 projetos.' });
    return prisma.linkedinProjeto.create({
      data: { usuarioId: uid(req), nome: b.data.nome, descricao: b.data.descricao ?? '', objetivo: b.data.objetivo ?? '', pilar: b.data.pilar ?? null, status: b.data.status ?? 'ativo' },
    });
  });

  app.patch('/api/linkedin/projetos/:id', async (req, reply) => {
    const b = ProjetoInSchema.partial().safeParse(req.body);
    if (!b.success) return invalido(reply);
    const r = await prisma.linkedinProjeto.updateMany({ where: { id: idDe(req), usuarioId: uid(req) }, data: b.data });
    if (!r.count) return naoAchei(reply);
    return prisma.linkedinProjeto.findUniqueOrThrow({ where: { id: idDe(req) } });
  });

  // apagar o projeto solta o vínculo; ideias, rascunhos, posts e marcos continuam
  app.delete('/api/linkedin/projetos/:id', async (req) => {
    const u = uid(req);
    const id = idDe(req);
    if (!(await prisma.linkedinProjeto.count({ where: { id, usuarioId: u } }))) return { ok: true };
    const solto = { where: { usuarioId: u, projetoId: id }, data: { projetoId: null } };
    await prisma.$transaction([
      prisma.post.updateMany(solto), prisma.linkedinIdeia.updateMany(solto), prisma.linkedinPost.updateMany(solto),
      prisma.diarioEntrada.updateMany(solto), prisma.linkedinProjeto.delete({ where: { id } }),
    ]);
    return { ok: true };
  });

  // ===================== ideias =====================
  app.get('/api/linkedin/ideias', async (req) => prisma.linkedinIdeia.findMany({ where: { usuarioId: uid(req) }, orderBy: { criadoEm: 'desc' }, take: 2_000 }));

  app.post('/api/linkedin/ideias', async (req, reply) => {
    const b = IdeiaInSchema.safeParse(req.body);
    if (!b.success) return invalido(reply);
    const u = uid(req);
    if (!(await projetoDoUsuario(u, b.data.projetoId))) return reply.status(400).send({ error: 'Projeto não encontrado.' });
    try {
      return await prisma.linkedinIdeia.create({
        data: {
          usuarioId: u, titulo: b.data.titulo, briefing: b.data.briefing ?? '', pilar: b.data.pilar ?? null, projetoId: b.data.projetoId ?? null,
          formato: b.data.formato ?? null, origem: b.data.origem ?? 'manual', origemRef: b.data.origemRef ?? null,
          status: b.data.status ?? 'nova', sugeridaPara: b.data.sugeridaPara ?? null,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return reply.status(409).send({ error: 'Esta ideia já está no backlog.' });
      throw e;
    }
  });

  app.patch('/api/linkedin/ideias/:id', async (req, reply) => {
    const b = IdeiaInSchema.partial().safeParse(req.body);
    if (!b.success) return invalido(reply);
    const u = uid(req);
    if (!(await projetoDoUsuario(u, b.data.projetoId))) return reply.status(400).send({ error: 'Projeto não encontrado.' });
    // origem e origemRef dizem de onde a ideia veio: não mudam depois de criada
    const { origem: _o, origemRef: _r, ...d } = b.data;
    const r = await prisma.linkedinIdeia.updateMany({ where: { id: idDe(req), usuarioId: u }, data: d });
    if (!r.count) return naoAchei(reply);
    return prisma.linkedinIdeia.findUniqueOrThrow({ where: { id: idDe(req) } });
  });

  app.delete('/api/linkedin/ideias/:id', async (req) => {
    const u = uid(req);
    await prisma.$transaction([
      prisma.post.updateMany({ where: { usuarioId: u, ideiaId: idDe(req) }, data: { ideiaId: null } }),
      prisma.linkedinIdeia.deleteMany({ where: { id: idDe(req), usuarioId: u } }),
    ]);
    return { ok: true };
  });

  // Radar → ideia: números agregados do honeypot, sem IP nem alvo
  app.post('/api/linkedin/ideias/radar', async (req, reply) => {
    const b = z.object({ dias: z.number().int().min(1).max(30).optional() }).safeParse(req.body ?? {});
    if (!b.success) return invalido(reply);
    const r = await ideiaDoRadar(uid(req), b.data.dias ?? 7, fusoDoLinkedin());
    if (r.erro !== undefined) return reply.status(409).send({ error: r.erro });
    return r.ideia;
  });

  // ===================== tarefas de IA =====================
  const responder = (r: ReturnType<typeof iniciarTarefa>, reply: FastifyReply) => ('erro' in r ? reply.status(429).send({ error: r.erro }) : r);

  const Gerar = z.object({
    briefing: z.string().trim().min(5).max(3_000),
    pilar: z.string().max(80).optional(),
    formato: Formato,
    incluirDiario: z.boolean(),
    estudo: z.string().max(20_000),
    notas: z.array(z.object({ titulo: z.string().max(200), trecho: z.string().max(2_000) })).max(8),
    projetoId: Id.nullable().optional(),
  });
  app.post('/api/linkedin/tarefas/gerar', async (req, reply) => {
    const b = Gerar.safeParse(req.body);
    if (!b.success) return invalido(reply);
    const u = uid(req);
    return responder(iniciarTarefa(u, async () => {
      const projeto = b.data.projetoId ? await prisma.linkedinProjeto.findFirst({ where: { id: b.data.projetoId, usuarioId: u } }) : null;
      const contexto = await contextoDaJornada(u, b.data.estudo, b.data.incluirDiario);
      const briefing = projeto
        ? `${b.data.briefing}\n\nEste post faz parte do projeto "${projeto.nome}"${projeto.objetivo ? ` (objetivo: ${projeto.objetivo})` : ''}. Dê continuidade aos posts anteriores do projeto, sem repetir.`
        : b.data.briefing;
      return gerarRascunho({ briefing, pilar: b.data.pilar ?? projeto?.pilar ?? undefined, formato: b.data.formato, contexto, notas: b.data.notas });
    }), reply);
  });

  app.post('/api/linkedin/tarefas/refinar', async (req, reply) => {
    const b = RefinarInSchema.safeParse(req.body);
    if (!b.success) return invalido(reply);
    if (b.data.acao === 'livre' && !b.data.instrucao) return reply.status(400).send({ error: 'Diga o que a IA deve mudar.' });
    if (textoDoPost(b.data.gancho, b.data.corpo).length < 40) return reply.status(400).send({ error: 'Escreva um pouco mais antes de pedir um refino.' });
    return responder(iniciarTarefa(uid(req), () => refinarTexto(b.data)), reply);
  });

  const Planejar = z.object({
    inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dias: z.number().int().min(3).max(21),
    estudo: z.string().max(20_000),
  });
  app.post('/api/linkedin/tarefas/planejar', async (req, reply) => {
    const b = Planejar.safeParse(req.body);
    if (!b.success) return invalido(reply);
    const u = uid(req);
    return responder(iniciarTarefa(u, async () => {
      const fuso = fusoDoLinkedin();
      const hoje = diaLocal(new Date(), fuso);
      const [contexto, estrategia, projetos, ideias, posts, agendados] = await Promise.all([
        contextoDaJornada(u, b.data.estudo, true),
        estrategiaDe(u),
        prisma.linkedinProjeto.findMany({ where: { usuarioId: u, status: 'ativo' } }),
        prisma.linkedinIdeia.findMany({ where: { usuarioId: u, status: 'nova' }, orderBy: { criadoEm: 'desc' }, take: 30 }),
        prisma.linkedinPost.findMany({ where: { usuarioId: u }, select: { publicadoEm: true, projetoId: true, analise: true } }),
        prisma.post.findMany({ where: { usuarioId: u, status: 'agendado', agendadoPara: { not: null } }, select: { agendadoPara: true } }),
      ]);
      const dias = (de: string) => Math.round((Date.parse(hoje) - Date.parse(de)) / 86_400_000);
      const ultimoPorProjeto = new Map<string, string>();
      for (const p of posts) if (p.projetoId && (ultimoPorProjeto.get(p.projetoId) ?? '') < p.publicadoEm) ultimoPorProjeto.set(p.projetoId, p.publicadoEm);
      const recentes = new Set(posts.filter((p) => dias(p.publicadoEm) <= 30).map((p) => (p.analise as { pilar?: string } | null)?.pilar).filter(Boolean));
      const nomeProjeto = new Map(projetos.map((p) => [p.id, p.nome]));
      const sugestoes = await planejarPauta({
        contexto, inicio: b.data.inicio, dias: b.data.dias,
        projetos: projetos.map((p) => ({ id: p.id, nome: p.nome, objetivo: p.objetivo, pilar: p.pilar, diasSemPost: ultimoPorProjeto.has(p.id) ? dias(ultimoPorProjeto.get(p.id) as string) : null })),
        ideias: ideias.map((i) => ({ titulo: i.titulo, projeto: i.projetoId ? nomeProjeto.get(i.projetoId) ?? null : null })),
        pilaresEsquecidos: estrategia.pilares.filter((p) => !recentes.has(p)),
        diasOcupados: agendados.flatMap((a) => (a.agendadoPara ? [diaLocal(a.agendadoPara, fuso)] : [])),
      });
      return { sugestoes };
    }), reply);
  });

  app.get('/api/linkedin/tarefas/:id', async (req, reply) => {
    const t = tarefas.get(idDe(req));
    if (!t || t.usuarioId !== uid(req)) return reply.status(404).send({ error: 'Tarefa não encontrada (a API pode ter reiniciado). Tente de novo.' });
    return { id: t.id, status: t.status, resultado: t.resultado, erro: t.erro } satisfies TarefaIA;
  });

  // ===================== conta do LinkedIn =====================
  app.get('/api/linkedin/conta', async (req) => statusDaConta(uid(req)));

  // Passo 1: o front pede a URL de autorização e navega até ela.
  app.get('/api/linkedin/conta/connect', async (req, reply) => {
    if (variaveisFaltando().length > 0) return reply.status(503).send({ error: 'Conexão com o LinkedIn não configurada no servidor.' });
    return { url: iniciarAutorizacao(uid(req)) };
  });

  // Passo 2: o LinkedIn devolve o navegador aqui, ainda com a sessão do Access.
  app.get('/api/linkedin/conta/callback', async (req, reply) => {
    const q = z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() }).safeParse(req.query);
    if (!q.success || q.data.error || !q.data.code || !q.data.state) return reply.redirect('/posts?linkedin=erro');
    try {
      await concluirAutorizacao(q.data.code, q.data.state, uid(req));
      return reply.redirect('/posts?linkedin=conectado');
    } catch (e) {
      req.log.warn({ err: (e as Error).message }, 'linkedin: falha ao concluir a autorização');
      return reply.redirect('/posts?linkedin=erro');
    }
  });

  app.post('/api/linkedin/conta/disconnect', async (req) => {
    await desconectar(uid(req));
    // o que estava agendado para sair pela API passa a ser lembrete
    await prisma.post.updateMany({ where: { usuarioId: uid(req), status: 'agendado', canal: 'api' }, data: { canal: 'lembrete' } });
    return { ok: true };
  });
}
