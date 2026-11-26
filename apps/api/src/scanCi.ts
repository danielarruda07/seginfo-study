import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { escanear, type ScanRelatorio, type Severidade } from './scanEndpoint.js';

/**
 * Rota de PIPELINE: higiene de endpoint como quality gate, chamável pela CI/CD.
 *
 * Diferente de /api/scan (que fica atrás do Cloudflare Access, para o operador no navegador),
 * esta roda fora do hook de usuário porque a CI não tem navegador nem sessão. A autenticação
 * é por HMAC-SHA256 sobre o corpo cru, com o segredo compartilhado SCAN_CI_SECRET:
 *
 *   assinatura = HMAC_SHA256(SCAN_CI_SECRET, `${timestamp}.${corpoCru}`)
 *   Headers:  X-Scan-Timestamp: <unix segundos>   X-Scan-Signature: sha256=<hex>
 *
 * Protege contra replay (janela de 300s) e compara em tempo constante. Fail-closed:
 * sem SCAN_CI_SECRET a rota responde 503. Continua NÃO destrutiva (só GET/HEAD/OPTIONS,
 * reaproveita o motor de scanEndpoint) e só bate no alvo que o pipeline mandar — o operador
 * é responsável por só apontar para alvos autorizados.
 */

export interface LimitesGate {
  alta: number;
  media: number;
  baixa: number;
}

/** Limite padrão do gate: nenhum achado alto; médios/baixos não bloqueiam. */
export const LIMITES_PADRAO: LimitesGate = { alta: 0, media: Infinity, baixa: Infinity };

export interface ResultadoGate {
  passou: boolean;
  limites: LimitesGate;
  contagem: Record<Severidade, number>;
  motivos: string[];
}

const JANELA_SEG = 300;

/** Conta achados por severidade. Pura. */
export function contarSeveridade(achados: { severidade: Severidade }[]): Record<Severidade, number> {
  const base: Record<Severidade, number> = { alta: 0, media: 0, baixa: 0, info: 0 };
  for (const a of achados) base[a.severidade]++;
  return base;
}

/** Decide se o scan passa no gate, comparando a contagem com os limites. Pura. */
export function avaliarGate(contagem: Record<Severidade, number>, limites: LimitesGate): ResultadoGate {
  const motivos: string[] = [];
  if (contagem.alta > limites.alta) motivos.push(`${contagem.alta} achado(s) alto(s) > limite ${limites.alta}`);
  if (contagem.media > limites.media) motivos.push(`${contagem.media} achado(s) médio(s) > limite ${limites.media}`);
  const baixos = contagem.baixa + contagem.info;
  if (baixos > limites.baixa) motivos.push(`${baixos} achado(s) baixo(s)/info > limite ${limites.baixa}`);
  return { passou: motivos.length === 0, limites, contagem, motivos };
}

/** Resolve os limites efetivos a partir do que o pipeline mandou (campos ausentes usam o padrão). */
export function resolverLimites(p: { alta?: number; media?: number; baixa?: number } | undefined): LimitesGate {
  return {
    alta: p?.alta ?? LIMITES_PADRAO.alta,
    media: p?.media ?? LIMITES_PADRAO.media,
    baixa: p?.baixa ?? LIMITES_PADRAO.baixa,
  };
}

const header = (req: FastifyRequest, nome: string): string | undefined => {
  const v = req.headers[nome];
  return Array.isArray(v) ? v[0] : v;
};

