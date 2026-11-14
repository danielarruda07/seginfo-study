import { describe, expect, it } from 'vitest';
import { ESTADO_LAB_META, proximoEstado } from './estado';

describe('estado do lab', () => {
  it('ação principal leva ao próximo estado e some no concluído', () => {
    expect(proximoEstado('nao_iniciado')?.para).toBe('em_andamento');
    expect(proximoEstado('em_andamento')?.para).toBe('concluido');
    expect(proximoEstado('concluido')).toBeNull();
  });
  it('não iniciado fica neutro (cor só onde há ação)', () => {
    expect(ESTADO_LAB_META.nao_iniciado.tone).toBeUndefined();
  });
});
