import { describe, expect, it } from 'vitest';
import { nomeDoAlvo, ordenarMudancas, tipoDoTexto } from './exposicao';

describe('Minha exposição', () => {
  it('ordena por gravidade e, na mesma gravidade, do mais recente para o mais antigo', () => {
    const m = ordenarMudancas([
      { id: '1', severidade: 'info' as const, criadoEm: '2026-11-15T10:00:00Z' },
      { id: '2', severidade: 'alta' as const, criadoEm: '2026-11-14T10:00:00Z' },
      { id: '3', severidade: 'alta' as const, criadoEm: '2026-11-15T10:00:00Z' },
      { id: '4', severidade: 'media' as const, criadoEm: '2026-11-13T10:00:00Z' },
    ]);
    expect(m.map((x) => x.id)).toEqual(['3', '2', '4', '1']);
  });

  it('reconhece IP e domínio pelo texto digitado', () => {
    expect(tipoDoTexto('203.0.113.9')).toBe('ip');
    expect(tipoDoTexto('2001:db8::1')).toBe('ip');
    expect(tipoDoTexto('exemplo.com.br')).toBe('dominio');
  });

  it('nomeia o IP público e respeita o rótulo', () => {
    expect(nomeDoAlvo({ tipo: 'ip-publico', valor: '', rotulo: null })).toBe('Meu IP público');
    expect(nomeDoAlvo({ tipo: 'dominio', valor: 'exemplo.com', rotulo: 'site' })).toBe('site');
  });
});
