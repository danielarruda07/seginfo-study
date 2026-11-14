import { describe, expect, it } from 'vitest';
import type { Lab, Topico, Trilha } from '@seginfo/shared';
import type { ProgressoLab } from '@/services/inventario';
import { montarPortfolio } from './regras';

const tr = (id: string, ordem: number): Trilha => ({ id, titulo: id, descricao: '', icone: 'pi-book', ordem });
const tp = (id: string, trilhaId: string): Topico => ({ id, trilhaId, titulo: id, nivel: 'basico', resumo: '', conceitosChave: [], ferramentas: [], recursos: [], tags: [] });
const lab = (id: string): Lab => ({ id, titulo: id, objetivo: '', dominio: 'blue', nivel: 'basico', ativosAlvo: [], passos: [], resultadoEsperado: '' });
const prog = (status: ProgressoLab['status'], concluidoEm?: string): ProgressoLab => ({ status, concluidoEm, aprendizado: '', evidencia: '', mitre: [] });

describe('montarPortfolio', () => {
  const p = montarPortfolio({
    trilhas: [tr('b', 2), tr('a', 1), tr('vazia', 3)],
    topicos: [tp('a1', 'a'), tp('a2', 'a'), tp('b1', 'b'), tp('b2', 'b')],
    status: { a1: 'concluido', a2: 'concluido', b1: 'concluido', b2: 'estudando' },
    labs: [lab('l1'), lab('l2'), lab('l3')],
    progressoLab: (id) => ({ l1: prog('concluido', '2026-10-01'), l2: prog('em_andamento'), l3: prog('concluido', '2026-11-01') }[id] ?? prog('nao_iniciado')),
  });

  it('só conta trilha 100% concluída e com tópicos', () => {
    expect(p.trilhas.map((t) => t.trilha.id)).toEqual(['a']);
    expect(p.trilhas[0]!.topicos).toHaveLength(2);
  });
  it('labs concluídos, mais recentes primeiro', () => {
    expect(p.labs.map((l) => l.lab.id)).toEqual(['l3', 'l1']);
  });
  it('tópicos concluídos com a trilha', () => {
    expect(p.topicos.map((t) => [t.topico.id, t.trilha?.id])).toEqual([['a1', 'a'], ['a2', 'a'], ['b1', 'b']]);
  });
  it('navegação na ordem trilhas, labs, tópicos com ids únicos', () => {
    expect(p.todos.map((i) => i.id)).toEqual(['trilha:a', 'lab:l3', 'lab:l1', 'topico:a1', 'topico:a2', 'topico:b1']);
  });
});
