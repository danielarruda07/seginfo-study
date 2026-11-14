import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AtaqueFonte, AtaqueMitreSchema, type AtaqueMitre } from '@seginfo/shared';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';

/**
 * Análise dos eventos de ataque. Registrada DENTRO do plugin de rotas de estado
 * (routes.ts), então herda o hook que exige identidade verificada do Cloudflare Access.
 *
 * A agregação é feita em memória sobre uma janela limitada (LIMITE linhas): simples e
 * robusta para o volume de um homelab. Se `truncado` vier true, a janela tem mais
 * eventos do que o limite e o resumo cobre só os mais recentes.
 */

const LIMITE = 100_000;

/** Senhas tentadas só são armazenadas e exibidas com RADAR_GUARDAR_SENHAS=true. */
export const guardarSenhas = () => process.env.RADAR_GUARDAR_SENHAS === 'true';

const MITRE: Record<string, { id: string; nome: string }> = {
  login_falha: { id: 'T1110', nome: 'Brute Force' },
  lockout: { id: 'T1110', nome: 'Brute Force' },
  scan: { id: 'T1046', nome: 'Network Service Discovery' },
  login_ok: { id: 'T1078', nome: 'Valid Accounts' },
  comando: { id: 'T1059', nome: 'Command and Scripting Interpreter' },
  download: { id: 'T1105', nome: 'Ingress Tool Transfer' },
};

/**
 * Técnicas do evento: as que o coletor mandou em `detalhes.mitre` (ex.: regra do Wazuh) ou,
 * na falta delas, o mapeamento fixo por ação. Entradas malformadas são ignoradas.
 */
export function tecnicasDoEvento(acao: string, detalhes: unknown): AtaqueMitre[] {
  const lista = (detalhes as { mitre?: unknown } | null)?.mitre;
  if (Array.isArray(lista)) {
    const validas = lista.flatMap((m) => {
      const p = AtaqueMitreSchema.safeParse(m);
      return p.success ? [p.data] : [];
    });
    if (validas.length) return validas;
  }
  const fixo = MITRE[acao];
  return fixo ? [fixo] : [];
}

function top(map: Map<string, number>, n: number) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
function inc(map: Map<string, number>, key: string | null | undefined) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Retenção: apaga eventos mais antigos que ATAQUES_RETENCAO_DIAS (padrão 90).
 * Roda ao subir (após 1 min) e a cada 6 h. Não faz nada sem DATABASE_URL.
 */
export function iniciarRetencao(app: FastifyInstance) {
  if (!process.env.DATABASE_URL) return;
  const dias = Number(process.env.ATAQUES_RETENCAO_DIAS ?? 90);
  if (!Number.isFinite(dias) || dias <= 0) return;

  const limpar = async () => {
    try {
      const corte = new Date(Date.now() - dias * 86_400_000);
      const r = await prisma.ataqueEvento.deleteMany({ where: { ocorridoEm: { lt: corte } } });
      if (r.count > 0) app.log.info({ removidos: r.count, dias }, 'radar: retenção aplicada');
    } catch (e) {
      app.log.warn({ err: (e as Error).message }, 'radar: falha ao aplicar retenção');
    }
  };

  const intervalo = setInterval(limpar, 6 * 3_600_000);
  const inicial = setTimeout(limpar, 60_000);
  intervalo.unref();
  inicial.unref();
  app.addHook('onClose', async () => {
    clearInterval(intervalo);
    clearTimeout(inicial);
  });
}

