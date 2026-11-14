import { describe, expect, it } from 'vitest';
import {
  agentesDasTags, filtrarPorTag, fmtData, memoriaDaLeitura, origemMeta, parseTags, relacionadosPorTags, tagsNaBase, unicosPorId,
} from './regras';

interface It { id: string; tags: string[]; grupo?: string }
const it_ = (id: string, tags: string[], grupo?: string): It => ({ id, tags, grupo });
const opts = { getId: (i: It) => i.id, getTags: (i: It) => i.tags, mesmoGrupo: (a: It, b: It) => !!a.grupo && a.grupo === b.grupo };

describe('regras de conhecimento', () => {
  it('formata data ISO e tolera vazio ou formato estranho', () => {
    expect(fmtData('2026-11-08T13:45:10.000Z')).toBe('08/11/2026 13:45');
    expect(fmtData('2026-11-08')).toBe('08/11/2026');
    expect(fmtData(null)).toBe('');
    expect(fmtData('ontem')).toBe('ontem');
  });

  it('separa tags por vírgula em minúsculas, sem vazios nem repetidas', () => {
    expect(parseTags(' AD, kerberos,, ad ,')).toEqual(['ad', 'kerberos']);
    expect(parseTags('')).toEqual([]);
  });

  it('filtra por tag sem diferenciar caixa', () => {
    const l = [it_('1', ['Pentest']), it_('2', ['blue'])];
    expect(filtrarPorTag(l, 'pentest', (i) => i.tags).map((i) => i.id)).toEqual(['1']);
    expect(filtrarPorTag(l, undefined, (i) => i.tags)).toHaveLength(2);
  });

  it('ranqueia relacionados por tags em comum, exclui o próprio e repetidos', () => {
    const alvo = it_('a', ['ad', 'kerberos', 'red'], 'red');
    const l = [alvo, it_('b', ['ad']), it_('c', ['AD', 'kerberos']), it_('c', ['ad']), it_('d', ['web']), it_('e', [], 'red')];
    const r = relacionadosPorTags(alvo, l, opts);
    expect(r.map((x) => x.item.id)).toEqual(['c', 'b', 'e']);
    expect(r[0].comuns).toEqual(['ad', 'kerberos']);
    expect(relacionadosPorTags(alvo, l, { ...opts, max: 1 })).toHaveLength(1);
  });

  it('lista os agentes que usam as tags como base', () => {
    const agentes = [
      { id: '1', nome: 'Zeta', baseTags: ['AD'] },
      { id: '2', nome: 'Alfa', baseTags: ['ad', 'kerberos'] },
      { id: '3', nome: 'Beta', baseTags: ['web'] },
    ];
    const r = agentesDasTags(agentes, ['kerberos', 'ad']);
    expect(r.map((x) => x.agente.nome)).toEqual(['Alfa', 'Zeta']);
    expect(r[0].tags).toEqual(['ad', 'kerberos']);
    expect(agentesDasTags(agentes, [])).toEqual([]);
  });

  it('cruza as tags do item com a base do Segundo Cérebro', () => {
    const r = tagsNaBase(['AD', 'nova'], [{ tag: 'ad', total: 4 }], [{ id: '1', nome: 'Analista', baseTags: ['ad'] }]);
    expect(r).toEqual([
      { tag: 'ad', memorias: 4, agentes: ['Analista'] },
      { tag: 'nova', memorias: 0, agentes: [] },
    ]);
  });

  it('traduz a origem da memória e não quebra com origem nova', () => {
    expect(origemMeta('url').label).toBe('Página da web');
    expect(origemMeta('outra').label).toBe('outra');
    expect(origemMeta('').label).toBe('Desconhecida');
  });

  it('junta listas sem repetir id', () => {
    expect(unicosPorId([[{ id: 'a' }, { id: 'b' }], undefined, [{ id: 'a' }, { id: 'c' }]]).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('monta o texto da memória a partir da leitura, sem seções vazias', () => {
    const t = memoriaDaLeitura({ titulo: 'x', url: 'https://exemplo.example/a', resumo: 'R', anotacoes: '  ', textoOriginal: '' });
    expect(t).toBe('Fonte: https://exemplo.example/a\n\n## Resumo\nR');
  });
});
