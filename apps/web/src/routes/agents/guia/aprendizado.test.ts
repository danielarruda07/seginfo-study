import { describe, expect, it } from 'vitest';
import type { AcaoAuditoria, AgenteResumo } from '@/services/agentes';
import { FERRAMENTAS_CATALOGO } from '@/data/agentesFerramentas';
import { sugestoesDeMelhoria } from './aprendizado';
import { EXEMPLOS_FERRAMENTA, GUIAS } from './conteudo';

const agente = (p: Partial<AgenteResumo> = {}): AgenteResumo => ({
  id: 'a1', nome: 'Operador', resumo: '', status: 'teste', atualizadoEm: '2026-11-15', ferramentas: 4, ferramentasEscrita: 2,
  baseTags: [], avaliacoes: { total: 3, ok: 3, parcial: 0, falha: 0 }, ultimaExecucao: null, revisao: { erros: 0, avisos: 0 },
  autonomia: 'aprovar-tudo', ...p,
});
const acao = (p: Partial<AcaoAuditoria> = {}): AcaoAuditoria => ({
  execucaoId: 'e1', agenteId: 'a1', agenteNome: 'Operador', ferramenta: 'proxmox_listar_vms', entrada: {}, saida: 'ok',
  erro: false, decisao: 'automatica', decididoEm: null, ms: 10, ...p,
});
const vezes = <T,>(n: number, f: () => T) => Array.from({ length: n }, f);
const ids = (r: { id: string }[]) => r.map((s) => s.id);

describe('sugestões de melhoria', () => {
  it('sem dados, nenhuma sugestão', () => {
    expect(sugestoesDeMelhoria({ acoes: [], agentes: [agente()], niveis: {} })).toEqual([]);
  });

  it('ferramenta que falha 3 vezes vira atenção, com o último erro', () => {
    const acoes = vezes(3, () => acao({ erro: true, saida: 'certificado TLS não confiável' }));
    const [s] = sugestoesDeMelhoria({ acoes, agentes: [agente()], niveis: {} });
    expect(s.id).toBe('falha:proxmox_listar_vms');
    expect(s.tom).toBe('atencao');
    expect(s.texto).toContain('certificado TLS');
  });

  it('ação negada não conta como falha, mas negar 2 vezes sugere escrever a restrição', () => {
    const acoes = vezes(3, () => acao({ ferramenta: 'proxmox_apagar_vm', erro: true, decisao: 'negada' }));
    expect(ids(sugestoesDeMelhoria({ acoes, agentes: [agente()], niveis: {} }))).toEqual(['negada:a1|proxmox_apagar_vm']);
  });

  it('aprovar à mão 3 ações leves sugere o modo autônomo, só se ele estiver desligado', () => {
    const acoes = vezes(3, () => acao({ ferramenta: 'proxmox_ligar_vm', decisao: 'aprovada' }));
    const niveis = { proxmox_ligar_vm: 'leve' as const };
    expect(ids(sugestoesDeMelhoria({ acoes, agentes: [agente()], niveis }))).toEqual(['leves:a1']);
    expect(sugestoesDeMelhoria({ acoes, agentes: [agente({ autonomia: 'leves-automaticas' })], niveis })).toEqual([]);
    // destrutivas aprovadas não sugerem autonomia
    expect(sugestoesDeMelhoria({ acoes, agentes: [agente()], niveis: { proxmox_ligar_vm: 'destrutiva' } })).toEqual([]);
  });

  it('agente que já rodou sem casos de teste, e casos com falha', () => {
    const r = sugestoesDeMelhoria({
      acoes: [], niveis: {},
      agentes: [
        agente({ id: 'a1', ultimaExecucao: { status: 'concluida', criadoEm: '2026-11-15' }, avaliacoes: { total: 0, ok: 0, parcial: 0, falha: 0 } }),
        agente({ id: 'a2', nome: 'Outro', avaliacoes: { total: 2, ok: 1, parcial: 0, falha: 1 } }),
      ],
    });
    expect(ids(r)).toEqual(['falhacasos:a2', 'semcasos:a1']); // atenção primeiro
  });

  it('agentes repetidos aparecem só na visão geral; o agente do MCP e os arquivados ficam de fora', () => {
    const agentes = [
      agente({ id: 'a1', nome: 'Operador do Homelab' }), agente({ id: 'a2', nome: 'operador do homelab ' }),
      agente({ id: 'a3', nome: 'Operador do Homelab', status: 'arquivado' }),
      agente({ id: 'm', nome: 'Acesso MCP (Claude Code e outros clientes)', ultimaExecucao: { status: 'concluida', criadoEm: '2026-11-15' }, avaliacoes: { total: 0, ok: 0, parcial: 0, falha: 0 } }),
    ];
    expect(ids(sugestoesDeMelhoria({ acoes: [], agentes, niveis: {} }))).toEqual(['duplicado:operador do homelab']);
    expect(sugestoesDeMelhoria({ acoes: [], agentes, niveis: {}, agenteId: 'a1' })).toEqual([]);
  });

  it('filtrado por agente, ignora o que outro agente fez', () => {
    const acoes = vezes(3, () => acao({ agenteId: 'a2', erro: true }));
    expect(sugestoesDeMelhoria({ acoes, agentes: [agente(), agente({ id: 'a2' })], niveis: {}, agenteId: 'a1' })).toEqual([]);
  });
});

describe('conteúdo do guia', () => {
  it('toda tela tem passos e um caminho de melhoria', () => {
    for (const g of Object.values(GUIAS)) {
      expect(g.passos.length).toBeGreaterThan(0);
      expect(g.melhorar.length).toBeGreaterThan(0);
    }
  });

  it('toda ferramenta de infraestrutura do catálogo tem exemplo de pedido', () => {
    const semExemplo = FERRAMENTAS_CATALOGO.filter((f) => f.categoria === 'infra' && f.id !== 'monitoramento-leitura' && !EXEMPLOS_FERRAMENTA[f.id]);
    expect(semExemplo.map((f) => f.id)).toEqual([]);
  });
});
