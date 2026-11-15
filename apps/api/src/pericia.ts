import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PericiaInSchema, type PericiaIn } from '@seginfo/shared';
import { prisma, resolveUsuario } from './db.js';
import type { AuthedRequest } from './auth.js';
import { preservarPericia } from './artefatosCaptura.js';

/**
 * Laudos dos alvos reais do honeypot. A VM do Wazuh inspeciona cada alvo pelo agente QEMU
 * antes do reset e manda o laudo para cá (POST /api/ingest/pericia, autenticação de coletor);
 * a tela lê pelas rotas GET, protegidas pelo login normal do app.
 */

export interface ResumoPericia {
  arquivos: number;
  executaveis: number;
  persistencia: number;
  processos: number;
  conexoes: number;
  saidasBloqueadas: number;
  destinos: number;
  amostras: number;
  erros: number;
}

export function resumirPericia(p: PericiaIn): ResumoPericia {
  return {
    arquivos: p.arquivos.length,
    executaveis: p.arquivos.filter((a) => a.executavel || a.tipo === 'elf' || a.tipo === 'pe').length,
    persistencia: p.persistencia.length,
    processos: p.processos.length,
    conexoes: p.conexoes.length,
    saidasBloqueadas: p.saidas.reduce((s, x) => s + x.tentativas, 0),
    destinos: new Set(p.saidas.map((s) => s.destino)).size,
    amostras: p.amostras.filter((a) => a.guardada).length,
    erros: p.erros.length,
  };
}

const MITRE_POR_PERSISTENCIA: Record<string, string> = {
  cron: 'T1053.003', systemd: 'T1543.002', 'perfil-shell': 'T1546.004',
  'chave-ssh': 'T1098.004', preload: 'T1574.006', init: 'T1037.004',
  servico: 'T1543.003', tarefa: 'T1053.005', inicializar: 'T1547.001',
  'run-key': 'T1547.001', wmi: 'T1546.003', contas: 'T1136.001', grupo: 'T1098.007',
};

/** Grava (ou substitui, se o coletor reenviar a mesma janela) um laudo. */
export async function gravarPericia(email: string, corpo: unknown) {
  const p = PericiaInSchema.safeParse(corpo);
  if (!p.success) return { ok: false as const };
  const usuario = await resolveUsuario(email);
  const d = p.data;
  const base = {
    vmid: d.vmid, sistema: d.sistema, sensor: d.sensor ?? null,
    janelaInicio: new Date(d.janelaInicio),
    resumo: resumirPericia(d) as unknown as Prisma.InputJsonObject,
    dados: d as unknown as Prisma.InputJsonObject,
  };
  const janelaFim = new Date(d.janelaFim);
  const r = await prisma.pericia.upsert({
    where: { usuarioId_alvo_janelaFim: { usuarioId: usuario.id, alvo: d.alvo, janelaFim } },
    update: base,
    create: { usuarioId: usuario.id, alvo: d.alvo, janelaFim, ...base },
    select: { id: true },
  });
  await preservarPericia(usuario.id, r.id, d);
  return { ok: true as const, id: r.id };
}

