import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TopicoSchema, LabSchema } from '@seginfo/shared';
import { TECNICAS, TATICAS } from '@/data/attack';
import { TOPICOS } from '@/data/topicos';
import { TRILHAS } from '@/data/trilhas';
import { LABS } from '@/data/labs';
import { calcularCobertura, camadaNavigator, marcarDeteccao, resumoCobertura } from './attack';
import { setStatus } from './catalog';
import { saveProgressoLab } from './inventario';

describe('catálogo ATT&CK', () => {
  const ids = new Set(TECNICAS.map((t) => t.id));

  it('toda técnica pertence a uma tática conhecida e não se repete', () => {
    const taticas = new Set(TATICAS.map((t) => t.id));
    expect(TECNICAS.every((t) => taticas.has(t.tatica))).toBe(true);
    expect(ids.size).toBe(TECNICAS.length);
  });

  it('tópicos e labs só citam técnicas do catálogo', () => {
    const citadas = [...TOPICOS.flatMap((t) => t.mitre ?? []), ...LABS.flatMap((l) => l.mitre ?? [])];
    expect(citadas.filter((id) => !ids.has(id))).toEqual([]);
  });

  it('conteúdo novo é válido e referencia trilhas e tópicos existentes', () => {
    const trilhas = new Set(TRILHAS.map((t) => t.id));
    const topicos = new Set(TOPICOS.map((t) => t.id));
    expect(TOPICOS.filter((t) => !TopicoSchema.safeParse(t).success).map((t) => t.id)).toEqual([]);
    expect(LABS.filter((l) => !LabSchema.safeParse(l).success).map((l) => l.id)).toEqual([]);
    expect(TOPICOS.filter((t) => !trilhas.has(t.trilhaId)).map((t) => t.id)).toEqual([]);
    expect(LABS.filter((l) => l.topicoId && !topicos.has(l.topicoId)).map((l) => l.id)).toEqual([]);
    expect(new Set(TOPICOS.map((t) => t.id)).size).toBe(TOPICOS.length);
    expect(new Set(LABS.map((l) => l.id)).size).toBe(LABS.length);
  });
});

describe('cobertura', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      get length() { return values.size; },
      key: (i: number) => [...values.keys()][i] ?? null,
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => { values.set(k, String(v)); },
      removeItem: (k: string) => { values.delete(k); },
      clear: () => values.clear(),
    });
  });

  it('acumula camadas e aponta lacunas', () => {
    setStatus('red-nmap', 'concluido'); // T1046, T1595
    saveProgressoLab('lab-soc-wazuh', { status: 'concluido', aprendizado: '', evidencia: '', mitre: [] }); // T1110, T1078
    marcarDeteccao('T1078', 'regra de teste');

    const c = calcularCobertura({ T1110: 12 });
    const get = (id: string) => c.find((t) => t.id === id)!;
    expect(get('T1046').estudada).toBe(true);
    expect(get('T1110')).toMatchObject({ praticada: true, observada: 12, detectada: null });
    expect(get('T1078').detectada?.regra).toBe('regra de teste');

    const r = resumoCobertura(c);
    expect(r.lacunas.map((t) => t.id)).toContain('T1110');
    // T1078 foi validada (marcarDeteccao) mas não tem resposta documentada: pelo ciclo de
    // 4 etapas (docs/INTELIGENCIA.md), "detectada sem respondida" ainda é lacuna por desenho.
    expect(r.lacunas.map((t) => t.id)).toContain('T1078');

    const camada = camadaNavigator(c);
    // pontuacao() soma só as 4 etapas do ciclo operacional (observada/alerta/detectada/
    // respondida, docs/INTELIGENCIA.md); "praticada" é indicador de estudo, não evidência,
    // e não entra na pontuação. T1110 aqui só tem observada > 0: score 1, não 2.
    expect(camada.techniques.find((t) => t.techniqueID === 'T1110')?.score).toBe(1);
  });
});
