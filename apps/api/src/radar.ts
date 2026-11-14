import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AtaqueFonte } from '@seginfo/shared';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';

/**
 * Análise dos eventos de ataque. Registrada DENTRO do plugin de rotas de estado
 * (routes.ts), então herda o hook que exige identidade verificada do Cloudflare Access.
 *
 * O resumo é agregado no PostgreSQL (GROUP BY), não em memória: o honeypot exposto gera
 * centenas de milhares de eventos por dia, e carregar as linhas limitaria a janela às
 * últimas horas. Cada consulta usa o índice (usuarioId, escopo, ocorridoEm).
 */

/** Eventos devolvidos por sessão (um bot que roda um script longo gera centenas de comandos). */
const LIMITE_SESSAO = 1000;

/** Senhas tentadas só são armazenadas e exibidas com RADAR_GUARDAR_SENHAS=true. */
export const guardarSenhas = () => process.env.RADAR_GUARDAR_SENHAS === 'true';

/** Técnica por ação, usada quando o coletor não mandou `detalhes.mitre`. */
export const MITRE_POR_ACAO: Record<string, { id: string; nome: string }> = {
  login_falha: { id: 'T1110', nome: 'Brute Force' },
  lockout: { id: 'T1110', nome: 'Brute Force' },
  scan: { id: 'T1046', nome: 'Network Service Discovery' },
  login_ok: { id: 'T1078', nome: 'Valid Accounts' },
  comando: { id: 'T1059', nome: 'Command and Scripting Interpreter' },
  download: { id: 'T1105', nome: 'Ingress Tool Transfer' },
  tunel: { id: 'T1090', nome: 'Proxy' },
  reflexao: { id: 'T1498.002', nome: 'Reflection Amplification' },
};

export type Escopo = 'internet' | 'interno' | 'todos';
const EscopoQuery = z.enum(['internet', 'interno', 'todos']).default('todos');

type Tecnica = { id: string; nome: string; eventos: number };

/**
 * Junta as técnicas que vieram do coletor (regra do Wazuh, em `detalhes.mitre`) com as dos
 * eventos sem técnica válida, mapeadas pela ação. Ordena por eventos (desc) e depois por id.
 */
export function combinarMitre(doColetor: Tecnica[], semTecnicaPorAcao: { acao: string; total: number }[]): Tecnica[] {
  const mapa = new Map<string, Tecnica>();
  const somar = (t: Tecnica) => {
    const cur = mapa.get(t.id);
    if (cur) cur.eventos += t.eventos;
    else mapa.set(t.id, { ...t });
  };
  doColetor.forEach(somar);
  for (const { acao, total } of semTecnicaPorAcao) {
    const m = MITRE_POR_ACAO[acao];
    if (m && total > 0) somar({ ...m, eventos: total });
  }
  return [...mapa.values()].sort((a, b) => b.eventos - a.eventos || a.id.localeCompare(b.id));
}

/**
 * Retenção: apaga eventos mais antigos que ATAQUES_RETENCAO_DIAS (padrão 90) e as conexões
 * simples (acao = conexao: sem login, comando nem download) mais antigas que
 * ATAQUES_RETENCAO_CONEXAO_DIAS (padrão 14). As conexões são a maior parte do volume e pouco
 * dizem depois de alguns dias. Roda ao subir (após 1 min) e a cada 6 h. Não faz nada sem DATABASE_URL.
 */
