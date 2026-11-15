import { isIP } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { AuthedRequest } from './auth.js';
import { prisma } from './db.js';
import { ipNaoPublico, normalizarDominio, osintCertificados, osintDns, osintExposicaoIp } from './osint.js';
import { notificarMudancas } from './exposicaoAlertas.js';
import { FONTES, fontePorId } from './exposicaoFontes/index.js';
import type { BaseColetada, ContextoFonte, Mudanca, ResultadoFonte, Severidade, TipoAlvo } from './exposicaoFontes/tipos.js';

export type { Mudanca, Severidade, TipoAlvo };

/**
 * Minha exposição: acompanha, ao longo do tempo, o que a internet vê dos domínios e IPs do
 * próprio usuário, só com OSINT passivo (crt.sh, Shodan InternetDB, DNS público). Cada varredura
 * guarda o resultado e o que mudou desde a anterior; o agendador repete a cada
 * EXPOSICAO_INTERVALO_HORAS (padrão 24; 0 desliga) e escreve cada mudança como uma linha JSON no
 * stdout ({"evento":"seginfo.exposicao.mudanca",...}) para o agente Wazuh do host poder coletar.
 */


type Certificados = Awaited<ReturnType<typeof osintCertificados>>;
type Dns = Awaited<ReturnType<typeof osintDns>>;
type ExposicaoIp = Awaited<ReturnType<typeof osintExposicaoIp>>;

/** Fotografia de uma varredura. Fonte que falhou fica null e entra em `erros`. */
export interface ResultadoExposicao {
  tipo: TipoAlvo;
  valor: string;
  certificados: Certificados | null;
  dns: Dns | null;
  ip: ExposicaoIp | null;
  /** fontes básicas e extras que falharam (a varredura segue com as outras) */
  erros: { fonte: string; mensagem: string }[];
  /** fontes extras (exposicaoFontes/) que responderam */
  extras?: ResultadoFonte[];
  /** fontes extras desligadas por falta de chave opcional */
  desligadas?: { fonte: string; nome: string; faltando: string[] }[];
}

export interface ResumoExposicao {
  portas: number;
  subdominios: number | null;
  cves: number;
  avisosDns: number | null;
  ips: string[];
}

const ORDEM: Record<Severidade, number> = { alta: 0, media: 1, info: 2 };

// ---------- funções puras ----------

interface ResultadoIp { ip: string; portas?: number[]; vulnerabilidades?: string[] }
const resultadosIp = (r: ResultadoExposicao): ResultadoIp[] => (r.ip?.resultados ?? []) as ResultadoIp[];

/** Portas por IP. No IP público a chave é fixa: se o IP mudar, as portas continuam comparáveis. */
function portasPorChave(r: ResultadoExposicao): Map<string, { ip: string; portas: Set<number> }> {
  const m = new Map<string, { ip: string; portas: Set<number> }>();
  for (const x of resultadosIp(r)) m.set(r.tipo === 'ip-publico' ? '_' : x.ip, { ip: x.ip, portas: new Set(x.portas ?? []) });
  return m;
}
const cves = (r: ResultadoExposicao) => new Set(resultadosIp(r).flatMap((x) => x.vulnerabilidades ?? []));
const nomes = (r: ResultadoExposicao) => new Set((r.certificados?.nomes ?? []).map((n) => n.nome));
const listaCurta = (xs: string[], n = 5) => (xs.length > n ? `${xs.slice(0, n).join(', ')} e mais ${xs.length - n}` : xs.join(', '));
const igual = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export function resumoDoResultado(r: ResultadoExposicao): ResumoExposicao {
  const portas = new Set(resultadosIp(r).flatMap((x) => (x.portas ?? []).map((p) => `${x.ip}:${p}`)));
  return {
    portas: portas.size,
    subdominios: r.certificados ? r.certificados.subdominios : null,
    cves: cves(r).size,
    avisosDns: r.dns ? r.dns.avisos.length : null,
    ips: resultadosIp(r).map((x) => x.ip),
  };
}

/**
 * O que mudou entre duas varreduras do mesmo alvo. Só compara a fonte que respondeu nas duas:
 * uma consulta que falhou não pode virar "subdomínio sumiu" ou "porta fechada".
 */
