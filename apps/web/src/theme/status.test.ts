import { describe, expect, it } from 'vitest';
import { kpiAlert, toneClass, toneFromStatus } from './status';

describe('tons de estado', () => {
  it('KPI só destaca tom de ação com valor positivo', () => {
    expect(kpiAlert('danger', 3)).toBe(true);
    expect(kpiAlert('danger', 0)).toBe(false);
    expect(kpiAlert('ok', 5)).toBe(false);
    expect(kpiAlert(undefined, 5)).toBe(false);
    expect(kpiAlert('warning', 'abc')).toBe(false);
  });

  it('converte a régua antiga e gera a classe', () => {
    expect(toneFromStatus('crit')).toBe('danger');
    expect(toneFromStatus('warn')).toBe('serious');
    expect(toneClass('muted')).toBe('tone-muted');
    expect(toneClass()).toBe('');
  });
});
