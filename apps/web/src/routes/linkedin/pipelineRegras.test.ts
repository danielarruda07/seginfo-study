import { describe, expect, it } from 'vitest';
import type { IdeiaLinkedin, PostPublicado, ProjetoLinkedin, RascunhoLinkedin } from '@seginfo/shared';
import {
  colunasDoQuadro, deDatetimeLocal, desempenhoPor, diasEntre, falhados, filtrarIdeias, gradeDoMes, instantesOcupados,
  itensDoCalendario, nomeDoProjeto, paraDatetimeLocal, resumoDoProjeto, somarDias, sugestaoDeHorario, vencidos,
} from './pipelineRegras';

const FUSO = 'America/Fortaleza';

const rascunho = (id: string, extra: Partial<RascunhoLinkedin> = {}): RascunhoLinkedin => ({
  id, titulo: `Rascunho ${id}`, gancho: 'g', corpo: 'c', direcaoVisual: '', textoAlternativo: '', roteiroSlides: '',
  topicoId: null, publicado: false, status: 'rascunho', formato: 'texto', projetoId: null, ideiaId: null,
  agendadoPara: null, canal: 'lembrete', tentativas: 0, ultimoErro: '', linkedinPostId: null, aprovadoEm: null,
  publicadoEm: null, criadoEm: '2026-11-01T10:00:00.000Z', atualizadoEm: '2026-11-01T10:00:00.000Z',
  visibilidade: 'PUBLIC', midia: null, ...extra,
});

const post = (id: string, extra: Partial<PostPublicado> = {}): PostPublicado => ({
  id, url: `https://www.linkedin.com/feed/update/urn:li:share:${id}`, publicadoEm: '2026-11-10', texto: 'Primeira linha\nresto',
  formato: 'texto', metricas: {}, origem: 'manual', analise: null, memoriaId: null, projetoId: null, ...extra,
});

const ideia = (id: string, extra: Partial<IdeiaLinkedin> = {}): IdeiaLinkedin => ({
  id, titulo: `Ideia ${id}`, briefing: '', pilar: null, projetoId: null, formato: null, origem: 'manual', origemRef: null,
  status: 'nova', sugeridaPara: null, criadoEm: '2026-11-01T10:00:00.000Z', ...extra,
});

const projeto = (id: string, extra: Partial<ProjetoLinkedin> = {}): ProjetoLinkedin => ({
  id, nome: `Projeto ${id}`, descricao: '', objetivo: '', pilar: null, status: 'ativo', resultadoEsperado: '', escopo: '',
  criteriosSucesso: '', fase: 'iniciacao', condicao: 'sem_avaliacao', avanco: 0, criadoEm: '2026-10-01T10:00:00.000Z', ...extra,
});

describe('colunasDoQuadro', () => {
  it('agrupa por status, põe falha e publicando em Agendado e limita os publicados', () => {
    const lista = [
      rascunho('a'), rascunho('b', { status: 'aprovado' }),
      rascunho('c', { status: 'agendado', agendadoPara: '2026-11-20T12:00:00.000Z' }),
      rascunho('d', { status: 'falhou', agendadoPara: '2026-11-25T12:00:00.000Z' }),
      rascunho('e', { status: 'publicando', agendadoPara: '2026-11-19T12:00:00.000Z' }),
      ...['p1', 'p2', 'p3'].map((id, i) => rascunho(id, { status: 'publicado', publicadoEm: `2026-11-0${i + 1}T12:00:00.000Z` })),
    ];
    const [rasc, aprov, agend, pub] = colunasDoQuadro(lista, 2);
    expect(rasc.itens.map((r) => r.id)).toEqual(['a']);
    expect(aprov.itens.map((r) => r.id)).toEqual(['b']);
    expect(agend.itens.map((r) => r.id)).toEqual(['d', 'e', 'c']); // falha primeiro, depois por data
    expect(pub.itens.map((r) => r.id)).toEqual(['p3', 'p2']);
    expect(pub.total).toBe(3);
  });
});

