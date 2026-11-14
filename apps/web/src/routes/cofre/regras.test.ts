import { describe, expect, it } from 'vitest';
import type { VaultEntry } from '@seginfo/shared';
import { MASCARA, estadoTeste, filtrarCredenciais, hrefSeguro, senhaMestraScore } from './regras';

const e = (titulo: string, extra: Partial<VaultEntry> = {}): VaultEntry => ({
  id: titulo, titulo, usuario: '', url: '', notas: '', atualizadoEm: '2026-11-01T00:00:00Z', ...extra,
});

describe('senhaMestraScore', () => {
  it('pontua comprimento e variedade', () => {
    expect(senhaMestraScore('')).toBe(0);
    expect(senhaMestraScore('abc')).toBe(1);
    expect(senhaMestraScore('Frase longa 2026 com acento!')).toBe(6);
  });
});

describe('filtrarCredenciais', () => {
  const lista = [e('Firewall', { usuario: 'admin', url: 'https://fw.example' }), e('Éxito', { notas: 'portal' }), e('Banco')];
  it('ordena por título e busca sem acento em título, usuário, url e notas', () => {
    expect(filtrarCredenciais(lista, '').map((x) => x.titulo)).toEqual(['Banco', 'Éxito', 'Firewall']);
    expect(filtrarCredenciais(lista, 'exito').map((x) => x.titulo)).toEqual(['Éxito']);
    expect(filtrarCredenciais(lista, 'ADMIN').map((x) => x.titulo)).toEqual(['Firewall']);
    expect(filtrarCredenciais(lista, 'fw.example').map((x) => x.titulo)).toEqual(['Firewall']);
    expect(filtrarCredenciais(lista, 'portal').map((x) => x.titulo)).toEqual(['Éxito']);
  });
  it('não altera a lista original', () => {
    filtrarCredenciais(lista, '');
    expect(lista[0]!.titulo).toBe('Firewall');
  });
});

describe('estadoTeste', () => {
  const hoje = new Date(2026, 10, 13);
  it('nunca testada, recente e velha', () => {
    expect(estadoTeste(undefined, hoje).tone).toBe('muted');
    expect(estadoTeste('2026-11-10', hoje)).toMatchObject({ tone: 'ok', rotulo: 'Testada' });
    expect(estadoTeste('2026-01-10', hoje)).toMatchObject({ tone: 'warning', rotulo: 'Testar de novo' });
  });
});

describe('hrefSeguro', () => {
  it('aceita http(s) e host sem esquema', () => {
    expect(hrefSeguro('https://fw.example/login')).toBe('https://fw.example/login');
    expect(hrefSeguro('192.0.2.10')).toBe('https://192.0.2.10/');
  });
  it('recusa esquemas perigosos e vazio', () => {
    expect(hrefSeguro('javascript:alert(1)')).toBeNull();
    expect(hrefSeguro('data:text/html,x')).toBeNull();
    expect(hrefSeguro('')).toBeNull();
  });
});

it('a máscara tem tamanho fixo e não contém caracteres do segredo', () => {
  expect(MASCARA).toMatch(/^•+$/);
});