/** Verifica a assinatura HMAC do corpo cru, com proteção de replay. Pura (recebe o "agora"). */
export function verificarAssinatura(opts: {
  secret: string;
  timestamp: string | undefined;
  corpoCru: string;
  assinatura: string | undefined;
  agora?: number;
  janelaSeg?: number;
}): { ok: boolean; erro?: string } {
  const { secret, timestamp, corpoCru, assinatura } = opts;
  const agora = opts.agora ?? Date.now();
  const janela = opts.janelaSeg ?? JANELA_SEG;
  if (!timestamp || !assinatura) return { ok: false, erro: 'faltam cabeçalhos de assinatura' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, erro: 'timestamp inválido' };
  if (Math.abs(agora / 1000 - ts) > janela) return { ok: false, erro: 'timestamp fora da janela (replay?)' };

  const recebida = assinatura.replace(/^sha256=/i, '').trim().toLowerCase();
  const esperada = createHmac('sha256', secret).update(`${timestamp}.${corpoCru}`).digest('hex');
  let bRecebida: Buffer;
  let bEsperada: Buffer;
  try {
    bRecebida = Buffer.from(recebida, 'hex');
    bEsperada = Buffer.from(esperada, 'hex');
  } catch {
    return { ok: false, erro: 'assinatura mal formada' };
  }
  if (bRecebida.length !== bEsperada.length || !timingSafeEqual(bRecebida, bEsperada)) {
    return { ok: false, erro: 'assinatura não confere' };
  }
  return { ok: true };
}

const Limites = z.object({ alta: z.number().int().min(0).optional(), media: z.number().int().min(0).optional(), baixa: z.number().int().min(0).optional() });
const Body = z.object({
  url: z.string().url().optional(),
  urls: z.array(z.string().url()).max(15).optional(),
  exposicoes: z.boolean().optional(),
  openapi: z.boolean().optional(),
  limites: Limites.optional(),
}).refine((b) => b.url || (b.urls && b.urls.length), { message: 'Informe url ou urls.' });

interface ItemGate { url: string; gate: ResultadoGate; relatorio?: ScanRelatorio; erro?: string }

export function registerScanCiRoutes(app: FastifyInstance) {
  // Escopo encapsulado: o parser de corpo cru vale só para esta rota, sem afetar o resto da API.
  app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
      (_req as FastifyRequest & { corpoCru?: string }).corpoCru = body as string;
      try {
        done(null, body ? JSON.parse(body as string) : {});
      } catch (e) {
        done(e as Error);
      }
    });

    scope.post('/api/scan/ci', { bodyLimit: 64 * 1024 }, async (req, reply) => {
      const secret = process.env.SCAN_CI_SECRET;
      if (!secret) {
        req.log.error('SCAN_CI_SECRET não configurado; recusando (fail-closed).');
        return reply.status(503).send({ error: 'Gate de CI não configurado.' });
      }

      const corpoCru = (req as FastifyRequest & { corpoCru?: string }).corpoCru ?? '';
      const assin = verificarAssinatura({
        secret,
        timestamp: header(req, 'x-scan-timestamp'),
        corpoCru,
        assinatura: header(req, 'x-scan-signature'),
      });
      if (!assin.ok) {
        req.log.warn({ ip: req.ip, motivo: assin.erro }, 'scan/ci: assinatura recusada');
        return reply.status(401).send({ error: 'Não autenticado.', detalhe: assin.erro });
      }

      const b = Body.safeParse(req.body);
      if (!b.success) return reply.status(400).send({ error: 'Informe url (ou urls) e limites opcionais.' });

      const limites = resolverLimites(b.data.limites);
      const opts = { exposicoes: b.data.exposicoes ?? true, openapi: b.data.openapi };
      const alvos = b.data.urls && b.data.urls.length ? b.data.urls : [b.data.url!];

      const itens: ItemGate[] = await Promise.all(alvos.map(async (url): Promise<ItemGate> => {
        try {
          const relatorio = await escanear(url, opts);
          return { url, gate: avaliarGate(contarSeveridade(relatorio.achados), limites), relatorio };
        } catch (e) {
          // alvo inalcançável/invalido reprova o gate, para a CI não passar "no verde" por engano
          return { url, gate: { passou: false, limites, contagem: { alta: 0, media: 0, baixa: 0, info: 0 }, motivos: ['falha ao escanear'] }, erro: e instanceof Error ? e.message : 'falha' };
        }
      }));

      const passou = itens.every((i) => i.gate.passou);
      const corpo = {
        passou,
        limites,
        em: new Date().toISOString(),
        resultados: itens,
      };
      // 200 quando passa, 422 quando reprova: a CI pode usar o código de saída do curl --fail-with-body.
      return reply.status(passou ? 200 : 422).send(corpo);
    });
  });
}