export async function registerPericiaRoutes(app: FastifyInstance) {
  const uid = (req: unknown) => (req as AuthedRequest).usuarioId;

  app.get('/api/pericia', async (req) => {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(200).default(60) }).safeParse(req.query);
    return prisma.pericia.findMany({
      where: { usuarioId: uid(req) },
      orderBy: { janelaFim: 'desc' },
      take: q.success ? q.data.limit : 60,
      select: { id: true, alvo: true, vmid: true, sistema: true, sensor: true, janelaInicio: true, janelaFim: true, resumo: true, criadoEm: true },
    });
  });

  app.get('/api/pericia/tecnicas', async (req) => {
    const desde = new Date(Date.now() - 90 * 86_400_000);
    const evidencias = await prisma.$queryRaw<{ laudoId: string; tipo: string | null; onde: string | null }[]>`
      SELECT l."id" AS "laudoId", item->>'tipo' AS "tipo", item->>'onde' AS "onde"
      FROM (
        SELECT "id", "dados"->'persistencia' AS persistencia FROM "Pericia"
        WHERE "usuarioId" = ${uid(req)} AND "janelaFim" >= ${desde}
        ORDER BY "janelaFim" DESC LIMIT 200
      ) l
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(l.persistencia) = 'array' THEN l.persistencia ELSE '[]'::jsonb END
      ) item`;
    const acumulado = new Map<string, Set<string>>();
    for (const evidencia of evidencias) {
      const tipo = evidencia.tipo?.toLocaleLowerCase();
      const id = tipo === 'contas' && /(?:\/etc\/group|security\s+4732)/i.test(evidencia.onde ?? '')
        ? 'T1098.007' : tipo ? MITRE_POR_PERSISTENCIA[tipo] : undefined;
      if (id) {
        const idsLaudos = acumulado.get(id) ?? new Set<string>();
        idsLaudos.add(evidencia.laudoId); acumulado.set(id, idsLaudos);
      }
    }
    return [...acumulado].map(([id, idsLaudos]) => ({ id, laudos: idsLaudos.size }));
  });

  app.get('/api/pericia/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = await prisma.pericia.findFirst({ where: { id, usuarioId: uid(req) } });
    if (!p) return reply.status(404).send({ error: 'Laudo não encontrado.' });

    // Quem agiu neste alvo durante a janela, segundo o Radar (sensor = alvo dos eventos).
    const [eventos, totalEventos] = p.sensor
      ? await Promise.all([prisma.ataqueEvento.findMany({
        where: {
          usuarioId: uid(req), alvo: p.sensor,
          ocorridoEm: { gte: p.janelaInicio, lte: p.janelaFim },
          acao: { in: ['login_falha', 'login_ok', 'scan', 'comando', 'download', 'tunel', 'bloqueio', 'reflexao'] },
        },
        select: { id: true, fonte: true, ipOrigem: true, paisOrigem: true, acao: true, ocorridoEm: true, servico: true, portaDestino: true, detalhes: true },
        orderBy: { ocorridoEm: 'desc' },
        take: 2_000,
      }), prisma.ataqueEvento.count({ where: {
        usuarioId: uid(req), alvo: p.sensor,
        ocorridoEm: { gte: p.janelaInicio, lte: p.janelaFim },
        acao: { in: ['login_falha', 'login_ok', 'scan', 'comando', 'download', 'tunel', 'bloqueio', 'reflexao'] },
      } })])
      : [[], 0] as const;
    const porIp = new Map<string, { ip: string; pais: string | null; logins: number; falhas: number; reconhecimentos: number; comandos: number; arquivos: number; tuneis: number; bloqueios: number; reflexoes: number; primeira: Date; ultima: Date }>();
    for (const e of eventos) {
      if (!e.ipOrigem) continue;
      const x = porIp.get(e.ipOrigem) ?? { ip: e.ipOrigem, pais: e.paisOrigem, logins: 0, falhas: 0, reconhecimentos: 0, comandos: 0, arquivos: 0, tuneis: 0, bloqueios: 0, reflexoes: 0, primeira: e.ocorridoEm, ultima: e.ocorridoEm };
      if (e.acao === 'login_ok') x.logins++;
      else if (e.acao === 'login_falha') x.falhas++;
      else if (e.acao === 'scan') x.reconhecimentos++;
      else if (e.acao === 'comando') x.comandos++;
      else if (e.acao === 'download') x.arquivos++;
      else if (e.acao === 'tunel') x.tuneis++;
      else if (e.acao === 'bloqueio') x.bloqueios++;
      else if (e.acao === 'reflexao') x.reflexoes++;
      if (e.ocorridoEm < x.primeira) x.primeira = e.ocorridoEm;
      if (e.ocorridoEm > x.ultima) x.ultima = e.ocorridoEm;
      porIp.set(e.ipOrigem, x);
    }
    const invasores = [...porIp.values()].sort((a, b) => (b.comandos + b.arquivos + b.logins + b.falhas + b.reconhecimentos) - (a.comandos + a.arquivos + a.logins + a.falhas + a.reconhecimentos)).slice(0, 30);
    const linhaTempo = [...eventos].reverse().map((e) => {
      const detalhes = e.detalhes && typeof e.detalhes === 'object' && !Array.isArray(e.detalhes)
        ? e.detalhes as Record<string, unknown> : {};
      const comando = typeof detalhes.comando === 'string' ? detalhes.comando.slice(0, 1000)
        .replace(/(\b(?:password|passwd|senha|token|secret|api[_-]?key|authorization)\b\s*[:=]\s*)([^\s,;]+)/gi, '$1[redigido]')
        .replace(/(--?(?:password|token|secret|api-key|auth)(?:=|\s+))("[^"]*"|'[^']*'|[^\s]+)/gi, '$1[redigido]')
        .replace(/(https?:\/\/)[^/@\s]+@/gi, '$1[credenciais]@') : null;
      const mitre = Array.isArray(detalhes.mitre) ? detalhes.mitre.flatMap((x) => {
        if (!x || typeof x !== 'object' || Array.isArray(x)) return [];
        const item = x as Record<string, unknown>;
        return typeof item.id === 'string' && /^T\d{4}(?:\.\d{3})?$/.test(item.id)
          ? [{ id: item.id, nome: typeof item.nome === 'string' ? item.nome.slice(0, 160) : '' }] : [];
      }) : [];
      return {
        id: e.id, quando: e.ocorridoEm.toISOString(), fonte: e.fonte, acao: e.acao,
        ip: e.ipOrigem, pais: e.paisOrigem, servico: e.servico, porta: e.portaDestino,
        comando, mitre,
      };
    });
    return { ...p, invasores, linhaTempo, linhaTempoTruncada: totalEventos > linhaTempo.length };
  });
}
