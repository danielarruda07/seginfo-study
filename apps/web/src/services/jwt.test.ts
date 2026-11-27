import { describe, expect, it } from 'vitest';
import { analisarTokenJwt } from './jwt';

/** Monta um JWT de teste (header.payload.assinatura-fake) em base64url. */
function montar(header: object, payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64(header)}.${b64(payload)}.ASSINATURAfake`;
}

describe('analisarTokenJwt', () => {
  it('rejeita o que não é JWT', () => {
    expect(analisarTokenJwt('abc').valido).toBe(false);
    expect(analisarTokenJwt('a.b').valido).toBe(false);
  });

  it('aponta alg none', () => {
    const r = analisarTokenJwt(montar({ alg: 'none', typ: 'JWT' }, { sub: '1', exp: 9999999999 }));
    expect(r.valido).toBe(true);
    expect(r.achados.some((a) => a.titulo.includes('none') && a.severidade === 'alta')).toBe(true);
  });

  it('aponta HS simétrico e falta de exp', () => {
    const r = analisarTokenJwt(montar({ alg: 'HS256' }, { sub: '1' }));
    expect(r.achados.some((a) => a.titulo.includes('simétrico'))).toBe(true);
    expect(r.achados.some((a) => a.titulo.includes('Sem expiração'))).toBe(true);
  });

  it('aponta validade longa e claim sensível', () => {
    const r = analisarTokenJwt(montar({ alg: 'RS256' }, { iat: 1000, exp: 1000 + 30 * 86400, password: 'x' }));
    expect(r.achados.some((a) => a.titulo.includes('Validade muito longa'))).toBe(true);
    expect(r.achados.some((a) => a.titulo.includes('Claim sensível'))).toBe(true);
  });

  it('token sadio: só informa que a assinatura não foi verificada', () => {
    const r = analisarTokenJwt(montar({ alg: 'RS256' }, { sub: '1', iat: 1000, exp: 1000 + 600 }), 1200);
    expect(r.valido).toBe(true);
    expect(r.achados.every((a) => a.severidade === 'info' || a.severidade === 'baixa')).toBe(true);
  });

  it('aceita prefixo Bearer', () => {
    expect(analisarTokenJwt('Bearer ' + montar({ alg: 'none' }, { sub: '1' })).valido).toBe(true);
  });
});
