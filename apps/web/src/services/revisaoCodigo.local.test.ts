import { describe, expect, it } from 'vitest';
import { montarImportacao } from './revisaoCodigo';

describe('montarImportacao', () => {
  it('separa sarif, relatório e patches', () => {
    const p = montarImportacao([
      { nome: 'CLAUDE-SECURITY-RESULTS.sarif', texto: '{"runs":[]}' },
      { nome: 'outro.md', texto: 'x' },
      { nome: 'CLAUDE-SECURITY-RESULTS.md', texto: '# relatório' },
      { nome: 'F1.patch', texto: 'diff' },
      { nome: 'foto.png', texto: '' },
    ]);
    expect(p.sarif).toEqual({ runs: [] });
    expect(p.relatorioMd).toBe('# relatório');
    expect(p.patches).toEqual([{ nome: 'F1.patch', conteudo: 'diff' }]);
    expect(p.avisos).toEqual(['foto.png: ignorado (use .sarif, .md ou .patch).']);
  });

  it('avisa quando falta o SARIF ou ele é inválido', () => {
    expect(montarImportacao([]).avisos[0]).toMatch(/Falta/);
    const p = montarImportacao([{ nome: 'a.sarif', texto: '{' }]);
    expect(p.avisos.some((a) => a.includes('não é JSON'))).toBe(true);
  });
});
