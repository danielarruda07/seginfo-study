import { describe, expect, it } from 'vitest';
import { DOC_BLOCOS, DOC_TESTES } from './documentacao';

describe('documentação do ambiente', () => {
  it('ids de âncora são únicos entre blocos e testes', () => {
    const ids = [...DOC_BLOCOS.map((b) => b.id), ...DOC_TESTES.map((t) => t.id), 'testes'];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo teste tem técnica MITRE e as quatro etapas preenchidas', () => {
    for (const t of DOC_TESTES) {
      expect(t.codigo).toMatch(/^T\d{4}(\.\d{3})?$/);
      expect(t.comoAbre && t.comoAtaca && t.deteccao && t.resultado).toBeTruthy();
    }
  });
});
