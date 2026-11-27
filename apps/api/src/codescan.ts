import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { AuthedRequest } from './auth.js';
import { prisma } from './db.js';

/**
 * Revisão de segurança de código com o plugin oficial `claude-security`.
 *
 * A API NÃO roda a varredura: ela enfileira o pedido, entrega ao worker (Linux, sandbox,
 * fora do container — ver infra/codescan-worker) e guarda o resultado. O worker devolve o
 * SARIF (padrão da indústria) que normalizamos aqui, o relatório em Markdown e os patches.
 *
 * Duas superfícies:
 *  - operador (atrás do Access + requireUser): /api/codigo/varreduras*
 *  - worker  (Service Token do Access + X-Worker-Token): /api/scan/ci/codigo/*
 *    O prefixo /api/scan/ci reaproveita a aplicação Access do gate de CI (path api/scan/ci).
 */

export type SevCodigo = 'critica' | 'alta' | 'media' | 'baixa' | 'info';
export type ModoVarredura = 'codebase' | 'changes' | 'attack-surface';

export interface AchadoCodigo {
  id: string;
  regra: string;
  titulo: string;
  severidade: SevCodigo;
  cwe: string[];
  arquivo: string | null;
  linha: number | null;
  mensagem: string;
  recomendacao: string | null;
  confianca: string | null;
}

export interface PatchCodigo { nome: string; conteudo: string; nota: string | null }

const MAX_PATCHES = 60;
const MAX_PATCH_BYTES = 200_000;
const MAX_MD_BYTES = 2_000_000;
const MAX_ACHADOS = 1_000;
/** Pedido em execução há mais que isto é considerado perdido (worker caiu). */
const LIMITE_EXECUCAO_MS = 4 * 3_600_000;

// ---------- validação (pura) ----------

/**
 * Aceita só URLs de git seguras para `git clone`:
 *  - https://host/caminho
 *  - git@host:caminho  ou  ssh://git@host/caminho
 * Recusa transportes que executam comando (ext::, fd::), file://, caminhos locais,
 * opções disfarçadas (começando com "-"), espaço e caracteres de controle.
 */
export function validarRepoUrl(url: string): { ok: true } | { ok: false; motivo: string } {
  const u = url.trim();
  if (!u || u.length > 400) return { ok: false, motivo: 'URL vazia ou longa demais' };
  if (u.startsWith('-')) return { ok: false, motivo: 'URL não pode começar com "-"' };
  if (/[\s\x00-\x1f\x7f]/.test(u)) return { ok: false, motivo: 'URL com espaço ou caractere de controle' };
  if (u.includes('::')) return { ok: false, motivo: 'transporte "::" (ext/fd) não é permitido' };
  if (/^https:\/\/[A-Za-z0-9.-]+(:\d+)?\/[\w.@/~%+-]+$/.test(u)) return { ok: true };
  if (/^git@[A-Za-z0-9.-]+:[\w.@/~%+-]+$/.test(u)) return { ok: true };
  if (/^ssh:\/\/git@[A-Za-z0-9.-]+(:\d+)?\/[\w.@/~%+-]+$/.test(u)) return { ok: true };
  return { ok: false, motivo: 'use https://host/dono/repo ou git@host:dono/repo' };
}

/** Nome de branch seguro (sem opção disfarçada, sem ".." nem caracteres especiais). */
export function validarBranch(b: string): boolean {
  return /^[A-Za-z0-9._/-]{1,200}$/.test(b) && !b.startsWith('-') && !b.includes('..') && !b.endsWith('/');
}

// ---------- SARIF → achados (puro) ----------

/** Severidade a partir de `security-severity` (CVSS 0–10) ou do `level` SARIF. */
export function severidadeSarif(securitySeverity: unknown, level: unknown): SevCodigo {
  const n = typeof securitySeverity === 'number' ? securitySeverity : Number.parseFloat(String(securitySeverity ?? ''));
  if (Number.isFinite(n)) {
    if (n >= 9) return 'critica';
    if (n >= 7) return 'alta';
    if (n >= 4) return 'media';
    if (n > 0) return 'baixa';
    return 'info';
  }
  switch (String(level ?? '')) {
    case 'error': return 'alta';
    case 'warning': return 'media';
    case 'note': return 'baixa';
    default: return 'info';
  }
}

const texto = (v: unknown): string | null => {
  if (!v || typeof v !== 'object') return typeof v === 'string' ? v : null;
  const o = v as { text?: unknown; markdown?: unknown };
  return typeof o.text === 'string' ? o.text : typeof o.markdown === 'string' ? o.markdown : null;
};

