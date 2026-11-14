import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';
import { cifrarSegredo, decifrarSegredo } from './storage-crypto.js';

/**
 * Segundo fator do Cofre (TOTP, RFC 6238: Google Authenticator, Authy, Microsoft Authenticator).
 *
 * Quem confere o código é o SERVIDOR. Só depois de um código válido ele emite uma sessão curta
 * (cabeçalho X-Cofre-Sessao) e entrega o blob do Cofre, que continua cifrado com a senha-mestra:
 * o servidor nunca vê a senha-mestra nem as credenciais. Camadas: Cloudflare Access (identidade)
 * -> TOTP conferido aqui -> senha-mestra no navegador.
 *
 * - segredo TOTP guardado cifrado (AES-256-GCM, STORAGE_TOKEN_KEY);
 * - código usado uma vez só (anti-replay pelo passo de tempo);
 * - 5 erros seguidos bloqueiam por 5 min, dobrando até 1 h;
 * - 10 códigos de recuperação de uso único, guardados só como hash;
 * - sessão de 15 min renovada a cada uso, guardada só como hash;
 * - todo acesso e toda falha viram um CofreEvento.
 */

// ===================== núcleo puro (testado em cofre2fa.test.ts) =====================

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let valor = 0;
  let out = '';
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(valor << (5 - bits)) & 31];
  return out;
}

export function base32Decode(texto: string): Buffer {
  const limpo = texto.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let valor = 0;
  const out: number[] = [];
  for (const c of limpo) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error('base32 inválido');
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const PERIODO_S = 30;
export const DIGITOS = 6;
/** Aceita o passo atual e um vizinho de cada lado (relógio do celular até ~30 s fora). */
export const JANELA = 1;

export function passoDe(agoraMs: number): number {
  return Math.floor(agoraMs / 1000 / PERIODO_S);
}

/** HOTP (RFC 4226) com HMAC-SHA1, o que os apps autenticadores usam por padrão. */
export function hotp(segredo: Buffer, contador: number, digitos = DIGITOS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(contador));
  const h = createHmac('sha1', segredo).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** digitos).padStart(digitos, '0');
}

export function totp(segredo: Buffer, agoraMs: number, digitos = DIGITOS): string {
  return hotp(segredo, passoDe(agoraMs), digitos);
}

function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Confere um código TOTP. Devolve o passo de tempo aceito, ou null.
 * Recusa passos já usados (`ultimoPasso`): o mesmo código não serve duas vezes.
 */
export function verificarTotp(segredo: Buffer, codigo: string, agoraMs: number, ultimoPasso: number): number | null {
  const limpo = codigo.replace(/\s/g, '');
  if (!/^\d{6}$/.test(limpo)) return null;
  const atual = passoDe(agoraMs);
  for (let d = -JANELA; d <= JANELA; d++) {
    const passo = atual + d;
    if (passo <= ultimoPasso) continue;
    if (iguais(hotp(segredo, passo), limpo)) return passo;
  }
  return null;
}

export function gerarSegredo(): Buffer {
  return randomBytes(20); // 160 bits, tamanho recomendado pela RFC 4226
}

export function otpauthUri(segredoB32: string, conta: string, emissor = 'SegInfo Cofre'): string {
  const rotulo = encodeURIComponent(`${emissor}:${conta}`);
  const params = new URLSearchParams({ secret: segredoB32, issuer: emissor, algorithm: 'SHA1', digits: String(DIGITOS), period: String(PERIODO_S) });
  return `otpauth://totp/${rotulo}?${params.toString()}`;
}

export function hashCodigo(codigo: string): string {
  return createHash('sha256').update(normalizarRecuperacao(codigo)).digest('hex');
}

export function normalizarRecuperacao(codigo: string): string {
  return codigo.toUpperCase().replace(/[^A-Z2-7]/g, '');
}

