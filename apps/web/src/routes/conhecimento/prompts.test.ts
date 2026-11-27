import { describe, expect, it } from 'vitest';
import { CATEGORIAS, PROMPTS, REGRAS, filtrarPrompts, textoParaCopiar } from './prompts';

describe('prompts de pentest', () => {
  it('ids únicos e toda categoria tem prompt', () => {
    const ids = PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CATEGORIAS) expect(PROMPTS.some((p) => p.categoria === c.id), c.id).toBe(true);
  });

  it('prompts do plugin começam pela skill que declaram', () => {
    for (const p of PROMPTS.filter((x) => x.categoria === 'plugin')) {
      expect(p.skill, p.id).toMatch(/^\/claude-security:/);
      expect(p.texto.startsWith(p.skill!), p.id).toBe(true);
    }
  });

  it('prompts de aplicação levam as regras de só-leitura e gravam só em CLAUDE-SECURITY-ANALISES', () => {
    for (const p of PROMPTS.filter((x) => x.categoria === 'aplicacao')) {
      expect(p.comRegras, p.id).toBe(true);
      expect(textoParaCopiar(p).endsWith(REGRAS)).toBe(true);
      expect(p.texto).toContain('CLAUDE-SECURITY-ANALISES/');
    }
    expect(REGRAS).toMatch(/push/);
    expect(REGRAS).toMatch(/valor presente/);
  });

  it('filtra por texto sem acento e por categoria', () => {
    expect(filtrarPrompts('autorizacao', null).map((p) => p.id)).toContain('autorizacao');
    expect(filtrarPrompts('', 'endpoint').every((p) => p.categoria === 'endpoint')).toBe(true);
    expect(filtrarPrompts('zzzz', null)).toEqual([]);
  });
});