export function compararExposicao(anterior: ResultadoExposicao | null, atual: ResultadoExposicao): Mudanca[] {
  if (!anterior) return [];
  const out: Mudanca[] = [];

  if (anterior.certificados && atual.certificados) {
    const antes = nomes(anterior);
    const agora = nomes(atual);
    const novos = [...agora].filter((n) => !antes.has(n));
    for (const n of novos) out.push({ tipo: 'subdominio-novo', severidade: 'media', texto: `Novo nome em certificado público: ${n}` });
    // a lista do crt.sh é cortada nos 200 mais recentes: com corte, um nome fora da lista não "sumiu"
    if (!anterior.certificados.nomesOmitidos && !atual.certificados.nomesOmitidos) {
      const sumiram = [...antes].filter((n) => !agora.has(n));
      if (sumiram.length) out.push({ tipo: 'subdominio-sumiu', severidade: 'info', texto: `Saíram dos certificados: ${listaCurta(sumiram)}` });
    }
  }

  if (anterior.ip && atual.ip) {
    if (atual.tipo === 'ip-publico') {
      const a = resultadosIp(anterior)[0]?.ip;
      const b = resultadosIp(atual)[0]?.ip;
      if (a && b && a !== b) out.push({ tipo: 'ip-publico', severidade: 'media', texto: `O IP público mudou de ${a} para ${b}.` });
    }
    const antes = portasPorChave(anterior);
    for (const [chave, { ip, portas }] of portasPorChave(atual)) {
      const velhas = antes.get(chave)?.portas;
      if (!velhas) continue; // IP novo do domínio: a mudança aparece no registro A
      const abertas = [...portas].filter((p) => !velhas.has(p)).sort((x, y) => x - y);
      const fechadas = [...velhas].filter((p) => !portas.has(p)).sort((x, y) => x - y);
      if (abertas.length) out.push({ tipo: 'porta-aberta', severidade: 'alta', texto: `Porta${abertas.length > 1 ? 's' : ''} ${abertas.join(', ')} passou a aparecer aberta em ${ip}.` });
      if (fechadas.length) out.push({ tipo: 'porta-fechada', severidade: 'info', texto: `Porta${fechadas.length > 1 ? 's' : ''} ${fechadas.join(', ')} deixou de aparecer em ${ip}.` });
    }
    const cvesAntes = cves(anterior);
    const cvesAgora = cves(atual);
    const novas = [...cvesAgora].filter((c) => !cvesAntes.has(c)).sort();
    const resolvidas = [...cvesAntes].filter((c) => !cvesAgora.has(c)).sort();
    if (novas.length) out.push({ tipo: 'cve-nova', severidade: 'alta', texto: `Vulnerabilidade provável nova: ${listaCurta(novas)}.` });
    if (resolvidas.length) out.push({ tipo: 'cve-resolvida', severidade: 'info', texto: `Deixou de aparecer: ${listaCurta(resolvidas)}.` });
  }

  if (anterior.dns && atual.dns) {
    const avisosAntes = new Set(anterior.dns.avisos);
    const avisosAgora = new Set(atual.dns.avisos);
    for (const a of avisosAgora) if (!avisosAntes.has(a)) out.push({ tipo: 'aviso-dns-novo', severidade: 'media', texto: a });
    for (const a of avisosAntes) if (!avisosAgora.has(a)) out.push({ tipo: 'aviso-dns-resolvido', severidade: 'info', texto: `Resolvido: ${a}` });
    const registros: [string, keyof Pick<Dns, 'a' | 'aaaa' | 'mx' | 'ns'>][] = [['A', 'a'], ['AAAA', 'aaaa'], ['MX', 'mx'], ['NS', 'ns']];
    for (const [rotulo, campo] of registros) {
      const x = anterior.dns[campo] as string[];
      const y = atual.dns[campo] as string[];
      if (!igual(x, y)) {
        out.push({ tipo: 'dns-registro', severidade: 'media', texto: `Registro ${rotulo} mudou: antes ${x.length ? listaCurta(x) : '(nenhum)'}; agora ${y.length ? listaCurta(y) : '(nenhum)'}.` });
      }
    }
  }

  // fontes extras: cada uma compara o seu próprio resultado, só se respondeu nas duas varreduras
  const extrasAntes = new Map((anterior.extras ?? []).map((e) => [e.fonte, e]));
  const ctx = contextoDe(atual);
  for (const e of atual.extras ?? []) {
    const antes = extrasAntes.get(e.fonte);
    const fonte = fontePorId(e.fonte);
    if (!antes || !fonte?.comparar) continue;
    try { out.push(...fonte.comparar(antes, e, ctx).map((m) => ({ ...m, fonte: e.fonte }))); }
    catch { /* uma fonte com defeito não derruba a comparação das outras */ }
  }

  return out.sort((x, y) => ORDEM[x.severidade] - ORDEM[y.severidade]);
}

