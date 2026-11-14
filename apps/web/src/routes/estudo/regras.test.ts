import { describe, expect, it } from 'vitest';
import type { Meta, SessaoEstudo, StatusEstudo } from '@seginfo/shared';
import {
  contarMetas, diasEntre, estadoMeta, estadoTrilha, formatarData, formatarMinutos, horasPorSemana, listarMetas,
  proximaAcaoTopico, proximoTopico, resumoSessoes, revisaoPendente, ritmoNecessario, sessoesDaSemana, textoRevisao,
} from './regras';

const HOJE = '2026-11-13'; // sexta-feira
const meta = (p: Partial<Meta>): Meta => ({ id: p.titulo ?? 'm', titulo: 'm', prazo: HOJE, concluida: false, ...p });
const sessao = (data: string, minutos = 60, p: Partial<SessaoEstudo> = {}): SessaoEstudo => ({ id: `${data}-${minutos}`, data, minutos, nota: '', ...p });

describe('datas e formatos', () => {
  it('conta dias entre datas, negativo no passado', () => {
    expect(diasEntre(HOJE, '2026-11-20')).toBe(7);
    expect(diasEntre(HOJE, '2026-11-10')).toBe(-3);
    expect(diasEntre('2026-02-28', '2026-03-01')).toBe(1);
  });
  it('formata data e duração', () => {
    expect(formatarData('2026-01-05')).toBe('05/01/2026');
    expect(formatarMinutos(45)).toBe('45 min');
    expect(formatarMinutos(60)).toBe('1 h');
    expect(formatarMinutos(95)).toBe('1 h 35 min');
  });
});

describe('metas', () => {
  it('classifica pelo prazo', () => {
    expect(estadoMeta(meta({ prazo: '2026-11-10' }), HOJE)).toMatchObject({ chave: 'atrasada', tone: 'danger', texto: '3 dias de atraso' });
    expect(estadoMeta(meta({ prazo: HOJE }), HOJE)).toMatchObject({ chave: 'vence_logo', texto: 'vence hoje' });
    expect(estadoMeta(meta({ prazo: '2026-11-20' }), HOJE).chave).toBe('vence_logo');
    expect(estadoMeta(meta({ prazo: '2026-11-21' }), HOJE).chave).toBe('no_prazo');
    expect(estadoMeta(meta({ prazo: '2026-11-01', concluida: true }), HOJE).chave).toBe('concluida');
  });
  it('conta, filtra e ordena (abertas por prazo, concluídas no fim)', () => {
    const ms = [meta({ titulo: 'c', prazo: '2026-12-30' }), meta({ titulo: 'ok', prazo: '2026-01-01', concluida: true }), meta({ titulo: 'a', prazo: '2026-11-01' }), meta({ titulo: 'b', prazo: '2026-11-15' })];
    expect(contarMetas(ms, HOJE)).toEqual({ abertas: 3, atrasadas: 1, vence_logo: 1, concluidas: 1 });
    expect(listarMetas(ms, HOJE).map((m) => m.titulo)).toEqual(['a', 'b', 'c', 'ok']);
    expect(listarMetas(ms, HOJE, 'atrasadas').map((m) => m.titulo)).toEqual(['a']);
    expect(listarMetas(ms, HOJE, 'concluidas').map((m) => m.titulo)).toEqual(['ok']);
  });
  it('calcula o ritmo semanal para fechar a trilha', () => {
    expect(ritmoNecessario(6, 21)).toBe(2);
    expect(ritmoNecessario(5, 3)).toBe(5);
    expect(ritmoNecessario(0, 10)).toBe(0);
    expect(ritmoNecessario(4, -1)).toBeUndefined();
  });
});

describe('tópicos e trilhas', () => {
  const t = (id: string, status: StatusEstudo) => ({ id, status });
  it('prioriza revisão vencida, depois o que está em andamento, depois o próximo a estudar', () => {
    const lista = [t('a', 'concluido'), t('b', 'a_estudar'), t('c', 'estudando'), t('d', 'concluido')];
    expect(proximoTopico(lista, { d: { revisarEm: HOJE } }, HOJE)).toMatchObject({ topico: { id: 'd' }, motivo: 'revisao' });
    expect(proximoTopico(lista, { d: { revisarEm: '2026-12-01' } }, HOJE)).toMatchObject({ topico: { id: 'c' }, motivo: 'continuar' });
    expect(proximoTopico([t('a', 'concluido'), t('b', 'a_estudar')], {}, HOJE)).toMatchObject({ topico: { id: 'b' }, motivo: 'comecar' });
    expect(proximoTopico([t('a', 'concluido')], {}, HOJE)).toBeUndefined();
  });
  it('descreve a revisão espaçada', () => {
    expect(revisaoPendente({ revisarEm: '2026-11-12' }, HOJE)).toBe(true);
    expect(textoRevisao(undefined, HOJE)).toBe('Nenhuma revisão agendada');
    expect(textoRevisao({ revisarEm: HOJE }, HOJE)).toBe('Revisar hoje');
    expect(textoRevisao({ revisarEm: '2026-11-16' }, HOJE)).toBe('Próxima revisão em 16/11/2026 (3 dias)');
  });
  it('sugere a ação seguinte do tópico', () => {
    expect(proximaAcaoTopico('a_estudar').status).toBe('estudando');
    expect(proximaAcaoTopico('estudando').status).toBe('concluido');
  });
  it('classifica a trilha pelo progresso', () => {
    expect(estadoTrilha({ total: 4, concluidos: 0, estudando: 0 })).toBe('nao_iniciada');
    expect(estadoTrilha({ total: 4, concluidos: 1, estudando: 0 })).toBe('andamento');
    expect(estadoTrilha({ total: 4, concluidos: 0, estudando: 2 })).toBe('andamento');
    expect(estadoTrilha({ total: 4, concluidos: 4, estudando: 0 })).toBe('concluida');
    expect(estadoTrilha({ total: 0, concluidos: 0, estudando: 0 })).toBe('nao_iniciada');
  });
});

describe('sessões', () => {
  const lista = [sessao('2026-11-13', 30), sessao('2026-11-07', 90), sessao('2026-11-06', 60), sessao('2026-11-14', 20), sessao('2026-11-13', 15)];
  it('resume total, dias distintos e a última data', () => {
    expect(resumoSessoes(lista)).toEqual({ minutos: 215, quantidade: 5, dias: 4, ultima: '2026-11-14' });
    expect(resumoSessoes([])).toMatchObject({ minutos: 0, quantidade: 0, ultima: undefined });
  });
  it('pega só os últimos 7 dias, sem datas futuras', () => {
    expect(sessoesDaSemana(lista, HOJE).map((s) => s.data)).toEqual(['2026-11-13', '2026-11-07', '2026-11-13']);
  });
  it('agrupa horas por semana começando no domingo', () => {
    const semanas = horasPorSemana(lista, HOJE, 2);
    expect(semanas.map((s) => s.inicio)).toEqual(['2026-11-01', '2026-11-08']);
    expect(semanas.map((s) => s.horas)).toEqual([2.5, 1.1]);
  });
});
