/**
 * Restaura uma exportação já decifrada em um PostgreSQL NOVO e descartável.
 *
 * Configure RESTORE_TARGET_DATABASE_URL para um banco cujo nome comece por
 * `seginfo_restore_`, aplique as migrations nele e execute:
 *   npx tsx src/tools/restore-backup.ts <saida.json>
 *
 * A ferramenta recusa banco que já tenha usuário e nunca apaga registros.
 */
import 'dotenv/config';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const [, , arquivo] = process.argv;
const targetUrl = process.env.RESTORE_TARGET_DATABASE_URL;
if (!arquivo || !targetUrl) {
  console.error('Uso: RESTORE_TARGET_DATABASE_URL=<url> npx tsx src/tools/restore-backup.ts <saida.json>');
  process.exit(1);
}

function validarDestino(raw: string) {
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^seginfo_restore_[a-z0-9_]+$/i.test(database)) {
    throw new Error('Destino recusado: o nome do banco precisa começar com seginfo_restore_.');
  }
}

const Identidade = z.object({ id: z.string().min(1), email: z.string().email() });
const Progresso = z.object({ id: z.string(), usuarioId: z.string(), topicoId: z.string(), status: z.string(), anotacoes: z.string(), atualizadoEm: z.coerce.date().optional() });
  const Sessao = z.object({ id: z.string(), usuarioId: z.string(), data: z.string(), trilhaId: z.string().nullable(), topicoId: z.string().nullable(), labId: z.string().nullable().optional(), minutos: z.number().int().positive(), nota: z.string(), criadoEm: z.coerce.date().optional() });
const Meta = z.object({ id: z.string(), usuarioId: z.string(), titulo: z.string(), trilhaId: z.string().nullable(), prazo: z.string(), concluida: z.boolean(), criadoEm: z.coerce.date().optional() });
const Post = z.object({ id: z.string(), usuarioId: z.string(), titulo: z.string(), gancho: z.string(), corpo: z.string(), direcaoVisual: z.string().default(''), textoAlternativo: z.string().default(''), roteiroSlides: z.string().default(''), topicoId: z.string().nullable(), publicado: z.boolean(), criadoEm: z.coerce.date().optional() });
const Arsenal = z.object({ id: z.string(), usuarioId: z.string(), tipo: z.string(), nome: z.string(), slug: z.string(), dominio: z.string(), resumo: z.string(), conteudo: z.string(), quandoUsar: z.string(), requisitos: z.array(z.string()), tags: z.array(z.string()), artefatos: z.unknown(), favorito: z.boolean(), criadoEm: z.coerce.date().optional(), atualizadoEm: z.coerce.date().optional() });
const Biblioteca = z.object({ id: z.string(), usuarioId: z.string(), url: z.string().url(), titulo: z.string(), dominio: z.string(), textoOriginal: z.string(), resumo: z.string(), palavrasChave: z.array(z.string()), categoria: z.string(), tags: z.array(z.string()), estado: z.string(), favorito: z.boolean(), anotacoes: z.string(), topicoId: z.string().nullable(), fonteResumo: z.string(), criadoEm: z.coerce.date().optional(), atualizadoEm: z.coerce.date().optional() });
const Cofre = z.object({ usuarioId: z.string(), versao: z.number().int(), salt: z.string(), iv: z.string(), ciphertext: z.string(), autoLockMin: z.number().int(), atualizadoEm: z.coerce.date().optional() }).nullable();
const Ataque = z.object({ id: z.string(), usuarioId: z.string(), fonte: z.string(), ocorridoEm: z.coerce.date(), ipOrigem: z.string().nullable(), paisOrigem: z.string().nullable(), portaDestino: z.number().int().nullable(), protocolo: z.string().nullable(), servico: z.string().nullable(), acao: z.string(), usuarioTentado: z.string().nullable(), senhaTentada: z.string().nullable(), alvo: z.string().nullable(), detalhes: z.unknown(), dedupKey: z.string(), criadoEm: z.coerce.date().optional() });
const Memoria = z.object({ id: z.string(), usuarioId: z.string(), titulo: z.string(), conteudo: z.string(), tags: z.array(z.string()), origem: z.string(), urlOrigem: z.string().nullable(), escopo: z.string(), excluirEm: z.coerce.date().nullable(), criadoEm: z.coerce.date().optional(), atualizadoEm: z.coerce.date().optional() });
const LinkedinPost = z.object({ id: z.string(), usuarioId: z.string(), url: z.string(), urlNormalizada: z.string(), publicadoEm: z.string(), texto: z.string(), formato: z.string(), metricas: z.unknown(), origem: z.string(), analise: z.unknown().nullable(), memoriaId: z.string().nullable(), criadoEm: z.coerce.date().optional(), atualizadoEm: z.coerce.date().optional() });
const DiarioEntrada = z.object({ id: z.string(), usuarioId: z.string(), data: z.string(), titulo: z.string(), descricao: z.string(), categoria: z.string(), tags: z.array(z.string()), criadoEm: z.coerce.date().optional() });
const LinkedinEstrategia = z.object({ usuarioId: z.string(), objetivo: z.string(), publico: z.string(), voz: z.string(), pilares: z.array(z.string()), atualizadoEm: z.coerce.date().optional() }).nullable();
const Agente = z.object({ id: z.string(), usuarioId: z.string(), nome: z.string(), resumo: z.string(), status: z.string(), config: z.unknown(), criadoEm: z.coerce.date().optional(), atualizadoEm: z.coerce.date().optional() });
const AgenteAvaliacao = z.object({ id: z.string(), usuarioId: z.string(), agenteId: z.string(), caso: z.string(), criterio: z.string(), resultado: z.string(), latenciaMs: z.number().int().nullable(), observacao: z.string(), criadoEm: z.coerce.date().optional() });
const AgenteExecucao = z.object({
  id: z.string(), usuarioId: z.string(), agenteId: z.string(), status: z.string(), entrada: z.string(), resposta: z.string(), erro: z.string(),
  modelo: z.string(), passos: z.unknown(), mensagens: z.unknown(), pendencia: z.unknown().nullable(),
  tokensEntrada: z.number().int(), tokensSaida: z.number().int(), duracaoMs: z.number().int(),
  criadoEm: z.coerce.date().optional(), atualizadoEm: z.coerce.date().optional(),
});

