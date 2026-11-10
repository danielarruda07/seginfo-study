import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';
import { extractUrl } from './extract.js';
import { origemOk } from './storage-routes.js';

/**
 * Segundo Cérebro: notas ("memórias") com busca por relevância (BM25) que devolve TRECHOS
 * com a fonte. Registrado DENTRO do plugin de rotas de estado, então herda o hook que exige
 * identidade verificada do Cloudflare Access.
 *
 * - Exclusão AGENDADA: fica na lixeira por CARENCIA_DIAS e pode ser resgatada.
 * - Conteúdo capturado da web é DADO NÃO CONFIÁVEL: nunca é interpretado como instrução.
 * - Memórias `corporativo` ficam fora do backup para o OneDrive pessoal (ver backup.ts).
 */

const CARENCIA_DIAS = 7;
const MAX_CONTEUDO = 200_000;

// ---------- validação (sem defaults: um PATCH não pode sobrescrever campos ausentes) ----------
const Titulo = z.string().trim().min(1).max(200);
const Conteudo = z.string().max(MAX_CONTEUDO);
const Tags = z.array(z.string().trim().min(1).max(40)).max(20);
const Escopo = z.enum(['pessoal', 'corporativo']);

const Criar = z.object({
  titulo: Titulo, conteudo: Conteudo.optional(), tags: Tags.optional(), escopo: Escopo.optional(),
});
const Editar = z.object({
  titulo: Titulo.optional(), conteudo: Conteudo.optional(), tags: Tags.optional(), escopo: Escopo.optional(),
});
const Importar = z.object({
  notas: z.array(z.object({ titulo: Titulo, conteudo: Conteudo, tags: Tags.optional() })).min(1).max(200),
  escopo: Escopo.optional(),
});

const limparTags = (t: string[] | undefined) => [...new Set((t ?? []).map((x) => x.toLowerCase()))];

// ---------- busca BM25 sobre trechos ----------
const STOP = new Set([
  'a', 'o', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'e', 'ou',
  'que', 'com', 'por', 'para', 'se', 'ao', 'como', 'mais', 'mas', 'the', 'and', 'of', 'to', 'in', 'is', 'for',
  'on', 'it', 'this', 'that',
]);

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function tokenizar(s: string): string[] {
  return normalizar(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)) // plural simples
    .filter((w) => w.length > 1 && !STOP.has(w));
}

function dividir(conteudo: string, alvo = 700): string[] {
  const paragrafos = conteudo.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let atual = '';
  for (const p of paragrafos) {
    if (p.length > alvo * 1.5) {
      if (atual) { out.push(atual); atual = ''; }
      for (let i = 0; i < p.length; i += alvo) out.push(p.slice(i, i + alvo));
      continue;
    }
    if (atual && atual.length + p.length > alvo) { out.push(atual); atual = p; }
    else atual = atual ? `${atual}\n\n${p}` : p;
  }
  if (atual) out.push(atual);
  return out.length > 0 ? out : [''];
}

interface Trecho {
  memoriaId: string; titulo: string; tags: string[]; escopo: string; texto: string;
  tf: Map<string, number>; len: number;
}
interface Indice { chunks: Trecho[]; df: Map<string, number>; avgLen: number }

function construir(memorias: { id: string; titulo: string; conteudo: string; tags: string[]; escopo: string }[]): Indice {
  const chunks: Trecho[] = [];
  const df = new Map<string, number>();
  for (const m of memorias) {
    const base = tokenizar(`${m.titulo} ${m.tags.join(' ')}`); // título e tags valem para todos os trechos
    for (const texto of dividir(m.conteudo)) {
      const tokens = [...base, ...tokenizar(texto)];
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
      chunks.push({ memoriaId: m.id, titulo: m.titulo, tags: m.tags, escopo: m.escopo, texto, tf, len: tokens.length });
    }
  }
  const avgLen = chunks.length > 0 ? chunks.reduce((a, c) => a + c.len, 0) / chunks.length : 1;
  return { chunks, df, avgLen };
}