/** O que as fontes básicas descobriram, no formato que as fontes extras recebem. */
export function contextoDe(r: ResultadoExposicao): ContextoFonte {
  const base: BaseColetada = { ips: [], portasPorIp: {} };
  for (const x of resultadosIp(r)) {
    base.ips.push(x.ip);
    base.portasPorIp[x.ip] = x.portas ?? [];
  }
  return { alvo: { tipo: r.tipo, valor: r.valor }, base };
}

// ---------- varredura ----------

const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export async function varrerAlvo(alvo: { tipo: TipoAlvo; valor: string }): Promise<ResultadoExposicao> {
  const r: ResultadoExposicao = { tipo: alvo.tipo, valor: alvo.valor, certificados: null, dns: null, ip: null, erros: [] };
  if (alvo.tipo === 'dominio') {
    const [cert, dns, ip] = await Promise.allSettled([osintCertificados(alvo.valor), osintDns(alvo.valor), osintExposicaoIp(alvo.valor)]);
    if (cert.status === 'fulfilled') r.certificados = cert.value; else r.erros.push({ fonte: 'certificados', mensagem: mensagemDe(cert.reason) });
    if (dns.status === 'fulfilled') r.dns = dns.value; else r.erros.push({ fonte: 'dns', mensagem: mensagemDe(dns.reason) });
    if (ip.status === 'fulfilled') r.ip = ip.value; else r.erros.push({ fonte: 'ip', mensagem: mensagemDe(ip.reason) });
  } else if (alvo.tipo !== 'email') {
    try { r.ip = await osintExposicaoIp(alvo.tipo === 'ip' ? alvo.valor : undefined); }
    catch (e) { r.erros.push({ fonte: 'ip', mensagem: mensagemDe(e) }); }
  }
  await coletarExtras(r);
  return r;
}

const PRAZO_FONTE_MS = 90_000;

async function coletarExtras(r: ResultadoExposicao) {
  const ctx = contextoDe(r);
  const aplicaveis = FONTES.filter((f) => f.aplicaA.includes(r.tipo));
  r.extras = [];
  r.desligadas = [];
  const ativas = aplicaveis.filter((f) => {
    const faltando = f.faltando?.() ?? [];
    if (faltando.length) r.desligadas!.push({ fonte: f.id, nome: f.nome, faltando });
    return faltando.length === 0;
  });
  const resultados = await Promise.allSettled(ativas.map((f) => Promise.race([
    f.coletar(ctx),
    new Promise<never>((_, nao) => setTimeout(() => nao(new Error('não respondeu a tempo')), PRAZO_FONTE_MS).unref()),
  ])));
  resultados.forEach((res, i) => {
    if (res.status === 'fulfilled') { if (res.value) r.extras!.push(res.value); }
    else r.erros.push({ fonte: ativas[i].nome, mensagem: mensagemDe(res.reason) });
  });
}

const rotuloDoAlvo = (a: { tipo: string; valor: string }) => (a.tipo === 'ip-publico' ? 'IP público do servidor' : a.valor);

/** Varre, compara com a última varredura e grava. Registra cada mudança no stdout para o SIEM. */
export async function executarVarredura(alvo: { id: string; usuarioId: string; tipo: string; valor: string }) {
  const anterior = await prisma.exposicaoVarredura.findFirst({ where: { alvoId: alvo.id }, orderBy: { criadoEm: 'desc' } });
  const resultado = await varrerAlvo({ tipo: alvo.tipo as TipoAlvo, valor: alvo.valor });
  const mudancas = compararExposicao((anterior?.resultado as ResultadoExposicao | undefined) ?? null, resultado);
  const todasFalharam = !resultado.certificados && !resultado.dns && !resultado.ip && !resultado.extras?.length;
  const salvo = await prisma.exposicaoVarredura.create({
    data: {
      alvoId: alvo.id, usuarioId: alvo.usuarioId,
      resultado: resultado as unknown as Prisma.InputJsonValue,
      mudancas: mudancas as unknown as Prisma.InputJsonValue,
      erro: todasFalharam ? resultado.erros.map((e) => `${e.fonte}: ${e.mensagem}`).join(' | ').slice(0, 500) : null,
    },
  });
  try {
    await notificarMudancas({ alvo: rotuloDoAlvo(alvo), tipoAlvo: alvo.tipo, quando: salvo.criadoEm.toISOString(), mudancas });
  } catch { /* aviso é melhor-esforço: a varredura já foi gravada */ }
  return salvo;
}

