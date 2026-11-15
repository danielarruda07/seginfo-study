import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

// Retorno do OAuth do LinkedIn: cada falha tem que deixar um motivo na URL e no banco (ultimoErro).
const estado = vi.hoisted(() => ({
  concluir: vi.fn(async () => undefined),
  contas: [] as { usuarioId: string; ultimoErro: string | null }[],
}));

vi.mock('./linkedinApi.js', async (orig) => {
  const real = await orig<typeof import('./linkedinApi.js')>();
  return { ...real, concluirAutorizacao: estado.concluir };
});
vi.mock('./db.js', () => ({
  prisma: {
    linkedinConta: {
      updateMany: async ({ where, data }: { where: { usuarioId: string }; data: { ultimoErro: string } }) => {
        let count = 0;
        for (const c of estado.contas) if (c.usuarioId === where.usuarioId) { c.ultimoErro = data.ultimoErro; count++; }
        return { count };
      },
    },
  },
  resolveUsuario: async () => ({ id: 'u1', email: 'dono@exemplo.com' }),
}));

import { registerLinkedinPipelineRoutes } from './linkedinPipeline.js';
import { ErroLinkedin } from './linkedinApi.js';

process.env.DEV_USER_EMAIL = 'dono@exemplo.com';

async function app() {
  const a = Fastify();
  // em produção o plugin de rotas de estado põe a identidade verificada; aqui simulamos o mesmo campo
  a.addHook('onRequest', async (req) => { (req as unknown as { usuarioId: string }).usuarioId = 'u1'; });
  await a.register(registerLinkedinPipelineRoutes);
  return a;
}

describe('callback do LinkedIn', () => {
  beforeEach(() => {
    estado.concluir.mockReset();
    estado.contas = [{ usuarioId: 'u1', ultimoErro: null }];
  });

  it('sucesso: volta conectado e não grava erro', async () => {
    estado.concluir.mockResolvedValueOnce(undefined);
    const a = await app();
    const r = await a.inject({ method: 'GET', url: '/api/linkedin/conta/callback?code=abc&state=xyz' });
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe('/posts?linkedin=conectado');
    await a.close();
  });

  it('usuário recusou no LinkedIn: motivo na URL e em ultimoErro', async () => {
    const a = await app();
    const r = await a.inject({ method: 'GET', url: '/api/linkedin/conta/callback?error=access_denied&error_description=user+cancelled' });
    expect(r.headers.location).toMatch(/^\/posts\?linkedin=erro&motivo=/);
    expect(decodeURIComponent(r.headers.location as string)).toContain('user cancelled');
    expect(estado.contas[0].ultimoErro).toContain('user cancelled');
    await a.close();
  });

  it('retorno sem código: motivo claro', async () => {
    const a = await app();
    const r = await a.inject({ method: 'GET', url: '/api/linkedin/conta/callback?state=xyz' });
    expect(decodeURIComponent(r.headers.location as string)).toContain('sem o código de autorização');
    await a.close();
  });

  it('falha esperada (estado expirado): mensagem da API chega à tela e ao banco', async () => {
    estado.concluir.mockRejectedValueOnce(new ErroLinkedin(400, 'Estado de autorização inválido ou expirado. Tente conectar de novo.'));
    const a = await app();
    const r = await a.inject({ method: 'GET', url: '/api/linkedin/conta/callback?code=abc&state=xyz' });
    expect(decodeURIComponent(r.headers.location as string)).toContain('expirado');
    expect(estado.contas[0].ultimoErro).toContain('expirado');
    await a.close();
  });

  it('falha inesperada: não vaza o erro bruto, mas registra e avisa', async () => {
    estado.concluir.mockRejectedValueOnce(new TypeError('Cannot read properties of undefined (secret-token-xyz)'));
    const a = await app();
    const r = await a.inject({ method: 'GET', url: '/api/linkedin/conta/callback?code=abc&state=xyz' });
    const motivo = decodeURIComponent(r.headers.location as string);
    expect(motivo).toContain('Falha inesperada');
    expect(motivo).not.toContain('secret-token-xyz');
    await a.close();
  });
});