function pesquisar(ind: Indice, consulta: string, limite: number) {
  const termos = [...new Set(tokenizar(consulta))];
  if (termos.length === 0) return [];
  const N = ind.chunks.length;
  const K1 = 1.5;
  const B = 0.75;
  const pontuados: { c: Trecho; score: number }[] = [];
  for (const c of ind.chunks) {
    let score = 0;
    for (const t of termos) {
      const f = c.tf.get(t);
      if (!f) continue;
      const n = ind.df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += (idf * (f * (K1 + 1))) / (f + K1 * (1 - B + (B * c.len) / ind.avgLen));
    }
    if (score > 0) pontuados.push({ c, score });
  }
  pontuados.sort((x, y) => y.score - x.score);

  // no máximo 2 trechos por memória, para a lista não ser dominada por uma nota só
  const porMemoria = new Map<string, number>();
  const out: { c: Trecho; score: number }[] = [];
  for (const p of pontuados) {
    const n = porMemoria.get(p.c.memoriaId) ?? 0;
    if (n >= 2) continue;
    porMemoria.set(p.c.memoriaId, n + 1);
    out.push(p);
    if (out.length >= limite) break;
  }
  return out;
}

// índice por usuário, reconstruído só quando o conjunto de memórias muda
const cache = new Map<string, { sig: string; indice: Indice }>();

async function obterIndice(usuarioId: string): Promise<Indice> {
  const where = { usuarioId, excluirEm: null };
  const [total, max] = await Promise.all([
    prisma.memoria.count({ where }),
    prisma.memoria.aggregate({ where, _max: { atualizadoEm: true } }),
  ]);
  const sig = `${total}|${max._max.atualizadoEm?.toISOString() ?? ''}`;
  const atual = cache.get(usuarioId);
  if (atual && atual.sig === sig) return atual.indice;

  const memorias = await prisma.memoria.findMany({
    where, select: { id: true, titulo: true, conteudo: true, tags: true, escopo: true },
  });
  const indice = construir(memorias);
  cache.set(usuarioId, { sig, indice });
  return indice;
}

// ---------- limpeza da lixeira ----------
/** Apaga de vez as memórias cuja carência venceu. Roda ao subir (após 2 min) e a cada hora. */
export function iniciarLimpezaMemorias(app: FastifyInstance) {
  if (!process.env.DATABASE_URL) return;
  const limpar = async () => {
    try {
      const r = await prisma.memoria.deleteMany({ where: { excluirEm: { lt: new Date() } } });
      if (r.count > 0) app.log.info({ removidas: r.count }, 'cérebro: memórias vencidas removidas da lixeira');
    } catch (e) {
      app.log.warn({ err: (e as Error).message }, 'cérebro: falha ao limpar a lixeira');
    }
  };
  const intervalo = setInterval(limpar, 3_600_000);
  const inicial = setTimeout(limpar, 120_000);
  intervalo.unref();
  inicial.unref();
  app.addHook('onClose', async () => {
    clearInterval(intervalo);
    clearTimeout(inicial);
  });
}