const Exportacao = z.object({
  formato: z.literal('seginfo-export'), versao: z.literal(1), usuario: Identidade.optional(),
  progresso: z.array(Progresso), sessoes: z.array(Sessao), metas: z.array(Meta), posts: z.array(Post),
  arsenal: z.array(Arsenal), biblioteca: z.array(Biblioteca), cofre: Cofre,
  ataques: z.array(Ataque), memorias: z.array(Memoria),
  // LinkedIn (backups anteriores a 2026-11-11 não têm estas chaves)
  linkedinPosts: z.array(LinkedinPost).default([]), diario: z.array(DiarioEntrada).default([]),
  linkedinEstrategia: LinkedinEstrategia.default(null),
  // Agentes (backups anteriores a 2026-11-14 não têm execuções; os mais antigos, nem agentes)
  agentes: z.array(Agente).default([]), agenteAvaliacoes: z.array(AgenteAvaliacao).default([]),
  agenteExecucoes: z.array(AgenteExecucao).default([]),
});

try {
  validarDestino(targetUrl);
  const { readFileSync } = await import('node:fs');
  const parsed = Exportacao.safeParse(JSON.parse(readFileSync(arquivo, 'utf8')));
  if (!parsed.success) throw new Error(`Exportação inválida: ${parsed.error.issues[0]?.path.join('.') || 'formato'}`);
  const backup = parsed.data;
  const rows = [...backup.progresso, ...backup.sessoes, ...backup.metas, ...backup.posts,
    ...backup.arsenal, ...backup.biblioteca, ...backup.ataques, ...backup.memorias,
    ...backup.linkedinPosts, ...backup.diario, ...backup.agentes, ...backup.agenteAvaliacoes, ...backup.agenteExecucoes];
  const userIds = new Set([...rows.map((r) => r.usuarioId), ...(backup.cofre ? [backup.cofre.usuarioId] : []), ...(backup.linkedinEstrategia ? [backup.linkedinEstrategia.usuarioId] : [])]);
  const userId = backup.usuario?.id ?? [...userIds][0];
  const email = backup.usuario?.email ?? process.env.RESTORE_USER_EMAIL;
  if (!userId || userIds.size > 1 || [...userIds].some((id) => id !== userId)) {
    throw new Error('A exportação não identifica um único usuário. Gere um backup atualizado.');
  }
  if (!email || !z.string().email().safeParse(email).success) {
    throw new Error('E-mail do usuário ausente; defina RESTORE_USER_EMAIL para exportações antigas.');
  }

  process.env.DATABASE_URL = targetUrl;
  const { prisma } = await import('../db.js');
  try {
    const existentes = await prisma.usuario.count();
    if (existentes !== 0) throw new Error('Destino recusado: o banco já contém usuários; esta ferramenta restaura apenas em banco vazio.');

    const pessoal = backup.memorias.filter((m) => m.escopo !== 'corporativo');
    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.usuario.create({ data: { id: userId, email } }),
      prisma.progresso.createMany({ data: backup.progresso }),
      prisma.sessao.createMany({ data: backup.sessoes }),
      prisma.meta.createMany({ data: backup.metas }),
      prisma.post.createMany({ data: backup.posts }),
      prisma.arsenalItem.createMany({ data: backup.arsenal.map((i) => ({ ...i, artefatos: i.artefatos as Prisma.InputJsonValue })) }),
      prisma.biblioItem.createMany({ data: backup.biblioteca }),
      prisma.ataqueEvento.createMany({ data: backup.ataques.map((i) => ({ ...i, detalhes: i.detalhes as Prisma.InputJsonValue })) }),
      prisma.memoria.createMany({ data: pessoal }),
    ];
    // memoriaId só é mantido se a nota também foi restaurada
    const memoriasRestauradas = new Set(pessoal.map((m) => m.id));
    ops.push(
      prisma.linkedinPost.createMany({
        data: backup.linkedinPosts.map((p) => ({
          ...p,
          metricas: p.metricas as Prisma.InputJsonValue,
          analise: p.analise === null ? Prisma.DbNull : (p.analise as Prisma.InputJsonValue),
          memoriaId: p.memoriaId && memoriasRestauradas.has(p.memoriaId) ? p.memoriaId : null,
        })),
      }),
      prisma.diarioEntrada.createMany({ data: backup.diario }),
    );
    if (backup.linkedinEstrategia) ops.push(prisma.linkedinEstrategia.create({ data: backup.linkedinEstrategia }));
    if (backup.cofre) ops.push(prisma.cofreBlob.create({ data: backup.cofre }));
    // agentes antes das avaliações e execuções (chave estrangeira agenteId); órfãos são descartados
    const agentesRestaurados = new Set(backup.agentes.map((a) => a.id));
    const json = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));
    ops.push(
      prisma.agente.createMany({ data: backup.agentes.map((a) => ({ ...a, config: a.config as Prisma.InputJsonValue })) }),
      prisma.agenteAvaliacao.createMany({ data: backup.agenteAvaliacoes.filter((a) => agentesRestaurados.has(a.agenteId)) }),
      prisma.agenteExecucao.createMany({
        data: backup.agenteExecucoes.filter((e) => agentesRestaurados.has(e.agenteId)).map((e) => ({
          ...e,
          passos: (e.passos ?? []) as Prisma.InputJsonValue,
          mensagens: (e.mensagens ?? []) as Prisma.InputJsonValue,
          pendencia: json(e.pendencia),
        })),
      }),
    );
    await prisma.$transaction(ops);

    const [progresso, sessoes, metas, posts, arsenal, biblioteca, ataques, memorias, cofre, agentes, agenteAvaliacoes, agenteExecucoes] = await Promise.all([
      prisma.progresso.count({ where: { usuarioId: userId } }), prisma.sessao.count({ where: { usuarioId: userId } }),
      prisma.meta.count({ where: { usuarioId: userId } }), prisma.post.count({ where: { usuarioId: userId } }),
      prisma.arsenalItem.count({ where: { usuarioId: userId } }), prisma.biblioItem.count({ where: { usuarioId: userId } }),
      prisma.ataqueEvento.count({ where: { usuarioId: userId } }), prisma.memoria.count({ where: { usuarioId: userId } }),
      prisma.cofreBlob.count({ where: { usuarioId: userId } }), prisma.agente.count({ where: { usuarioId: userId } }),
      prisma.agenteAvaliacao.count({ where: { usuarioId: userId } }), prisma.agenteExecucao.count({ where: { usuarioId: userId } }),
    ]);
    console.log(JSON.stringify({ ok: true, usuario: email, restaurado: { progresso, sessoes, metas, posts, arsenal, biblioteca, ataques, memorias, cofre, agentes, agenteAvaliacoes, agenteExecucoes } }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
} catch (error) {
  console.error(`Restauração interrompida: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
}
