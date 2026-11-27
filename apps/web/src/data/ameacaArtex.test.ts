import { describe, expect, it } from 'vitest';
import { ARTEX_SINAIS, ARTEX_MARCADORES, getSinalArtex } from './ameacaArtex';
import { getTecnica } from './attack';

describe('dataset ARTEX (detecção e caça)', () => {
  it('tem sinais e marcadores', () => {
    expect(ARTEX_SINAIS.length).toBeGreaterThan(5);
    expect(ARTEX_MARCADORES.length).toBeGreaterThan(0);
  });

  it('ids de sinal são únicos', () => {
    const ids = ARTEX_SINAIS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda técnica MITRE referenciada resolve em attack.ts', () => {
    for (const s of ARTEX_SINAIS) {
      for (const id of s.mitreIds) {
        expect(getTecnica(id), `${s.id} → ${id}`).toBeDefined();
      }
    }
  });

  it('todo sinal tem dica de caça', () => {
    for (const s of ARTEX_SINAIS) expect(s.comoCacar.length).toBeGreaterThan(10);
  });

  it('getSinalArtex acha por id', () => {
    expect(getSinalArtex('loop-agentico')?.camada).toBe('comportamento');
    expect(getSinalArtex('inexistente')).toBeUndefined();
  });
});