/** Extrai CWEs de tags como "external/cwe/cwe-89", "CWE-89" ou "cwe:89". */
export function extrairCwes(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const out = new Set<string>();
  for (const t of tags) {
    const m = /cwe[-/:]?\s*(\d{1,5})/i.exec(String(t));
    if (m) out.add(`CWE-${m[1]}`);
  }
  return [...out];
}

const ORDEM: Record<SevCodigo, number> = { critica: 0, alta: 1, media: 2, baixa: 3, info: 4 };

/** Normaliza um documento SARIF 2.1.0 em achados. Tolerante a campos ausentes. */
export function normalizarSarif(sarif: unknown): AchadoCodigo[] {
  const runs = (sarif as { runs?: unknown[] })?.runs;
  if (!Array.isArray(runs)) return [];
  const achados: AchadoCodigo[] = [];
  for (const run of runs as Record<string, unknown>[]) {
    const regras = ((run.tool as { driver?: { rules?: unknown[] } })?.driver?.rules ?? []) as Record<string, unknown>[];
    const porId = new Map(regras.map((r) => [String(r.id ?? ''), r]));
    const results = Array.isArray(run.results) ? (run.results as Record<string, unknown>[]) : [];
    results.forEach((res, i) => {
      const regraId = String(res.ruleId ?? '');
      const regra = (typeof res.ruleIndex === 'number' ? regras[res.ruleIndex] : undefined) ?? porId.get(regraId) ?? {};
      const props = (res.properties ?? {}) as Record<string, unknown>;
      const rprops = (regra.properties ?? {}) as Record<string, unknown>;
      const loc = (Array.isArray(res.locations) ? res.locations[0] : undefined) as { physicalLocation?: { artifactLocation?: { uri?: string }; region?: { startLine?: number } } } | undefined;
      const fisica = loc?.physicalLocation;
      achados.push({
        id: String(props.claudeSecurityPluginFindingId ?? props.findingId ?? props.id ?? (regraId || `R${i + 1}`)),
        regra: regraId,
        titulo: texto(regra.shortDescription) ?? (typeof regra.name === 'string' ? regra.name : null) ?? (regraId || 'Achado'),
        severidade: severidadeSarif(props['security-severity'] ?? rprops['security-severity'], res.level ?? (regra.defaultConfiguration as { level?: string } | undefined)?.level),
        cwe: extrairCwes([...(Array.isArray(rprops.tags) ? rprops.tags : []), ...(Array.isArray(props.tags) ? props.tags : [])]),
        arquivo: typeof fisica?.artifactLocation?.uri === 'string' ? fisica.artifactLocation.uri : null,
        linha: typeof fisica?.region?.startLine === 'number' ? fisica.region.startLine : null,
        mensagem: texto(res.message) ?? '',
        recomendacao: texto(regra.help) ?? texto(regra.fullDescription),
        confianca: typeof props.confidence === 'string' ? props.confidence : typeof rprops.precision === 'string' ? rprops.precision : null,
      });
    });
  }
  return achados.sort((a, b) => ORDEM[a.severidade] - ORDEM[b.severidade]).slice(0, MAX_ACHADOS);
}

export function resumoDosAchados(achados: { severidade: SevCodigo }[]): Record<SevCodigo, number> {
  const r: Record<SevCodigo, number> = { critica: 0, alta: 0, media: 0, baixa: 0, info: 0 };
  for (const a of achados) r[a.severidade]++;
  return r;
}

/** Mantém só patches com nome seguro e tamanho razoável. */
export function sanearPatches(entrada: unknown): PatchCodigo[] {
  if (!Array.isArray(entrada)) return [];
  const out: PatchCodigo[] = [];
  for (const p of entrada.slice(0, MAX_PATCHES)) {
    const o = p as { nome?: unknown; conteudo?: unknown; nota?: unknown };
    if (typeof o.nome !== 'string' || !/^[\w.-]{1,80}\.patch$/.test(o.nome)) continue;
    if (typeof o.conteudo !== 'string' || o.conteudo.length > MAX_PATCH_BYTES) continue;
    out.push({ nome: o.nome, conteudo: o.conteudo, nota: typeof o.nota === 'string' ? o.nota.slice(0, 50_000) : null });
  }
  return out;
}

// ---------- rotas do operador ----------

/** Nome de uma varredura local importada (vira 'local:<nome>' na lista). Sem caminho absoluto nem caractere de controle. */
export function nomeVarreduraLocal(nome: unknown): string | null {
  if (typeof nome !== 'string') return null;
  const n = nome.trim();
  if (!/^\w[\w .@/-]{0,119}$/.test(n) || n.includes('..')) return null;
  return `local:${n}`;
}