export async function registerRadarRoutes(app: FastifyInstance) {
  const uid = (req: unknown) => (req as AuthedRequest).usuarioId;

  // tz = Date.getTimezoneOffset() do navegador (minutos; 180 em UTC-3): a linha do tempo agrupa no horário local
  const ResumoQuery = z.object({
    dias: z.coerce.number().int().min(1).max(90).default(7),
    tz: z.coerce.number().int().min(-840).max(840).default(0),
  });

  app.get('/api/radar/resumo', async (req, reply) => {
    const q = ResumoQuery.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: 'parâmetros inválidos' });

    const { dias, tz } = q.data;
    const desde = new Date(Date.now() - dias * 86_400_000);
    const senhas = guardarSenhas();

    const rows = await prisma.ataqueEvento.findMany({
      where: { usuarioId: uid(req), ocorridoEm: { gte: desde } },
      select: {
        ocorridoEm: true, ipOrigem: true, paisOrigem: true, servico: true, acao: true,
        usuarioTentado: true, senhaTentada: true, detalhes: true,
      },
      orderBy: { ocorridoEm: 'desc' },
      take: LIMITE + 1,
    });
    const truncado = rows.length > LIMITE;
    const dados = truncado ? rows.slice(0, LIMITE) : rows;

    const porIp = new Map<string, number>();
    const paisDoIp = new Map<string, string>();
    const porServico = new Map<string, number>();
    const porUsuario = new Map<string, number>();
    const porSenha = new Map<string, number>();
    const porPais = new Map<string, number>();
    const porAcao = new Map<string, number>();
    const timeline = new Map<string, number>();
    const mitre = new Map<string, { id: string; nome: string; eventos: number }>();

    // granularidade: hora para janelas curtas, dia para janelas longas
    const porHora = dias <= 3;
    let falhasLogin = 0;
    let lockouts = 0;

    for (const r of dados) {
      if (r.ipOrigem) {
        inc(porIp, r.ipOrigem);
        if (r.paisOrigem && !paisDoIp.has(r.ipOrigem)) paisDoIp.set(r.ipOrigem, r.paisOrigem);
      }
      inc(porServico, r.servico);
      inc(porUsuario, r.usuarioTentado);
      if (senhas) inc(porSenha, r.senhaTentada);
      inc(porPais, r.paisOrigem);
      inc(porAcao, r.acao);
      if (r.acao === 'login_falha') falhasLogin++;
      if (r.acao === 'lockout') lockouts++;

      const iso = new Date(r.ocorridoEm.getTime() - tz * 60_000).toISOString();
      inc(timeline, porHora ? iso.slice(0, 13) : iso.slice(0, 10));

      for (const m of tecnicasDoEvento(r.acao, r.detalhes)) {
        const cur = mitre.get(m.id);
        if (cur) cur.eventos++;
        else mitre.set(m.id, { ...m, eventos: 1 });
      }
    }

    return {
      dias,
      total: dados.length,
      truncado,
      ipsUnicos: porIp.size,
      falhasLogin,
      lockouts,
      granularidade: porHora ? 'hora' : 'dia',
      topIps: top(porIp, 10).map(([ip, total]) => ({ ip, pais: paisDoIp.get(ip) ?? null, total })),
      topServicos: top(porServico, 8).map(([nome, total]) => ({ nome, total })),
      topUsuarios: top(porUsuario, 10).map(([nome, total]) => ({ nome, total })),
      senhasHabilitadas: senhas,
      topSenhas: senhas ? top(porSenha, 10).map(([nome, total]) => ({ nome, total })) : [],
      topPaises: top(porPais, 8).map(([nome, total]) => ({ nome, total })),
      porAcao: top(porAcao, 10).map(([nome, total]) => ({ nome, total })),
      mitre: [...mitre.values()].sort((a, b) => b.eventos - a.eventos),
      timeline: [...timeline.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([bucket, total]) => ({ bucket, total })),
    };
  });

  const EventosQuery = z.object({
    ip: z.string().max(45).optional(),
    servico: z.string().max(32).optional(),
    acao: z.string().max(16).optional(),
    fonte: AtaqueFonte.optional(),
    pais: z.string().length(2).optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });

  app.get('/api/radar/eventos', async (req, reply) => {
    const q = EventosQuery.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: 'parâmetros inválidos' });

    const { ip, servico, acao, fonte, pais, q: texto, page, limit } = q.data;
    const where = {
      usuarioId: uid(req),
      ...(ip ? { ipOrigem: ip } : {}),
      ...(servico ? { servico } : {}),
      ...(acao ? { acao } : {}),
      ...(fonte ? { fonte } : {}),
      ...(pais ? { paisOrigem: pais } : {}),
      ...(texto ? { OR: [
        { ipOrigem: { contains: texto, mode: 'insensitive' as const } },
        { servico: { contains: texto, mode: 'insensitive' as const } },
        { usuarioTentado: { contains: texto, mode: 'insensitive' as const } },
        { alvo: { contains: texto, mode: 'insensitive' as const } },
      ] } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.ataqueEvento.count({ where }),
      prisma.ataqueEvento.findMany({
        where,
        orderBy: { ocorridoEm: 'desc' },
        skip: page * limit,
        take: limit,
        select: {
          id: true, fonte: true, ocorridoEm: true, ipOrigem: true, paisOrigem: true, portaDestino: true,
          servico: true, protocolo: true, acao: true, usuarioTentado: true, alvo: true, detalhes: true,
        },
      }),
    ]);
    return { total, items };
  });
}