describe('vencidos e falhados', () => {
  it('só lembretes agendados cuja hora já chegou', () => {
    const agora = new Date('2026-11-20T12:00:00.000Z');
    const lista = [
      rascunho('ok', { status: 'agendado', agendadoPara: '2026-11-20T11:00:00.000Z' }),
      rascunho('futuro', { status: 'agendado', agendadoPara: '2026-11-20T13:00:00.000Z' }),
      rascunho('api', { status: 'agendado', canal: 'api', agendadoPara: '2026-11-20T11:00:00.000Z' }),
      rascunho('falha', { status: 'falhou', agendadoPara: '2026-11-20T10:00:00.000Z' }),
    ];
    expect(vencidos(lista, agora).map((r) => r.id)).toEqual(['ok']);
    expect(falhados(lista).map((r) => r.id)).toEqual(['falha']);
  });
});

describe('instantesOcupados', () => {
  it('junta outros agendados e os publicados, ignorando o próprio rascunho', () => {
    const lista = [
      rascunho('eu', { status: 'agendado', agendadoPara: '2026-11-20T12:00:00.000Z' }),
      rascunho('outro', { status: 'agendado', agendadoPara: '2026-11-21T12:00:00.000Z' }),
    ];
    expect(instantesOcupados(lista, [post('1', { publicadoEm: '2026-11-10' })], 'eu')).toEqual(['2026-11-21T12:00:00.000Z', '2026-11-10T12:00:00.000Z']);
  });
});

describe('datas', () => {
  it('datetime-local ↔ ISO ida e volta (no minuto)', () => {
    const iso = '2026-11-20T12:34:00.000Z';
    expect(deDatetimeLocal(paraDatetimeLocal(iso))).toBe(iso);
    expect(deDatetimeLocal('')).toBeNull();
    expect(deDatetimeLocal('amanhã')).toBeNull();
  });
  it('sugere amanhã às 9h no horário local', () => {
    expect(sugestaoDeHorario(new Date(2026, 10, 20, 15, 30))).toBe('2026-11-21T09:00');
  });
  it('soma dias e conta dias entre datas', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(diasEntre('2026-11-01', '2026-11-15')).toBe(14);
  });
});

describe('gradeDoMes', () => {
  it('cobre o mês em semanas completas de domingo a sábado', () => {
    const dias = gradeDoMes(2026, 10, '2026-11-14'); // novembro de 2026 começa num domingo
    expect(dias.length % 7).toBe(0);
    expect(dias[0].data).toBe('2026-11-01');
    expect(dias.at(-1)?.data).toBe('2026-12-05');
    expect(dias.filter((d) => d.doMes)).toHaveLength(30);
    expect(dias.filter((d) => d.hoje).map((d) => d.data)).toEqual(['2026-11-14']);
  });
  it('inclui os dias do mês anterior que completam a primeira semana', () => {
    const dias = gradeDoMes(2026, 11, '2026-11-14'); // dezembro de 2026 começa numa terça
    expect(dias[0].data).toBe('2026-11-29');
    expect(dias[0].doMes).toBe(false);
  });
});

describe('itensDoCalendario', () => {
  it('coloca agendados (dia local), publicados e ideias sugeridas nos dias certos', () => {
    const mapa = itensDoCalendario(
      [
        // 01:30 UTC do dia 21 ainda é dia 20 em Fortaleza (UTC-3)
        rascunho('a', { status: 'agendado', agendadoPara: '2026-11-21T01:30:00.000Z', projetoId: 'x' }),
        rascunho('f', { status: 'falhou', agendadoPara: '2026-11-20T12:00:00.000Z' }),
        rascunho('semreg', { status: 'publicado', publicadoEm: '2026-11-05T15:00:00.000Z' }),
        rascunho('comreg', { status: 'publicado', linkedinPostId: 'p1', publicadoEm: '2026-11-10T15:00:00.000Z' }),
        rascunho('solto'),
      ],
      [post('p1', { publicadoEm: '2026-11-10' })],
      [ideia('i1', { sugeridaPara: '2026-11-22' }), ideia('i2', { sugeridaPara: '2026-11-22', status: 'descartada' }), ideia('i3')],
      FUSO,
    );
    expect(mapa.get('2026-11-20')?.map((i) => [i.tipo, i.hora])).toEqual([['falhou', '09:00'], ['agendado', '22:30']]);
    expect(mapa.get('2026-11-05')?.[0]).toMatchObject({ tipo: 'publicado', rascunhoId: 'semreg' });
    expect(mapa.get('2026-11-10')).toHaveLength(1); // o registro oficial, sem duplicar o rascunho
    expect(mapa.get('2026-11-10')?.[0]).toMatchObject({ postId: 'p1', titulo: 'Primeira linha' });
    expect(mapa.get('2026-11-22')?.map((i) => i.ideiaId)).toEqual(['i1']);
  });
});