const Importacao = z.object({
  nome: z.string().min(1).max(120),
  commit: z.string().regex(/^[0-9a-f]{7,64}$/).optional(),
  modo: z.enum(['codebase', 'changes', 'attack-surface']).default('codebase'),
  esforco: z.enum(['low', 'medium', 'high']).default('medium'),
  sarif: z.unknown(),
  relatorioMd: z.string().max(MAX_MD_BYTES).optional(),
  patches: z.unknown().optional(),
});

const NovoPedido = z.object({
  repoUrl: z.string().min(1).max(400),
  branch: z.string().max(200).optional(),
  modo: z.enum(['codebase', 'changes', 'attack-surface']).default('codebase'),
  esforco: z.enum(['low', 'medium', 'high']).default('medium'),
});

/** Registra as rotas do operador. Chamar DENTRO de registerStateRoutes (requireUser + CSRF). */
export function registerCodescanUserRoutes(app: FastifyInstance) {
  app.post('/api/codigo/varreduras', async (req, reply) => {
    const b = NovoPedido.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'Pedido inválido.' });
    const v = validarRepoUrl(b.data.repoUrl);
    if (!v.ok) return reply.code(400).send({ error: `Repositório recusado: ${v.motivo}.` });
    const branch = b.data.branch?.trim() || null;
    if (branch && !validarBranch(branch)) return reply.code(400).send({ error: 'Nome de branch inválido.' });
    if (b.data.modo === 'changes' && !branch) return reply.code(400).send({ error: 'Para varrer só as mudanças, informe a branch.' });
    const usuarioId = (req as AuthedRequest).usuarioId;
    const ativos = await prisma.varreduraCodigo.count({ where: { usuarioId, status: { in: ['fila', 'executando'] } } });
    if (ativos >= 5) return reply.code(429).send({ error: 'Já há 5 varreduras na fila. Aguarde terminarem.' });
    const criada = await prisma.varreduraCodigo.create({
      data: { usuarioId, repoUrl: b.data.repoUrl.trim(), branch, modo: b.data.modo, esforco: b.data.esforco },
      select: { id: true, status: true, criadoEm: true },
    });
    return reply.code(201).send(criada);
  });

  /** Importa o resultado de uma varredura feita na máquina do operador (Claude Code local, sem worker). */
  app.post('/api/codigo/varreduras/importar', { bodyLimit: 25 * 1_048_576 }, async (req, reply) => {
    const b = Importacao.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'Importação inválida.' });
    const repoUrl = nomeVarreduraLocal(b.data.nome);
    if (!repoUrl) return reply.code(400).send({ error: 'Nome inválido: use letras, números, ponto, hífen, barra ou espaço.' });
    const achados = normalizarSarif(b.data.sarif);
    const s = b.data.sarif as { runs?: unknown } | null;
    if (!s || typeof s !== 'object' || !Array.isArray(s.runs)) return reply.code(400).send({ error: 'O arquivo não parece um SARIF (falta runs).' });
    const usuarioId = (req as AuthedRequest).usuarioId;
    const agora = new Date();
    const criada = await prisma.varreduraCodigo.create({
      data: {
        usuarioId, repoUrl, branch: null, modo: b.data.modo, esforco: b.data.esforco, status: 'concluido',
        commit: b.data.commit ?? null, workerId: 'importado',
        achados: achados as unknown as Prisma.InputJsonValue,
        resumo: resumoDosAchados(achados) as unknown as Prisma.InputJsonValue,
        relatorioMd: b.data.relatorioMd ?? null,
        patches: sanearPatches(b.data.patches) as unknown as Prisma.InputJsonValue,
        iniciadoEm: agora, concluidoEm: agora,
      },
      select: { id: true },
    });
    return reply.code(201).send({ id: criada.id, achados: achados.length });
  });

  app.get('/api/codigo/varreduras', async (req) => {
    const usuarioId = (req as AuthedRequest).usuarioId;
    return prisma.varreduraCodigo.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },
      take: 100,
      select: { id: true, repoUrl: true, branch: true, modo: true, esforco: true, status: true, commit: true, resumo: true, erro: true, criadoEm: true, iniciadoEm: true, concluidoEm: true },
    });
  });

  app.get('/api/codigo/varreduras/:id', async (req, reply) => {
    const usuarioId = (req as AuthedRequest).usuarioId;
    const { id } = req.params as { id: string };
    const v = await prisma.varreduraCodigo.findFirst({ where: { id, usuarioId } });
    if (!v) return reply.code(404).send({ error: 'Varredura não encontrada.' });
    const { workerId: _w, usuarioId: _u, ...publico } = v;
    return publico;
  });

  app.delete('/api/codigo/varreduras/:id', async (req, reply) => {
    const usuarioId = (req as AuthedRequest).usuarioId;
    const { id } = req.params as { id: string };
    const r = await prisma.varreduraCodigo.deleteMany({ where: { id, usuarioId, status: { not: 'executando' } } });
    if (!r.count) return reply.code(409).send({ error: 'Não encontrada ou ainda em execução.' });
    return { ok: true };
  });
}

