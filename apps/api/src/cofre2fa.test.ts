import { describe, expect, it } from 'vitest';
import {
  base32Decode, base32Encode, bloqueioMs, consumirRecuperacao, gerarCodigosRecuperacao, gerarSegredo,
  hashCodigo, hotp, otpauthUri, passoDe, totp, verificarTotp, BLOQUEIO_MAX_MS,
} from './cofre2fa.js';

// Segredo dos vetores de teste das RFCs 4226/6238 (SHA-1).
const RFC = Buffer.from('12345678901234567890', 'ascii');

describe('base32', () => {
  it('segue os vetores da RFC 4648', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Encode(Buffer.from('f'))).toBe('MY');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
  });
  it('ida e volta com segredo aleatório, ignorando espaços e minúsculas', () => {
    const s = gerarSegredo();
    const b32 = base32Encode(s);
    expect(b32).toHaveLength(32);
    expect(base32Decode(b32.toLowerCase().replace(/(.{4})/g, '$1 '))).toEqual(s);
  });
  it('recusa caractere fora do alfabeto', () => {
    expect(() => base32Decode('ABC1')).toThrow();
  });
});

describe('HOTP/TOTP', () => {
  it('HOTP bate com a RFC 4226 (apêndice D)', () => {
    expect(hotp(RFC, 0)).toBe('755224');
    expect(hotp(RFC, 1)).toBe('287082');
    expect(hotp(RFC, 9)).toBe('520489');
  });
  it('TOTP bate com a RFC 6238 (apêndice B, SHA-1, 8 dígitos)', () => {
    expect(totp(RFC, 59_000, 8)).toBe('94287082');
    expect(totp(RFC, 1_111_111_109_000, 8)).toBe('07081804');
    expect(totp(RFC, 1_234_567_890_000, 8)).toBe('89005924');
    expect(totp(RFC, 20_000_000_000_000, 8)).toBe('65353130');
  });
});

describe('verificarTotp', () => {
  const agora = 1_794_600_000_000;
  const passo = passoDe(agora);

  it('aceita o código atual e devolve o passo', () => {
    expect(verificarTotp(RFC, totp(RFC, agora), agora, 0)).toBe(passo);
  });
  it('tolera o relógio 30 s adiantado ou atrasado, mas não 60 s', () => {
    expect(verificarTotp(RFC, hotp(RFC, passo - 1), agora, 0)).toBe(passo - 1);
    expect(verificarTotp(RFC, hotp(RFC, passo + 1), agora, 0)).toBe(passo + 1);
    expect(verificarTotp(RFC, hotp(RFC, passo - 2), agora, 0)).toBeNull();
  });
  it('não aceita o mesmo código duas vezes (anti-replay)', () => {
    const codigo = totp(RFC, agora);
    const usado = verificarTotp(RFC, codigo, agora, 0)!;
    expect(verificarTotp(RFC, codigo, agora, usado)).toBeNull();
  });
  it('recusa código errado, curto ou com letras', () => {
    const certo = totp(RFC, agora);
    const errado = String((Number(certo) + 1) % 1_000_000).padStart(6, '0');
    expect(verificarTotp(RFC, errado, agora, 0)).toBeNull();
    expect(verificarTotp(RFC, '12345', agora, 0)).toBeNull();
    expect(verificarTotp(RFC, 'abcdef', agora, 0)).toBeNull();
  });
  it('aceita o código com espaço no meio, como os apps mostram', () => {
    const c = totp(RFC, agora);
    expect(verificarTotp(RFC, `${c.slice(0, 3)} ${c.slice(3)}`, agora, 0)).toBe(passo);
  });
});

describe('códigos de recuperação', () => {
  it('gera 10 códigos distintos no formato XXXXX-XXXXX', () => {
    const c = gerarCodigosRecuperacao();
    expect(c).toHaveLength(10);
    expect(new Set(c).size).toBe(10);
    c.forEach((x) => expect(x).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/));
  });
  it('cada código serve uma vez só, sem diferenciar maiúsculas nem o hífen', () => {
    const c = gerarCodigosRecuperacao(3);
    const hashes = c.map(hashCodigo);
    const resto = consumirRecuperacao(hashes, c[1].toLowerCase().replace('-', ' '));
    expect(resto).toHaveLength(2);
    expect(consumirRecuperacao(resto!, c[1])).toBeNull();
    expect(consumirRecuperacao(hashes, 'AAAAA-AAAAA')).toBeNull();
    expect(consumirRecuperacao(hashes, '123456')).toBeNull();
  });
  it('guarda só o hash, nunca o código', () => {
    const [c] = gerarCodigosRecuperacao(1);
    expect(hashCodigo(c)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCodigo(c)).not.toContain(c.replace('-', ''));
  });
});

describe('bloqueio por tentativas', () => {
  it('libera até 4 erros, bloqueia 5 min no 5º e dobra até 1 h', () => {
    expect(bloqueioMs(4)).toBe(0);
    expect(bloqueioMs(5)).toBe(5 * 60_000);
    expect(bloqueioMs(6)).toBe(10 * 60_000);
    expect(bloqueioMs(20)).toBe(BLOQUEIO_MAX_MS);
  });
});

describe('otpauthUri', () => {
  it('monta o link que o Google Authenticator lê no QR code', () => {
    const u = otpauthUri('JBSWY3DPEHPK3PXP', 'eu@exemplo.com');
    expect(u.startsWith('otpauth://totp/SegInfo%20Cofre%3Aeu%40exemplo.com?')).toBe(true);
    const q = new URL(u).searchParams;
    expect(q.get('secret')).toBe('JBSWY3DPEHPK3PXP');
    expect(q.get('issuer')).toBe('SegInfo Cofre');
    expect(q.get('digits')).toBe('6');
    expect(q.get('period')).toBe('30');
  });
});