// ---------- agendador ----------

export const intervaloHoras = () => {
  const v = Number(process.env.EXPOSICAO_INTERVALO_HORAS ?? '24');
  return Number.isFinite(v) && v >= 0 ? v : 24;
};

export function iniciarAgendadorExposicao(app: FastifyInstance) {
  if (!process.env.DATABASE_URL) return;
  const horas = intervaloHoras();
  if (horas === 0) return;
  let rodando = false;
  const ciclo = async () => {
    if (rodando) return;
    rodando = true;
    try {
      const limite = new Date(Date.now() - horas * 3_600_000);
      const alvos = await prisma.exposicaoAlvo.findMany({
        where: { ativo: true },
        include: { varreduras: { orderBy: { criadoEm: 'desc' }, take: 1, select: { criadoEm: true } } },
      });
      // um alvo por vez, com folga entre eles: crt.sh e Shodan são serviços gratuitos
      for (const a of alvos) {
        const ultima = a.varreduras[0]?.criadoEm;
        if (ultima && ultima > limite) continue;
        try { await executarVarredura(a); }
        catch (e) { app.log.warn({ err: mensagemDe(e), alvoId: a.id }, 'exposição: varredura falhou'); }
        await new Promise((r) => setTimeout(r, 5_000));
      }
    } catch (e) {
      app.log.warn({ err: mensagemDe(e) }, 'exposição: ciclo do agendador falhou');
    } finally {
      rodando = false;
    }
  };
  const intervalo = setInterval(ciclo, 3_600_000);
  const inicial = setTimeout(ciclo, 5 * 60_000);
  intervalo.unref();
  inicial.unref();
  app.addHook('onClose', async () => {
    clearInterval(intervalo);
    clearTimeout(inicial);
  });
}

// ---------- rotas ----------

const MAX_ALVOS = 20;
const ESPERA_ENTRE_VARREDURAS_MS = 2 * 60_000;
const emVarredura = new Set<string>();

const NovoAlvo = z.object({
  tipo: z.enum(['dominio', 'ip', 'ip-publico', 'email']),
  valor: z.string().trim().max(253).optional(),
  rotulo: z.string().trim().max(60).optional(),
});

/** Valida e normaliza o valor do alvo; devolve a mensagem de erro quando não serve. */
export function validarAlvo(tipo: TipoAlvo, valor = ''): { valor: string } | { erro: string } {
  if (tipo === 'ip-publico') return { valor: '' };
  if (tipo === 'email') {
    const e = valor.trim().toLowerCase();
    const [local, dominio] = e.split('@');
    return e.length <= 254 && local && /^[a-z0-9._%+-]{1,64}$/.test(local) && dominio && normalizarDominio(dominio) === dominio && e.split('@').length === 2
      ? { valor: e } : { erro: 'E-mail inválido.' };
  }
  if (tipo === 'dominio') {
    const d = normalizarDominio(valor);
    return d ? { valor: d } : { erro: 'Domínio inválido (ex.: exemplo.com.br).' };
  }
  if (!isIP(valor)) return { erro: 'IP inválido.' };
  if (ipNaoPublico(valor)) return { erro: 'IP privado ou reservado: não aparece na internet. Use um IP público.' };
  return { valor };
}

const varreduraParaApi = (v: { id: string; criadoEm: Date; resultado: unknown; mudancas: unknown; erro: string | null }) => ({
  id: v.id,
  criadoEm: v.criadoEm,
  erro: v.erro,
  mudancas: v.mudancas as Mudanca[],
  resultado: v.resultado as ResultadoExposicao,
  resumo: resumoDoResultado(v.resultado as ResultadoExposicao),
});

