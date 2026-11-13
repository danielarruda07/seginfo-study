import { describe, expect, it } from 'vitest';
import { RANGE_CHECKLIST } from '@/data/range';
import { LAB_VARS } from '@/data/rangeLab';
import { faltandoNoPrompt, montarPrompt, preencher } from './rangePrompt';

const CHAVES = new Set(LAB_VARS.map((v) => v.chave));

describe('prompts do range', () => {
  it('toda etapa tem recursos e prompt, e só usa variáveis conhecidas', () => {
    for (const item of RANGE_CHECKLIST) {
      expect(item.recursos?.length, item.id).toBeGreaterThan(0);
      expect(item.prompt?.tarefa, item.id).toBeTruthy();
      for (const m of JSON.stringify(item).matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) {
        expect(CHAVES.has(m[1]!), `${item.id}: ${m[1]}`).toBe(true);
      }
    }
  });

  it('marca o que falta e usa o padrão de planejamento', () => {
    expect(preencher('{{FGT_MODELO}} / VLAN {{RANGE_VLAN}}', {})).toBe('[PREENCHER: Modelo do FortiGate] / VLAN 80');
    expect(preencher('{{FGT_MODELO}}', { FGT_MODELO: 'X' })).toBe('X');
  });

  it('monta o prompt completo sem sobrar variável e com os pedidos extras', () => {
    const vars = Object.fromEntries(LAB_VARS.map((v) => [v.chave, 'valor']));
    for (const item of RANGE_CHECKLIST) {
      const p = montarPrompt(item, vars, { pedidos: ['Pedido A'], pedidoLivre: ' livre ' });
      expect(p).not.toMatch(/\{\{|\[PREENCHER:/);
      expect(p).toContain(item.titulo);
      expect(p).toContain('- Pedido A\n- livre');
      expect(faltandoNoPrompt(item, vars)).toEqual([]);
    }
    expect(faltandoNoPrompt(RANGE_CHECKLIST[0]!, {})).toContain('FGT_MODELO');
  });
});
