import { describe, expect, it } from 'vitest';
import type { AgenteResumo } from '@/services/agentes';
import { contarPorStatus, etapas, filtrarAgentes, ordenarAgentes, precisaDeVoce, proximoPasso, tempoRelativo } from './regras';

const ag = (p: Partial<AgenteResumo>): AgenteResumo => ({
  id: p.nome ?? 'x', nome: 'x', resumo: '', status: 'rascunho', atualizadoEm: '2026-11-13T12:00:00Z',
  ferramentas: 1, ferramentasEscrita: 0, baseTags: [],
  avaliacoes: { total: 0, ok: 0, parcial: 0, falha: 0 },
  ultimaExecucao: null, aguardandoAprovacao: null,
  revisao: { erros: 0, avisos: 0 }, ...p,
});
const executado = { status: 'concluida' as const, criadoEm: '2026-11-13T10:00:00Z' };
const aval = (ok: number, total: number) => ({ total, ok, parcial: 0, falha: total - ok });

describe('próximo passo do agente', () => {
  it('segue o ciclo: pendência grave → playground → testes → taxa → ativar → nada', () => {
    expect(proximoPasso(ag({ revisao: { erros: 2, avisos: 0 } }))?.rotulo).toBe('Resolver 2 pendências graves');
    expect(proximoPasso(ag({}))?.destino).toBe('playground');
    expect(proximoPasso(ag({ ultimaExecucao: executado }))?.destino).toBe('avaliacoes');
    expect(proximoPasso(ag({ ultimaExecucao: executado, avaliacoes: aval(1, 4) }))?.rotulo).toBe('Melhorar a taxa de acerto');
    expect(proximoPasso(ag({ ultimaExecucao: executado, avaliacoes: aval(4, 5) }))?.rotulo).toBe('Pronto para ativar');
    expect(proximoPasso(ag({ status: 'ativo', ultimaExecucao: executado, avaliacoes: aval(5, 5) }))).toBeNull();
  });

  it('aprovação pendente vem antes de tudo e conta como "precisa de você"', () => {
    const a = ag({ revisao: { erros: 1, avisos: 0 }, aguardandoAprovacao: { total: 1, maisRecente: 'e1' } });
    expect(proximoPasso(a)?.destino).toBe('aprovacao');
    expect(proximoPasso(a)?.rotulo).toBe('Decidir uma ação pendente');
    expect(precisaDeVoce(a)).toBe(true);
    expect(precisaDeVoce(ag({}))).toBe(false);
  });

  it('configuração ilegível pede revisão; arquivado não pede nada', () => {
    expect(proximoPasso(ag({ revisao: null }))?.tone).toBe('danger');
    expect(proximoPasso(ag({ status: 'arquivado', revisao: null }))).toBeNull();
  });

  it('funciona com a API antiga, sem os campos de execução', () => {
    const antigo = ag({});
    delete antigo.ultimaExecucao;
    delete antigo.aguardandoAprovacao;
    expect(proximoPasso(antigo)?.destino).toBe('playground');
  });

  it('marca as etapas concluídas', () => {
    const e = etapas(ag({ ultimaExecucao: executado, avaliacoes: aval(9, 10) }));
    expect(e.map((x) => x.feita)).toEqual([true, true, true, false]);
  });
});

describe('filtro e ordem', () => {
  const lista = [
    ag({ nome: 'Operador', status: 'ativo', baseTags: ['proxmox'] }),
    ag({ nome: 'Análise CVE', resumo: 'advisories' }),
    ag({ nome: 'Velho', status: 'arquivado' }),
    ag({ nome: 'Quebrado', revisao: { erros: 1, avisos: 0 } }),
  ];
  const f = { status: 'todos' as const, busca: '', soPendentes: false };

  it('"todos" esconde arquivados; busca ignora acento e olha tags', () => {
    expect(filtrarAgentes(lista, f).map((a) => a.nome)).toEqual(['Operador', 'Análise CVE', 'Quebrado']);
    expect(filtrarAgentes(lista, { ...f, busca: 'analise' }).map((a) => a.nome)).toEqual(['Análise CVE']);
    expect(filtrarAgentes(lista, { ...f, busca: 'PROXMOX' }).map((a) => a.nome)).toEqual(['Operador']);
    expect(filtrarAgentes(lista, { ...f, status: 'arquivado' }).map((a) => a.nome)).toEqual(['Velho']);
    expect(filtrarAgentes(lista, { ...f, soPendentes: true }).map((a) => a.nome)).toEqual(['Quebrado']);
  });

  it('quem precisa de você sobe; o resto mantém a ordem', () => {
    expect(ordenarAgentes(lista).map((a) => a.nome)).toEqual(['Quebrado', 'Operador', 'Análise CVE', 'Velho']);
  });

  it('conta por status', () => {
    expect(contarPorStatus(lista)).toEqual({ todos: 3, ativo: 1, teste: 0, rascunho: 2, arquivado: 1 });
  });
});

describe('tempo relativo', () => {
  const agora = new Date('2026-11-13T12:00:00Z');
  it('formata intervalos', () => {
    expect(tempoRelativo('2026-11-13T11:59:30Z', agora)).toBe('agora');
    expect(tempoRelativo('2026-11-13T11:55:00Z', agora)).toBe('há 5 min');
    expect(tempoRelativo('2026-11-13T09:00:00Z', agora)).toBe('há 3 h');
    expect(tempoRelativo('2026-11-12T11:00:00Z', agora)).toBe('ontem');
    expect(tempoRelativo('2026-11-03T12:00:00Z', agora)).toBe('há 10 dias');
  });
});