describe('resumoDoProjeto', () => {
  it('conta itens do projeto e avisa quando está parado', () => {
    const p = projeto('x');
    const r = resumoDoProjeto(p, {
      ideias: [ideia('1', { projetoId: 'x' }), ideia('2', { projetoId: 'x', status: 'descartada' }), ideia('3')],
      rascunhos: [
        rascunho('a', { projetoId: 'x' }), rascunho('b', { projetoId: 'x', status: 'aprovado' }),
        rascunho('c', { projetoId: 'x', status: 'agendado', agendadoPara: '2026-11-20T12:00:00.000Z' }),
        rascunho('d', { projetoId: 'x', status: 'publicado', publicadoEm: '2026-10-20T12:00:00.000Z' }),
        rascunho('e', { projetoId: 'y' }),
      ],
      publicados: [post('1', { projetoId: 'x', publicadoEm: '2026-10-25' }), post('2')],
    }, '2026-11-14', FUSO);
    expect(r).toMatchObject({ ideiasNovas: 1, emAndamento: 2, agendados: 1, publicados: 2, ultimoPost: '2026-10-25', diasSemPost: 20, parado: true });
  });
  it('projeto novo sem post não é "parado"; pausado nunca é', () => {
    const vazio = { ideias: [], rascunhos: [], publicados: [] };
    expect(resumoDoProjeto(projeto('n', { criadoEm: '2026-11-10T00:00:00.000Z' }), vazio, '2026-11-14', FUSO).parado).toBe(false);
    expect(resumoDoProjeto(projeto('v'), vazio, '2026-11-14', FUSO)).toMatchObject({ parado: true, diasSemPost: null });
    expect(resumoDoProjeto(projeto('p', { status: 'pausado' }), vazio, '2026-11-14', FUSO).parado).toBe(false);
  });
});

describe('filtrarIdeias e nomeDoProjeto', () => {
  it('filtra por status, projeto e busca', () => {
    const lista = [
      ideia('1', { titulo: 'Honeypot em números', projetoId: 'x' }),
      ideia('2', { titulo: 'Outra', briefing: 'fala de honeypot' }),
      ideia('3', { titulo: 'Honeypot antigo', status: 'descartada' }),
    ];
    expect(filtrarIdeias(lista, { status: 'nova', busca: 'HONEYPOT' }).map((i) => i.id)).toEqual(['1', '2']);
    expect(filtrarIdeias(lista, { status: 'nova', projetoId: 'x' }).map((i) => i.id)).toEqual(['1']);
    expect(filtrarIdeias(lista, { status: 'descartada' }).map((i) => i.id)).toEqual(['3']);
  });
  it('resolve o nome do projeto ou null', () => {
    expect(nomeDoProjeto([projeto('x')], 'x')).toBe('Projeto x');
    expect(nomeDoProjeto([projeto('x')], 'y')).toBeNull();
    expect(nomeDoProjeto([], null)).toBeNull();
  });
});

describe('desempenhoPor', () => {
  it('média da taxa por grupo, só com 2+ posts com impressões, do maior para o menor', () => {
    const posts = [
      post('1', { formato: 'texto', metricas: { impressoes: 100, reacoes: 10 } }),
      post('2', { formato: 'texto', metricas: { impressoes: 200, reacoes: 10 } }),
      post('3', { formato: 'carrossel', metricas: { impressoes: 100, reacoes: 20 } }),
      post('4', { formato: 'carrossel', metricas: { impressoes: 100, comentarios: 20 } }),
      post('5', { formato: 'video', metricas: { impressoes: 100, reacoes: 50 } }), // sozinho: fora
      post('6', { formato: 'texto' }), // sem impressões: não conta
    ];
    expect(desempenhoPor(posts, (p) => p.formato)).toEqual([
      { grupo: 'carrossel', posts: 2, taxaMedia: 20 },
      { grupo: 'texto', posts: 2, taxaMedia: 7.5 },
    ]);
  });
});