export async function registerExposicaoRoutes(app: FastifyInstance) {
  const uid = (req: unknown) => (req as AuthedRequest).usuarioId;
  const idDe = (req: unknown) => (req as { params: { id: string } }).params.id;

  app.get('/api/exposicao', async (req) => {
    const usuarioId = uid(req);
    const [alvos, recentes] = await Promise.all([
      prisma.exposicaoAlvo.findMany({
        where: { usuarioId },
        orderBy: { criadoEm: 'asc' },
        include: { varreduras: { orderBy: { criadoEm: 'desc' }, take: 1 } },
      }),
      prisma.exposicaoVarredura.findMany({
        where: { usuarioId },
        orderBy: { criadoEm: 'desc' },
        take: 60,
        select: { id: true, alvoId: true, criadoEm: true, mudancas: true },
      }),
    ]);
    const mudancas = recentes
      .flatMap((v) => (v.mudancas as unknown as Mudanca[]).map((m, i) => ({ ...m, id: `${v.id}:${i}`, alvoId: v.alvoId, criadoEm: v.criadoEm })))
      .slice(0, 100);
    return {
      intervaloHoras: intervaloHoras(),
      alvos: alvos.map(({ varreduras, ...a }) => ({ ...a, ultima: varreduras[0] ? varreduraParaApi(varreduras[0]) : null })),
      mudancas,
    };
  });

  app.post('/api/exposicao/alvos', async (req, reply) => {
    const usuarioId = uid(req);
    const b = NovoAlvo.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'informe o tipo do alvo e o valor' });
    const v = validarAlvo(b.data.tipo, b.data.valor);
    if ('erro' in v) return reply.status(400).send({ error: v.erro });
    if ((await prisma.exposicaoAlvo.count({ where: { usuarioId } })) >= MAX_ALVOS) {
      return reply.status(400).send({ error: `Limite de ${MAX_ALVOS} alvos. Remova um para incluir outro.` });
    }
    try {
      const alvo = await prisma.exposicaoAlvo.create({ data: { usuarioId, tipo: b.data.tipo, valor: v.valor, rotulo: b.data.rotulo || null } });
      return reply.status(201).send(alvo);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return reply.status(409).send({ error: 'Este alvo já está na lista.' });
      throw e;
    }
  });

  app.delete('/api/exposicao/alvos/:id', async (req, reply) => {
    const r = await prisma.exposicaoAlvo.deleteMany({ where: { id: idDe(req), usuarioId: uid(req) } });
    if (r.count === 0) return reply.status(404).send({ error: 'alvo não encontrado' });
    return { ok: true };
  });

  app.post('/api/exposicao/alvos/:id/varrer', async (req, reply) => {
    const alvo = await prisma.exposicaoAlvo.findFirst({ where: { id: idDe(req), usuarioId: uid(req) } });
    if (!alvo) return reply.status(404).send({ error: 'alvo não encontrado' });
    if (emVarredura.has(alvo.id)) return reply.status(409).send({ error: 'Este alvo já está sendo varrido.' });
    const ultima = await prisma.exposicaoVarredura.findFirst({ where: { alvoId: alvo.id }, orderBy: { criadoEm: 'desc' }, select: { criadoEm: true } });
    if (ultima && Date.now() - ultima.criadoEm.getTime() < ESPERA_ENTRE_VARREDURAS_MS) {
      return reply.status(429).send({ error: 'Varrido há menos de 2 minutos. As fontes são gratuitas: espere um pouco.' });
    }
    emVarredura.add(alvo.id);
    try {
      return varreduraParaApi(await executarVarredura(alvo));
    } finally {
      emVarredura.delete(alvo.id);
    }
  });

  app.get('/api/exposicao/alvos/:id/historico', async (req, reply) => {
    const alvo = await prisma.exposicaoAlvo.findFirst({ where: { id: idDe(req), usuarioId: uid(req) }, select: { id: true } });
    if (!alvo) return reply.status(404).send({ error: 'alvo não encontrado' });
    const varreduras = await prisma.exposicaoVarredura.findMany({ where: { alvoId: alvo.id }, orderBy: { criadoEm: 'desc' }, take: 30 });
    return varreduras.map((v) => {
      const { resultado: _r, ...resto } = varreduraParaApi(v);
      return resto;
    });
  });
}