// ---------- rotas ----------
export async function registerMemoriaRoutes(app: FastifyInstance) {
  const uid = (req: unknown) => (req as AuthedRequest).usuarioId;
  const idDe = (req: unknown) => (req as { params: { id: string } }).params.id;

  const ListaQuery = z.object({
    tag: z.string().max(40).optional(),
    escopo: Escopo.optional(),
    lixeira: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  });

  app.get('/api/memorias', async (req, reply) => {
    const q = ListaQuery.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: 'parâmetros inválidos' });
    const { tag, escopo, lixeira, page, limit } = q.data;

    const where = {
      usuarioId: uid(req),
      excluirEm: lixeira === 'true' ? { not: null } : null,
      ...(tag ? { tags: { has: tag.toLowerCase() } } : {}),
      ...(escopo ? { escopo } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.memoria.count({ where }),
      prisma.memoria.findMany({
        where, orderBy: { atualizadoEm: 'desc' }, skip: page * limit, take: limit,
        select: {
          id: true, titulo: true, conteudo: true, tags: true, origem: true, urlOrigem: true,
          escopo: true, excluirEm: true, atualizadoEm: true,
        },
      }),
    ]);
    return {
      total,
      items: rows.map(({ conteudo, ...m }) => ({ ...m, preview: conteudo.slice(0, 240) })),
    };
  });

  const BuscaQuery = z.object({ q: z.string().trim().min(1).max(200), limit: z.coerce.number().int().min(1).max(20).default(8) });

  app.get('/api/memorias/busca', async (req, reply) => {
    const q = BuscaQuery.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: 'informe o que buscar' });
    const indice = await obterIndice(uid(req));
    return {
      resultados: pesquisar(indice, q.data.q, q.data.limit).map(({ c, score }) => ({
        memoriaId: c.memoriaId, titulo: c.titulo, tags: c.tags, escopo: c.escopo,
        trecho: c.texto.slice(0, 600), score: Math.round(score * 100) / 100,
      })),
    };
  });

  app.get('/api/memorias/:id', async (req, reply) => {
    const m = await prisma.memoria.findFirst({ where: { id: idDe(req), usuarioId: uid(req) } });
    if (!m) return reply.status(404).send({ error: 'não encontrada' });
    return m;
  });

  app.post('/api/memorias', async (req, reply) => {
    if (!origemOk(req)) return reply.status(403).send({ error: 'Origem não permitida.' });
    const b = Criar.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    return prisma.memoria.create({
      data: {
        usuarioId: uid(req), titulo: b.data.titulo, conteudo: b.data.conteudo ?? '',
        tags: limparTags(b.data.tags), escopo: b.data.escopo ?? 'pessoal', origem: 'manual',
      },
    });
  });

  app.patch('/api/memorias/:id', async (req, reply) => {
    if (!origemOk(req)) return reply.status(403).send({ error: 'Origem não permitida.' });
    const b = Editar.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const r = await prisma.memoria.updateMany({
      where: { id: idDe(req), usuarioId: uid(req), excluirEm: null }, // item na lixeira não se edita
      data: {
        titulo: b.data.titulo, conteudo: b.data.conteudo, escopo: b.data.escopo,
        tags: b.data.tags ? limparTags(b.data.tags) : undefined,
      },
    });
    if (r.count === 0) return reply.status(404).send({ error: 'não encontrada' });
    return { ok: true };
  });

  // "Excluir" só AGENDA: o item vai para a lixeira e some de vez após a carência.
  app.delete('/api/memorias/:id', async (req, reply) => {
    if (!origemOk(req)) return reply.status(403).send({ error: 'Origem não permitida.' });
    const excluirEm = new Date(Date.now() + CARENCIA_DIAS * 86_400_000);
    const r = await prisma.memoria.updateMany({
      where: { id: idDe(req), usuarioId: uid(req), excluirEm: null }, data: { excluirEm },
    });
    if (r.count === 0) return reply.status(404).send({ error: 'não encontrada' });
    return { ok: true, excluirEm };
  });

  app.post('/api/memorias/:id/resgatar', async (req, reply) => {
    if (!origemOk(req)) return reply.status(403).send({ error: 'Origem não permitida.' });
    const r = await prisma.memoria.updateMany({
      where: { id: idDe(req), usuarioId: uid(req), excluirEm: { not: null } }, data: { excluirEm: null },
    });
    if (r.count === 0) return reply.status(404).send({ error: 'não encontrada na lixeira' });
    return { ok: true };
  });

  // Captura uma página web (busca server-side, com a proteção anti-SSRF do extrator).
  app.post('/api/memorias/capturar-url', async (req, reply) => {
    if (!origemOk(req)) return reply.status(403).send({ error: 'Origem não permitida.' });
    const b = z.object({ url: z.string().url(), tags: Tags.optional() }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'Informe uma URL válida.' });
    try {
      const r = await extractUrl(b.data.url);
      const corpo = [r.descricao, r.texto].filter(Boolean).join('\n\n').slice(0, MAX_CONTEUDO);
      return await prisma.memoria.create({
        data: {
          usuarioId: uid(req), titulo: (r.titulo || r.dominio).slice(0, 200), conteudo: corpo,
          tags: limparTags(b.data.tags), origem: 'url', urlOrigem: r.finalUrl, escopo: 'pessoal',
        },
      });
    } catch (e) {
      const err = e as Error & { statusCode?: number };
      return reply.status(err.statusCode ?? 502).send({ error: err.message });
    }
  });

  // Importação em lote (ex.: notas .md de um cofre do Obsidian).
  app.post('/api/memorias/importar', { bodyLimit: 10 * 1024 * 1024 }, async (req, reply) => {
    if (!origemOk(req)) return reply.status(403).send({ error: 'Origem não permitida.' });
    const b = Importar.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'payload inválido' });
    const escopo = b.data.escopo ?? 'pessoal';
    const r = await prisma.memoria.createMany({
      data: b.data.notas.map((n) => ({
        usuarioId: uid(req), titulo: n.titulo, conteudo: n.conteudo, tags: limparTags(n.tags),
        origem: 'cofre', escopo,
      })),
    });
    return { ok: true, importadas: r.count };
  });
}