/** 10 códigos no formato XXXXX-XXXXX (50 bits cada). */
export function gerarCodigosRecuperacao(qtd = 10): string[] {
  return Array.from({ length: qtd }, () => {
    const c = base32Encode(randomBytes(7)).slice(0, 10);
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
}

/** Consome um código de recuperação. Devolve a lista sem ele, ou null se não confere. */
export function consumirRecuperacao(hashes: string[], codigo: string): string[] | null {
  if (normalizarRecuperacao(codigo).length !== 10) return null;
  const h = hashCodigo(codigo);
  const i = hashes.findIndex((x) => iguais(x, h));
  if (i < 0) return null;
  return [...hashes.slice(0, i), ...hashes.slice(i + 1)];
}

export const MAX_FALHAS = 5;
export const BLOQUEIO_BASE_MS = 5 * 60_000;
export const BLOQUEIO_MAX_MS = 60 * 60_000;

/** Bloqueio depois de `falhas` erros seguidos: 0 até 4 erros; 5 min no 5º, dobrando até 1 h. */
export function bloqueioMs(falhas: number): number {
  if (falhas < MAX_FALHAS) return 0;
  return Math.min(BLOQUEIO_BASE_MS * 2 ** (falhas - MAX_FALHAS), BLOQUEIO_MAX_MS);
}

export const SESSAO_MS = 15 * 60_000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ===================== integração com a API =====================

const HEADER = 'x-cofre-sessao';

function ipDe(req: FastifyRequest): string {
  const cf = req.headers['cf-connecting-ip'];
  return (Array.isArray(cf) ? cf[0] : cf) ?? req.ip;
}

export async function registrarEvento(req: FastifyRequest, tipo: string, detalhe = ''): Promise<void> {
  const ua = req.headers['user-agent'];
  await prisma.cofreEvento.create({
    data: { usuarioId: (req as AuthedRequest).usuarioId, tipo, detalhe, ip: ipDe(req).slice(0, 64), agente: (ua ?? '').slice(0, 200) },
  });
}

async function criarSessao(usuarioId: string): Promise<{ token: string; expiraEm: string }> {
  const token = randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + SESSAO_MS);
  await prisma.cofreSessao.deleteMany({ where: { usuarioId, expiraEm: { lt: new Date() } } });
  await prisma.cofreSessao.create({ data: { usuarioId, tokenHash: hashToken(token), expiraEm } });
  return { token, expiraEm: expiraEm.toISOString() };
}

/** Sessão válida do cabeçalho X-Cofre-Sessao (renova por mais 15 min), ou null. */
export async function sessaoValida(req: FastifyRequest): Promise<{ expiraEm: Date } | null> {
  const raw = req.headers[HEADER];
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (!token || token.length > 100) return null;
  const s = await prisma.cofreSessao.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!s || s.usuarioId !== (req as AuthedRequest).usuarioId || s.expiraEm < new Date()) return null;
  const expiraEm = new Date(Date.now() + SESSAO_MS);
  await prisma.cofreSessao.update({ where: { id: s.id }, data: { expiraEm } });
  return { expiraEm };
}

/**
 * Guarda das rotas do blob: exige 2FA ativo E sessão válida. Responde e devolve false se não.
 * Sem 2FA ativo o servidor não entrega nem aceita o Cofre: ele mora só no navegador.
 */
export async function exigirSessaoCofre(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const cfg = await prisma.cofre2fa.findUnique({ where: { usuarioId: (req as AuthedRequest).usuarioId } });
  if (!cfg?.ativo) {
    reply.status(403).send({ error: 'Ative o segundo fator para guardar o Cofre no servidor.', codigo: '2FA_INATIVO' });
    return false;
  }
  if (!(await sessaoValida(req))) {
    reply.status(401).send({ error: 'Informe o código do autenticador.', codigo: '2FA_NECESSARIO' });
    return false;
  }
  return true;
}

const Fator = z.object({
  codigo: z.string().max(20).optional(),
  recuperacao: z.string().max(40).optional(),
}).refine((v) => !!v.codigo || !!v.recuperacao, { message: 'informe o código' });

type Cfg = NonNullable<Awaited<ReturnType<typeof prisma.cofre2fa.findUnique>>>;

/**
 * Confere código TOTP ou de recuperação contra a configuração ATIVA, com bloqueio e auditoria.
 * Responde o erro e devolve null se falhar.
 */
