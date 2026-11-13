import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

/**
 * Fluxo completo das rotas do Cofre com um banco em memória: o que o navegador faz de verdade
 * (ativar, abrir com código, ler/gravar o blob, conflito, bloqueio, recuperação, desativar).
 */

type Linha = Record<string, any>;
const db = vi.hoisted(() => ({
  usuario: new Map<string, Linha>(),
  cofre2fa: new Map<string, Linha>(),
  cofreBlob: new Map<string, Linha>(),
  cofreSessao: new Map<string, Linha>(),
  cofreEvento: [] as Linha[],
  seq: 0,
}));

vi.mock('./db.js', () => {
  const casa = (l: Linha, where: Linha) => Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('lt' in v) return l[k] < (v as { lt: Date }).lt;
    }
    return l[k] === v;
  });
  const porChave = (mapa: Map<string, Linha>, chave: string) => ({
    findUnique: async ({ where, select }: { where: Linha; select?: Linha }) => {
      const l = where[chave] !== undefined ? mapa.get(where[chave]) : [...mapa.values()].find((x) => casa(x, where));
      if (!l) return null;
      return select ? Object.fromEntries(Object.keys(select).map((k) => [k, l[k]])) : { ...l };
    },
    findUniqueOrThrow: async ({ where }: { where: Linha }) => {
      const l = mapa.get(where[chave]);
      if (!l) throw new Error('não encontrado');
      return { ...l };
    },
    upsert: async ({ where, update, create }: { where: Linha; update: Linha; create: Linha }) => {
      const atual = mapa.get(where[chave]);
      const l = atual ? { ...atual, ...update } : { ...create };
      l.atualizadoEm = new Date(Date.now() + ++db.seq); // sempre muda: simula @updatedAt
      mapa.set(l[chave], l);
      return { ...l };
    },
    update: async ({ where, data }: { where: Linha; data: Linha }) => {
      const k = where[chave] ?? [...mapa.values()].find((x) => casa(x, where))?.[chave];
      const l = { ...mapa.get(k)!, ...data, atualizadoEm: new Date() };
      mapa.set(k, l);
      return { ...l };
    },
    create: async ({ data }: { data: Linha }) => {
      const l: Linha = { id: `id${++db.seq}`, criadoEm: new Date(), ...data };
      mapa.set(l[chave], l);
      return { ...l };
    },
    delete: async ({ where }: { where: Linha }) => { mapa.delete(where[chave]); return {}; },
    deleteMany: async ({ where }: { where: Linha }) => {
      let count = 0;
      for (const [k, l] of mapa) if (casa(l, where)) { mapa.delete(k); count++; }
      return { count };
    },
  });
  const prisma = {
    cofre2fa: porChave(db.cofre2fa, 'usuarioId'),
    cofreBlob: porChave(db.cofreBlob, 'usuarioId'),
    cofreSessao: porChave(db.cofreSessao, 'tokenHash'),
    cofreEvento: {
      create: async ({ data }: { data: Linha }) => { db.cofreEvento.push({ id: `e${++db.seq}`, criadoEm: new Date(), ...data }); return {}; },
      findMany: async ({ where }: { where: Linha }) => db.cofreEvento.filter((e) => e.usuarioId === where.usuarioId).reverse(),
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  // sessão: o código procura por tokenHash e atualiza por id
  const sess = prisma.cofreSessao as any;
  sess.update = async ({ where, data }: { where: Linha; data: Linha }) => {
    const l = [...db.cofreSessao.values()].find((x) => x.id === where.id)!;
    Object.assign(l, data);
    return { ...l };
  };
  return {
    prisma,
    resolveUsuario: async (email: string) => {
      if (!db.usuario.has(email)) db.usuario.set(email, { id: 'u1', email });
      return db.usuario.get(email)!;
    },
  };
});

import { registerStateRoutes } from './routes.js';
import { base32Decode, hotp, passoDe, totp } from './cofre2fa.js';

