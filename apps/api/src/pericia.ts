import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PericiaInSchema, type PericiaIn } from '@seginfo/shared';
import { prisma, resolveUsuario } from './db.js';
import type { AuthedRequest } from './auth.js';

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

  app.get('/api/pericia/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = await prisma.pericia.findFirst({ where: { id, usuarioId: uid(req) } });
    if (!p) return reply.status(404).send({ error: 'Laudo não encontrado.' });

    // Quem agiu neste alvo durante a janela, segundo o Radar (sensor = alvo dos eventos).
    const eventos = p.sensor
      ? await prisma.ataqueEvento.findMany({
        where: {
          usuarioId: uid(req), alvo: p.sensor,
          ocorridoEm: { gte: p.janelaInicio, lte: p.janelaFim },
          acao: { in: ['login_ok', 'comando', 'download', 'tunel'] },
        },
        select: { ipOrigem: true, paisOrigem: true, acao: true, ocorridoEm: true },
        take: 20_000,
      })
      : [];
    const porIp = new Map<string, { ip: string; pais: string | null; logins: number; comandos: number; arquivos: number; tuneis: number; primeira: Date; ultima: Date }>();
    for (const e of eventos) {
      if (!e.ipOrigem) continue;
      const x = porIp.get(e.ipOrigem) ?? { ip: e.ipOrigem, pais: e.paisOrigem, logins: 0, comandos: 0, arquivos: 0, tuneis: 0, primeira: e.ocorridoEm, ultima: e.ocorridoEm };
      if (e.acao === 'login_ok') x.logins++;
      else if (e.acao === 'comando') x.comandos++;
      else if (e.acao === 'download') x.arquivos++;
      else x.tuneis++;
      if (e.ocorridoEm < x.primeira) x.primeira = e.ocorridoEm;
      if (e.ocorridoEm > x.ultima) x.ultima = e.ocorridoEm;
      porIp.set(e.ipOrigem, x);
    }
    const invasores = [...porIp.values()].sort((a, b) => (b.comandos + b.arquivos) - (a.comandos + a.arquivos)).slice(0, 30);
    return { ...p, invasores };
  });
}