async function conferirFator(req: FastifyRequest, reply: FastifyReply, cfg: Cfg, body: unknown): Promise<Cfg | null> {
  const agora = Date.now();
  if (cfg.bloqueadoAte && cfg.bloqueadoAte.getTime() > agora) {
    await registrarEvento(req, '2fa_bloqueado');
    reply.status(429).send({ error: `Muitas tentativas erradas. Tente de novo após ${cfg.bloqueadoAte.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`, bloqueadoAte: cfg.bloqueadoAte.toISOString() });
    return null;
  }
  const b = Fator.safeParse(body);
  if (!b.success) {
    reply.status(400).send({ error: 'Informe o código de 6 dígitos ou um código de recuperação.' });
    return null;
  }

  let dados: { ultimoPasso?: number; codigosRecuperacao?: string[] } | null = null;
  if (b.data.codigo) {
    const passo = verificarTotp(Buffer.from(decifrarSegredo(cfg.segredo), 'base64'), b.data.codigo, agora, cfg.ultimoPasso);
    if (passo !== null) dados = { ultimoPasso: passo };
  } else if (b.data.recuperacao) {
    const resto = consumirRecuperacao(cfg.codigosRecuperacao, b.data.recuperacao);
    if (resto) dados = { codigosRecuperacao: resto };
  }

  if (!dados) {
    const falhas = cfg.falhas + 1;
    const ms = bloqueioMs(falhas);
    await prisma.cofre2fa.update({ where: { usuarioId: cfg.usuarioId }, data: { falhas, bloqueadoAte: ms ? new Date(agora + ms) : null } });
    await registrarEvento(req, '2fa_falha', b.data.recuperacao ? 'codigo de recuperacao' : 'codigo do autenticador');
    const restam = MAX_FALHAS - falhas;
    reply.status(401).send({ error: ms ? `Código incorreto. Bloqueado por ${Math.round(ms / 60_000)} min.` : `Código incorreto ou já usado.${restam > 0 && restam < 3 ? ` Restam ${restam} tentativa(s) antes do bloqueio.` : ''}` });
    return null;
  }

  const atualizado = await prisma.cofre2fa.update({ where: { usuarioId: cfg.usuarioId }, data: { ...dados, falhas: 0, bloqueadoAte: null } });
  if (dados.codigosRecuperacao) await registrarEvento(req, 'recuperacao_usada', `${dados.codigosRecuperacao.length} restantes`);
  return atualizado;
}