// ---------- rotas do worker ----------

const sha256 = (s: string) => createHash('sha256').update(s).digest();

function tokenWorkerValido(req: FastifyRequest): boolean {
  const esperado = process.env.CODESCAN_WORKER_TOKEN;
  const h = req.headers['x-worker-token'];
  const recebido = Array.isArray(h) ? h[0] : h;
  if (!esperado || esperado.length < 32 || !recebido) return false;
  return timingSafeEqual(sha256(recebido), sha256(esperado));
}

const Resultado = z.object({
  status: z.enum(['concluido', 'erro']),
  commit: z.string().regex(/^[0-9a-f]{7,64}$/).optional(),
  sarif: z.unknown().optional(),
  relatorioMd: z.string().max(MAX_MD_BYTES).optional(),
  patches: z.unknown().optional(),
  erro: z.string().max(4_000).optional(),
});

/** Rotas do worker. Registrar FORA do hook de usuário (como a ingestão). Fail-closed sem token. */
export async function registerCodescanWorkerRoutes(app: FastifyInstance) {
  const autenticar = async (req: FastifyRequest, reply: import('fastify').FastifyReply) => {
    if (!process.env.CODESCAN_WORKER_TOKEN) return reply.code(503).send({ error: 'Worker de código não configurado.' });
    if (!tokenWorkerValido(req)) {
      req.log.warn({ ip: req.ip }, 'codescan: token de worker inválido');
      return reply.code(401).send({ error: 'Não autenticado.' });
    }
  };

  /** Entrega o próximo pedido da fila (e encerra os que ficaram presos). */
  app.post('/api/scan/ci/codigo/claim', { preHandler: autenticar }, async (req, reply) => {
    await prisma.varreduraCodigo.updateMany({
      where: { status: 'executando', iniciadoEm: { lt: new Date(Date.now() - LIMITE_EXECUCAO_MS) } },
      data: { status: 'erro', erro: 'Tempo de execução esgotado (o worker não devolveu resultado).', concluidoEm: new Date() },
    });
    const workerId = String((req.body as { workerId?: unknown } | undefined)?.workerId ?? 'worker').slice(0, 80);
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const proximo = await prisma.varreduraCodigo.findFirst({ where: { status: 'fila' }, orderBy: { criadoEm: 'asc' } });
      if (!proximo) return reply.code(204).send();
      // só pega se ainda estiver na fila (evita dois workers no mesmo pedido)
      const r = await prisma.varreduraCodigo.updateMany({ where: { id: proximo.id, status: 'fila' }, data: { status: 'executando', iniciadoEm: new Date(), workerId } });
      if (r.count) {
        return { id: proximo.id, repoUrl: proximo.repoUrl, branch: proximo.branch, modo: proximo.modo, esforco: proximo.esforco };
      }
    }
    return reply.code(204).send();
  });

  app.post('/api/scan/ci/codigo/:id/resultado', { preHandler: autenticar, bodyLimit: 25 * 1_048_576 }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const b = Resultado.safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: 'Resultado inválido.' });
    const atual = await prisma.varreduraCodigo.findUnique({ where: { id }, select: { status: true } });
    if (!atual) return reply.code(404).send({ error: 'Pedido não encontrado.' });
    if (atual.status !== 'executando') return reply.code(409).send({ error: 'Pedido não está em execução.' });
    const achados = b.data.status === 'concluido' ? normalizarSarif(b.data.sarif) : [];
    await prisma.varreduraCodigo.update({
      where: { id },
      data: {
        status: b.data.status,
        commit: b.data.commit ?? null,
        achados: achados as unknown as Prisma.InputJsonValue,
        resumo: resumoDosAchados(achados) as unknown as Prisma.InputJsonValue,
        relatorioMd: b.data.relatorioMd ?? null,
        patches: sanearPatches(b.data.patches) as unknown as Prisma.InputJsonValue,
        erro: b.data.erro ?? null,
        concluidoEm: new Date(),
      },
    });
    return { ok: true, achados: achados.length };
  });
}

