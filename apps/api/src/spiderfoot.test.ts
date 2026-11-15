import { describe, expect, it, vi } from 'vitest';
import { lerDesafioDigest, respostaDigest } from './spiderfoot.js';

vi.mock('./memorias.js', () => ({ buscarNaBase: async () => [] }));
const { REGISTRO } = await import('./agenteFerramentas.js');
const porNome = (nome: string) => REGISTRO.find((f) => f.nome === nome)!;

describe('SpiderFoot', () => {
  it('autenticação Digest bate com o exemplo da RFC 2617', () => {
    const d = lerDesafioDigest('Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"');
    expect(d).toMatchObject({ realm: 'testrealm@host.com', qop: 'auth,auth-int', opaque: '5ccc069c403ebaf9f0171e9517f40e41' });
    const h = respostaDigest(d, 'GET', '/dir/index.html', 'Mufasa', 'Circle Of Life', '0a4f113b');
    expect(h).toContain('response="6629fae49393a05397450978507c4ef1"');
    expect(h).toContain('qop=auth');
    expect(h).toContain('opaque="5ccc069c403ebaf9f0171e9517f40e41"');
  });

  it('varredura passiva é leve; pegada e investigar pedem aprovação', () => {
    const f = porNome('spiderfoot_iniciar_varredura');
    expect(f.nivel).toBe('depende');
    expect(f.ehLeve({ alvo: 'exemplo.com' })).toBe(true);
    expect(f.ehLeve({ alvo: 'exemplo.com', perfil: 'investigar' })).toBe(false);
    expect(f.resumir({ alvo: 'Exemplo.COM', perfil: 'pegada' })).toContain('ACESSA o alvo');
    expect(porNome('spiderfoot_parar_varredura').nivel).toBe('leve');
  });

  it('recusa alvo interno, URL e ID fora do formato', () => {
    const f = porNome('spiderfoot_iniciar_varredura');
    expect(() => f.resumir({ alvo: '10.10.10.5' })).toThrow(/privado/);
    expect(() => f.resumir({ alvo: 'http://exemplo.com/x' })).toThrow(/domínio/);
    expect(f.resumir({ alvo: '8.8.8.8' })).toContain('8.8.8.8');
    expect(() => porNome('spiderfoot_resultado').resumir({ id: '../scandelete' })).toThrow(/ID/);
    expect(() => porNome('spiderfoot_resultado').resumir({ id: 'ABCDEF12', tipoEvento: 'x;y' })).toThrow();
  });

  it('sem variáveis, as ferramentas avisam o que falta', () => {
    expect(porNome('spiderfoot_resultado').faltando?.()).toEqual(expect.arrayContaining(['SPIDERFOOT_URL']));
  });
});