export async function registerCofre2faRoutes(app: FastifyInstance) {
  const uid = (req: unknown) => (req as AuthedRequest).usuarioId;

  app.get('/api/cofre/2fa', async (req) => {
    const cfg = await prisma.cofre2fa.findUnique({ where: { usuarioId: uid(req) } });
    const blob = await prisma.cofreBlob.findUnique({ where: { usuarioId: uid(req) }, select: { atualizadoEm: true } });
    const sessao = cfg?.ativo ? await sessaoValida(req) : null;
    return {
      ativo: !!cfg?.ativo,
      pendente: !!cfg && !cfg.ativo,
      ativadoEm: cfg?.ativadoEm?.toISOString() ?? null,
      codigosRestantes: cfg?.ativo ? cfg.codigosRecuperacao.length : 0,
      bloqueadoAte: cfg?.bloqueadoAte && cfg.bloqueadoAte > new Date() ? cfg.bloqueadoAte.toISOString() : null,
      sessaoAte: sessao?.expiraEm.toISOString() ?? null,
      temCofre: !!blob,
    };
  });

  // passo 1 da ativação: gera o segredo (pendente até confirmar um código)
  app.post('/api/cofre/2fa/iniciar', async (req, reply) => {
    const atual = await prisma.cofre2fa.findUnique({ where: { usuarioId: uid(req) } });
    if (atual?.ativo) return reply.status(409).send({ error: 'O segundo fator já está ativo.' });
    const segredo = gerarSegredo();
    let cifrado: string;
    try {
      cifrado = cifrarSegredo(segredo.toString('base64'));
    } catch (e) {
      req.log.error({ err: (e as Error).message }, 'cofre 2fa: chave de cifra ausente');
      return reply.status(503).send({ error: 'Servidor sem STORAGE_TOKEN_KEY configurada: não dá para guardar o segredo do autenticador com segurança.' });
    }
    await prisma.cofre2fa.upsert({
      where: { usuarioId: uid(req) },
      update: { segredo: cifrado, ativo: false, ultimoPasso: 0, falhas: 0, bloqueadoAte: null, codigosRecuperacao: [] },
      create: { usuarioId: uid(req), segredo: cifrado },
    });
    const b32 = base32Encode(segredo);
    return { segredo: b32, otpauth: otpauthUri(b32, (req as AuthedRequest).email) };
  });

  // passo 2: confirma o primeiro código, liga o 2FA e entrega os códigos de recuperação (única vez)
  app.post('/api/cofre/2fa/ativar', async (req, reply) => {
    const cfg = await prisma.cofre2fa.findUnique({ where: { usuarioId: uid(req) } });
    if (!cfg) return reply.status(400).send({ error: 'Comece a ativação primeiro.' });
    if (cfg.ativo) return reply.status(409).send({ error: 'O segundo fator já está ativo.' });
    // O Cofre (já cifrado no navegador) vem junto: ligar o 2FA e guardar o blob é atômico,
    // para nunca ficar "2FA ligado e Cofre fora do servidor".
    const b = z.object({
      codigo: z.string().max(20),
      cofre: z.object({ versao: z.literal(1), salt: z.string().max(100), iv: z.string().max(100), ciphertext: z.string().max(5_000_000) }),
    }).safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'Envie o código e o Cofre destravado.' });
    const passo = verificarTotp(Buffer.from(decifrarSegredo(cfg.segredo), 'base64'), b.data.codigo, Date.now(), 0);
    if (passo === null) {
      await registrarEvento(req, '2fa_falha', 'confirmacao da ativacao');
      return reply.status(401).send({ error: 'Código incorreto. Confira se o relógio do celular está certo e tente o código atual.' });
    }
    const codigos = gerarCodigosRecuperacao();
    const blob = { versao: 1, salt: b.data.cofre.salt, iv: b.data.cofre.iv, ciphertext: b.data.cofre.ciphertext };
    const [, salvo] = await prisma.$transaction([
      prisma.cofre2fa.update({
        where: { usuarioId: uid(req) },
        data: { ativo: true, ultimoPasso: passo, falhas: 0, bloqueadoAte: null, codigosRecuperacao: codigos.map(hashCodigo), ativadoEm: new Date() },
      }),
      prisma.cofreBlob.upsert({ where: { usuarioId: uid(req) }, update: blob, create: { ...blob, usuarioId: uid(req) } }),
      prisma.cofreSessao.deleteMany({ where: { usuarioId: uid(req) } }),
    ]);
    await registrarEvento(req, '2fa_ativado');
    return { codigosRecuperacao: codigos, sessao: await criarSessao(uid(req)), atualizadoEm: salvo.atualizadoEm.toISOString() };
  });

  // abrir o Cofre: código do autenticador (ou de recuperação) -> sessão de 15 min
  app.post('/api/cofre/2fa/verificar', async (req, reply) => {
    const cfg = await prisma.cofre2fa.findUnique({ where: { usuarioId: uid(req) } });
    if (!cfg?.ativo) return reply.status(400).send({ error: 'O segundo fator não está ativo.' });
    const ok = await conferirFator(req, reply, cfg, req.body);
    if (!ok) return reply;
    await registrarEvento(req, '2fa_ok');
    return { sessao: await criarSessao(uid(req)), codigosRestantes: ok.codigosRecuperacao.length };
  });

  app.post('/api/cofre/2fa/sair', async (req) => {
    const raw = req.headers[HEADER];
    const token = Array.isArray(raw) ? raw[0] : raw;
    if (token) await prisma.cofreSessao.deleteMany({ where: { usuarioId: uid(req), tokenHash: hashToken(token) } });
    return { ok: true };
  });

  // ações sensíveis: sessão válida + código novo
  app.post('/api/cofre/2fa/codigos', async (req, reply) => {
    if (!(await exigirSessaoCofre(req, reply))) return reply;
    const cfg = await prisma.cofre2fa.findUniqueOrThrow({ where: { usuarioId: uid(req) } });
    const ok = await conferirFator(req, reply, cfg, req.body);
    if (!ok) return reply;
    const codigos = gerarCodigosRecuperacao();
    await prisma.cofre2fa.update({ where: { usuarioId: uid(req) }, data: { codigosRecuperacao: codigos.map(hashCodigo) } });
    await registrarEvento(req, 'codigos_regenerados');
    return { codigosRecuperacao: codigos };
  });

  // desligar: apaga o segredo, as sessões e o blob do servidor (o navegador guarda a cópia local antes)
  app.post('/api/cofre/2fa/desativar', async (req, reply) => {
    if (!(await exigirSessaoCofre(req, reply))) return reply;
    const cfg = await prisma.cofre2fa.findUniqueOrThrow({ where: { usuarioId: uid(req) } });
    const ok = await conferirFator(req, reply, cfg, req.body);
    if (!ok) return reply;
    await prisma.$transaction([
      prisma.cofreBlob.deleteMany({ where: { usuarioId: uid(req) } }),
      prisma.cofreSessao.deleteMany({ where: { usuarioId: uid(req) } }),
      prisma.cofre2fa.delete({ where: { usuarioId: uid(req) } }),
    ]);
    await registrarEvento(req, '2fa_desativado');
    return { ok: true };
  });

  app.get('/api/cofre/eventos', async (req) =>
    prisma.cofreEvento.findMany({
      where: { usuarioId: uid(req) },
      orderBy: { criadoEm: 'desc' },
      take: 30,
      select: { id: true, tipo: true, detalhe: true, ip: true, agente: true, criadoEm: true },
    }));
}