export function iniciarRetencao(app: FastifyInstance) {
  if (!process.env.DATABASE_URL) return;
  const dias = Number(process.env.ATAQUES_RETENCAO_DIAS ?? 90);
  const diasConexao = Number(process.env.ATAQUES_RETENCAO_CONEXAO_DIAS ?? 14);
  if (!Number.isFinite(dias) || dias <= 0) return;

  const limpar = async () => {
    try {
      const corte = new Date(Date.now() - dias * 86_400_000);
      const r = await prisma.ataqueEvento.deleteMany({ where: { ocorridoEm: { lt: corte } } });
      let conexoes = 0;
      if (Number.isFinite(diasConexao) && diasConexao > 0 && diasConexao < dias) {
        const corteConexao = new Date(Date.now() - diasConexao * 86_400_000);
        conexoes = (await prisma.ataqueEvento.deleteMany({ where: { acao: 'conexao', ocorridoEm: { lt: corteConexao } } })).count;
      }
      if (r.count + conexoes > 0) app.log.info({ removidos: r.count, conexoes, dias, diasConexao }, 'radar: retenção aplicada');
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

// ---------- SQL ----------

/** Colunas agrupáveis no resumo (lista fechada: nunca vem do usuário). */
const COLUNA = {
  servico: Prisma.raw('"servico"'),
  usuarioTentado: Prisma.raw('"usuarioTentado"'),
  senhaTentada: Prisma.raw('"senhaTentada"'),
  paisOrigem: Prisma.raw('"paisOrigem"'),
  acao: Prisma.raw('"acao"'),
} as const;

/** Elementos de detalhes.mitre (vazio quando não é array) e o que conta como técnica válida. */
const ELEMENTOS_MITRE = Prisma.raw(
  `jsonb_array_elements(CASE WHEN jsonb_typeof("detalhes"->'mitre') = 'array' THEN "detalhes"->'mitre' ELSE '[]'::jsonb END)`,
);
const MITRE_VALIDA = Prisma.raw(
  `(m->>'id') ~ '^T[0-9]{4}(\\.[0-9]{3})?$' AND jsonb_typeof(m->'nome') = 'string' AND length(m->>'nome') <= 120`,
);

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

function filtro(usuarioId: string, desde: Date, escopo: Escopo) {
  return Prisma.sql`"usuarioId" = ${usuarioId} AND "ocorridoEm" >= ${desde}${
    escopo === 'todos' ? Prisma.empty : Prisma.sql` AND "escopo" = ${escopo}`}`;
}

async function topPor(coluna: keyof typeof COLUNA, where: Prisma.Sql, limite: number) {
  const col = COLUNA[coluna];
  const rows = await prisma.$queryRaw<{ nome: string; total: bigint }[]>`
    SELECT ${col} AS nome, count(*) AS total FROM "AtaqueEvento"
    WHERE ${where} AND ${col} IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT ${limite}`;
  return rows.map((r) => ({ nome: r.nome, total: n(r.total) }));
}

export async function registerRadarRoutes(app: FastifyInstance) {
  const uid = (req: unknown) => (req as AuthedRequest).usuarioId;

  // tz = Date.getTimezoneOffset() do navegador (minutos; 180 em UTC-3): a linha do tempo agrupa no horário local
  const ResumoQuery = z.object({
    dias: z.coerce.number().int().min(1).max(90).default(7),
    tz: z.coerce.number().int().min(-840).max(840).default(0),
    escopo: EscopoQuery,
  });

  app.get('/api/radar/resumo', async (req, reply) => {
    const q = ResumoQuery.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: 'parâmetros inválidos' });

    const { dias, tz, escopo } = q.data;
    const desde = new Date(Date.now() - dias * 86_400_000);
    const senhas = guardarSenhas();
    const where = filtro(uid(req), desde, escopo);
    // granularidade: hora para janelas curtas, dia para janelas longas
    const porHora = dias <= 3;
    const unidade = porHora ? 'hour' : 'day';
    const formato = porHora ? 'YYYY-MM-DD"T"HH24' : 'YYYY-MM-DD';

    const [totais, topIps, topServicos, topUsuarios, topSenhas, topPaises, porAcao, timeline, mitreColetor, semTecnica] = await Promise.all([
      prisma.$queryRaw<{ total: bigint; ips: bigint; falhas: bigint; lockouts: bigint }[]>`
        SELECT count(*) AS total, count(DISTINCT "ipOrigem") AS ips,
               count(*) FILTER (WHERE "acao" = 'login_falha') AS falhas,
               count(*) FILTER (WHERE "acao" = 'lockout') AS lockouts
        FROM "AtaqueEvento" WHERE ${where}`,
      prisma.$queryRaw<{ ip: string; pais: string | null; total: bigint }[]>`
        SELECT "ipOrigem" AS ip, max("paisOrigem") AS pais, count(*) AS total FROM "AtaqueEvento"
        WHERE ${where} AND "ipOrigem" IS NOT NULL
        GROUP BY 1 ORDER BY 3 DESC, 1 LIMIT 10`,
      topPor('servico', where, 8),
      topPor('usuarioTentado', where, 10),
      senhas ? topPor('senhaTentada', where, 10) : Promise.resolve([]),
      topPor('paisOrigem', where, 8),
      topPor('acao', where, 10),
      prisma.$queryRaw<{ bucket: string; total: bigint }[]>`
        SELECT to_char(date_trunc(${unidade}, "ocorridoEm" - make_interval(mins => ${tz}::int)), ${formato}) AS bucket,
               count(*) AS total
        FROM "AtaqueEvento" WHERE ${where}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ id: string; nome: string; eventos: bigint }[]>`
        SELECT m->>'id' AS id, max(m->>'nome') AS nome, count(*) AS eventos
        FROM "AtaqueEvento", ${ELEMENTOS_MITRE} AS m
        WHERE ${where} AND ${MITRE_VALIDA}
        GROUP BY 1`,
      prisma.$queryRaw<{ acao: string; total: bigint }[]>`
        SELECT "acao" AS acao, count(*) AS total FROM "AtaqueEvento"
        WHERE ${where} AND NOT EXISTS (SELECT 1 FROM ${ELEMENTOS_MITRE} AS m WHERE ${MITRE_VALIDA})
        GROUP BY 1`,
    ]);

    const t = totais[0];
    return {
      dias,
      escopo,
      total: n(t?.total),
      /** Mantido por compatibilidade: a agregação no banco não tem limite de linhas. */
      truncado: false,
      ipsUnicos: n(t?.ips),
      falhasLogin: n(t?.falhas),
      lockouts: n(t?.lockouts),
      granularidade: porHora ? 'hora' : 'dia',
      topIps: topIps.map((r) => ({ ip: r.ip, pais: r.pais, total: n(r.total) })),
      topServicos,
      topUsuarios,
      senhasHabilitadas: senhas,
      topSenhas,
      topPaises,
      porAcao,
      mitre: combinarMitre(
        mitreColetor.map((r) => ({ id: r.id, nome: r.nome, eventos: n(r.eventos) })),
        semTecnica.map((r) => ({ acao: r.acao, total: n(r.total) })),
      ),
      timeline: timeline.map((r) => ({ bucket: r.bucket, total: n(r.total) })),
    };
  });

  const EventosQuery = z.object({
    ip: z.string().max(45).optional(),
    servico: z.string().max(32).optional(),
    acao: z.string().max(16).optional(),
    fonte: AtaqueFonte.optional(),
    pais: z.string().length(2).optional(),
    escopo: EscopoQuery,
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });

  app.get('/api/radar/eventos', async (req, reply) => {
    const q = EventosQuery.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: 'parâmetros inválidos' });

    const { ip, servico, acao, fonte, pais, escopo, q: texto, page, limit } = q.data;
    const where = {
      usuarioId: uid(req),
      ...(ip ? { ipOrigem: ip } : {}),
      ...(servico ? { servico } : {}),
      ...(acao ? { acao } : {}),
      ...(fonte ? { fonte } : {}),
      ...(pais ? { paisOrigem: pais } : {}),
      ...(escopo !== 'todos' ? { escopo } : {}),
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
          servico: true, protocolo: true, acao: true, usuarioTentado: true, alvo: true, detalhes: true, escopo: true,
        },
      }),
    ]);
    return { total, items };
  });

  // Sessão do atacante: todos os eventos com o mesmo detalhes.sessao (Cowrie), em ordem.
  // O IP é obrigatório para a busca usar o índice (usuarioId, ipOrigem) em vez de varrer a tabela.
  const SessaoQuery = z.object({
    id: z.string().trim().min(4).max(32).regex(/^[\w-]+$/),
    ip: z.string().trim().min(3).max(45),
  });

  app.get('/api/radar/sessao', async (req, reply) => {
    const q = SessaoQuery.safeParse(req.query);
    if (!q.success) return reply.status(400).send({ error: 'parâmetros inválidos' });
    const items = await prisma.ataqueEvento.findMany({
      where: { usuarioId: uid(req), ipOrigem: q.data.ip, detalhes: { path: ['sessao'], equals: q.data.id } },
      orderBy: { ocorridoEm: 'asc' },
      take: LIMITE_SESSAO,
      select: {
        id: true, fonte: true, ocorridoEm: true, ipOrigem: true, paisOrigem: true, portaDestino: true,
        servico: true, protocolo: true, acao: true, usuarioTentado: true, alvo: true, detalhes: true,
      },
    });
    return { sessao: q.data.id, truncado: items.length === LIMITE_SESSAO, items };
  });
}