process.env.DEV_USER_EMAIL = 'dono@exemplo.com';
process.env.STORAGE_TOKEN_KEY = Buffer.alloc(32, 7).toString('base64');

const BLOB = { versao: 1, salt: 'c2FsdA==', iv: 'aXY=', ciphertext: 'Y2lmcmFkbw==' };

async function app() {
  const a = Fastify();
  await a.register(registerStateRoutes);
  return a;
}

describe('rotas do Cofre com segundo fator', () => {
  beforeEach(() => {
    db.cofre2fa.clear(); db.cofreBlob.clear(); db.cofreSessao.clear(); db.cofreEvento.length = 0;
  });

  it('fluxo completo: ativar, abrir com código, ler, gravar, conflito, desativar', async () => {
    const a = await app();

    // sem 2FA o servidor não entrega nem aceita o Cofre
    expect((await a.inject({ method: 'GET', url: '/api/cofre' })).statusCode).toBe(403);
    expect((await a.inject({ method: 'PUT', url: '/api/cofre', payload: BLOB })).statusCode).toBe(403);
    // e a importação do navegador não serve de atalho
    const imp = await a.inject({ method: 'POST', url: '/api/import', payload: { cofre: BLOB } });
    expect(imp.json().cofreIgnorado).toBe(true);
    expect(db.cofreBlob.size).toBe(0);

    // ativação
    const ini = (await a.inject({ method: 'POST', url: '/api/cofre/2fa/iniciar', payload: {} })).json();
    expect(ini.otpauth).toContain('otpauth://totp/');
    expect(db.cofre2fa.get('u1')!.segredo).not.toContain(ini.segredo); // guardado cifrado
    const segredo = base32Decode(ini.segredo);

    expect((await a.inject({ method: 'POST', url: '/api/cofre/2fa/ativar', payload: { codigo: '000000', cofre: BLOB } })).statusCode).toBe(401);
    const atv = await a.inject({ method: 'POST', url: '/api/cofre/2fa/ativar', payload: { codigo: totp(segredo, Date.now()), cofre: BLOB } });
    expect(atv.statusCode).toBe(200);
    const { codigosRecuperacao, sessao } = atv.json();
    expect(codigosRecuperacao).toHaveLength(10);
    expect(db.cofreBlob.get('u1')!.ciphertext).toBe(BLOB.ciphertext); // blob gravado na mesma operação
    expect(db.cofre2fa.get('u1')!.codigosRecuperacao.join()).not.toContain(codigosRecuperacao[0].replace('-', '')); // só hash

    // com a sessão da ativação, lê e grava
    const h = { 'x-cofre-sessao': sessao.token };
    const lido = await a.inject({ method: 'GET', url: '/api/cofre', headers: h });
    expect(lido.statusCode).toBe(200);
    const base = lido.json().atualizadoEm as string;
    const g1 = await a.inject({ method: 'PUT', url: '/api/cofre', headers: h, payload: { ...BLOB, ciphertext: 'bm92bw==', baseAtualizadoEm: base } });
    expect(g1.statusCode).toBe(200);
    // outra aba ainda com a versão velha: conflito
    const g2 = await a.inject({ method: 'PUT', url: '/api/cofre', headers: h, payload: { ...BLOB, baseAtualizadoEm: base } });
    expect(g2.statusCode).toBe(409);
    expect(g2.json().codigo).toBe('CONFLITO');

    // sessão inválida ou ausente: pede código
    expect((await a.inject({ method: 'GET', url: '/api/cofre', headers: { 'x-cofre-sessao': 'falso' } })).json().codigo).toBe('2FA_NECESSARIO');

    // abrir em "outro aparelho": o mesmo código da ativação não vale de novo (anti-replay)
    const passoAtivacao = db.cofre2fa.get('u1')!.ultimoPasso as number;
    const reuso = await a.inject({ method: 'POST', url: '/api/cofre/2fa/verificar', payload: { codigo: hotp(segredo, passoAtivacao) } });
    expect(reuso.statusCode).toBe(401);
    const proximo = hotp(segredo, Math.max(passoAtivacao, passoDe(Date.now())) + 1);
    const ver = await a.inject({ method: 'POST', url: '/api/cofre/2fa/verificar', payload: { codigo: proximo } });
    expect(ver.statusCode).toBe(200);
    const h2 = { 'x-cofre-sessao': ver.json().sessao.token };
    expect((await a.inject({ method: 'GET', url: '/api/cofre', headers: h2 })).statusCode).toBe(200);

    // código de recuperação: vale uma vez
    const rec1 = await a.inject({ method: 'POST', url: '/api/cofre/2fa/verificar', payload: { recuperacao: codigosRecuperacao[0] } });
    expect(rec1.statusCode).toBe(200);
    expect(rec1.json().codigosRestantes).toBe(9);
    expect((await a.inject({ method: 'POST', url: '/api/cofre/2fa/verificar', payload: { recuperacao: codigosRecuperacao[0] } })).statusCode).toBe(401);

    // desativar exige sessão + código; apaga segredo, sessões e o blob do servidor
    expect((await a.inject({ method: 'POST', url: '/api/cofre/2fa/desativar', payload: { recuperacao: codigosRecuperacao[1] } })).statusCode).toBe(401);
    const des = await a.inject({ method: 'POST', url: '/api/cofre/2fa/desativar', headers: h2, payload: { recuperacao: codigosRecuperacao[1] } });
    expect(des.statusCode).toBe(200);
    expect(db.cofre2fa.size).toBe(0);
    expect(db.cofreBlob.size).toBe(0);
    expect(db.cofreSessao.size).toBe(0);

    // trilha de auditoria
    const tipos = db.cofreEvento.map((e) => e.tipo);
    expect(tipos).toEqual(expect.arrayContaining(['2fa_ativado', '2fa_ok', '2fa_falha', 'cofre_lido', 'cofre_salvo', 'recuperacao_usada', '2fa_desativado']));
    expect(db.cofreEvento.every((e) => !JSON.stringify(e).includes(BLOB.ciphertext))).toBe(true);
    await a.close();
  });

  it('bloqueia depois de 5 códigos errados, mesmo que o 6º esteja certo', async () => {
    const a = await app();
    const ini = (await a.inject({ method: 'POST', url: '/api/cofre/2fa/iniciar', payload: {} })).json();
    const segredo = base32Decode(ini.segredo);
    await a.inject({ method: 'POST', url: '/api/cofre/2fa/ativar', payload: { codigo: totp(segredo, Date.now()), cofre: BLOB } });

    for (let i = 0; i < 5; i++) {
      const r = await a.inject({ method: 'POST', url: '/api/cofre/2fa/verificar', payload: { codigo: '000000' } });
      expect(r.statusCode).toBe(401);
    }
    const certo = hotp(segredo, passoDe(Date.now()) + 1);
    const r = await a.inject({ method: 'POST', url: '/api/cofre/2fa/verificar', payload: { codigo: certo } });
    expect(r.statusCode).toBe(429);
    const st = (await a.inject({ method: 'GET', url: '/api/cofre/2fa' })).json();
    expect(st.ativo).toBe(true);
    expect(st.bloqueadoAte).not.toBeNull();
    await a.close();
  });

  it('não reativa por cima de um 2FA ativo (precisa desativar com código antes)', async () => {
    const a = await app();
    const ini = (await a.inject({ method: 'POST', url: '/api/cofre/2fa/iniciar', payload: {} })).json();
    await a.inject({ method: 'POST', url: '/api/cofre/2fa/ativar', payload: { codigo: totp(base32Decode(ini.segredo), Date.now()), cofre: BLOB } });
    expect((await a.inject({ method: 'POST', url: '/api/cofre/2fa/iniciar', payload: {} })).statusCode).toBe(409);
    await a.close();
  });
});
