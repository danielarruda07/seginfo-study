import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIARIO_PROJETO, ESTRATEGIA_PADRAO, EstrategiaSchema, normalizarUrlLinkedin } from '@seginfo/shared';
import {
  checklistPost, contextoDoEstudo, diarioEmMarkdown, engajamento, juntarDiario, lerSharesCsv, parseCsv,
  riscosDePublicacao, taxaEngajamento,
} from './linkedin';
import { clearReadError } from './store';

function mockStorage() {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: (i: number) => [...values.keys()][i] ?? null,
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => { values.set(k, String(v)); },
    removeItem: (k: string) => { values.delete(k); },
    clear: () => values.clear(),
  };
}

const SHARES = [
  'Date,ShareLink,ShareCommentary,SharedUrl,MediaUrl,Visibility',
  '2026-10-01 12:00:00,https://www.linkedin.com/feed/update/urn:li:share:1,"Primeira linha, com vírgula',
  '',
  'Segunda linha com ""aspas"".",,,MEMBER_NETWORK',
  '2026-10-05 09:30:00,https://www.linkedin.com/feed/update/urn:li:share:2,,,https://media,MEMBER_NETWORK',
  '2026-10-07 18:00:00,https://www.linkedin.com/feed/update/urn:li:share:3/?trk=x,Post simples,,,PUBLIC',
  '2026-10-07 18:00:00,https://www.linkedin.com/feed/update/urn:li:share:3,Post simples repetido,,,PUBLIC',
].join('\r\n');

describe('linkedin', () => {
  beforeEach(() => { vi.stubGlobal('localStorage', mockStorage()); clearReadError(); });
  afterEach(() => vi.unstubAllGlobals());

  it('parses CSV with quotes, escaped quotes and newlines inside fields', () => {
    expect(parseCsv('a,b\n"x, y","linha 1\nlinha ""2"""\n')).toEqual([['a', 'b'], ['x, y', 'linha 1\nlinha "2"']]);
  });

  it('reads Shares.csv: skips posts without text, dedupes by URL, normalizes Windows newlines', () => {
    const r = lerSharesCsv(SHARES);
    expect(r.erro).toBeUndefined();
    expect(r.ignorados).toBe(1);
    expect(r.posts.map((p) => p.publicadoEm)).toEqual(['2026-10-01', '2026-10-07']);
    expect(r.posts[0].texto).toBe('Primeira linha, com vírgula\n\nSegunda linha com "aspas".');
  });

  it('rejects files that are not the LinkedIn export', () => {
    expect(lerSharesCsv('nome,email\nfoo,bar').erro).toMatch(/Shares\.csv/);
  });

  it('normalizes post URLs', () => {
    expect(normalizarUrlLinkedin('https://www.LinkedIn.com/posts/abc/?utm=1#x')).toBe('https://www.linkedin.com/posts/abc');
  });

  it('flags text that exposes the environment', () => {
    expect(riscosDePublicacao('acessei 10.10.10.5 pelo painel')).toContain('endereço IP ou de rede');
    expect(riscosDePublicacao('o host dc01.criecomia.local caiu')).toContain('domínio do ambiente');
    expect(riscosDePublicacao('aprendi a pensar como atacante')).toEqual([]);
  });

  it('scores a well-built post on the checklist', () => {
    const corpo = [
      'Montei um honeypot e em 24 horas vieram 3.000 tentativas de login.',
      'O que aprendi: as senhas tentadas são previsíveis, e o primeiro minuto já mostra quem está varrendo a internet.',
      'Na prática, troquei a pergunta "estou exposto?" por "o que estou medindo?".',
      'E você, já olhou os logs do seu próprio firewall com olhos de atacante?',
      '#segurancadainformacao #blueteam #homelab',
    ].join('\n\n');
    const itens = checklistPost('Deixei uma porta aberta de propósito. Veja o que entrou em 24 horas.', corpo);
    expect(itens.every((i) => i.ok)).toBe(true); // texto curto também pode funcionar; comprimento não é regra universal
    expect(checklistPost('', 'veja https://site.com').some((i) => i.id === 'link')).toBe(false);
  });

  it('computes engagement', () => {
    const m = { impressoes: 1000, reacoes: 40, comentarios: 8, compartilhamentos: 2, salvamentos: 0 };
    expect(engajamento(m)).toBe(40 + 16 + 6);
    expect(taxaEngajamento(m)).toBe(5);
    expect(taxaEngajamento({})).toBeNull();
  });

  it('default strategy is valid for the API', () => {
    expect(EstrategiaSchema.safeParse(ESTRATEGIA_PADRAO).success).toBe(true);
  });

  it('keeps the project diary publishable', () => {
    // o diário vira post público: nada de IP, domínio ou ativo do homelab (falar de "senha" numa lição é ok)
    const vazamentos = ['endereço IP ou de rede', 'domínio do ambiente', 'nome ou endereço de ativo do homelab'];
    for (const e of DIARIO_PROJETO) {
      expect(riscosDePublicacao(`${e.titulo}\n${e.descricao}`).filter((r) => vazamentos.includes(r)), e.id).toEqual([]);
    }
    expect(new Set(DIARIO_PROJETO.map((e) => e.id)).size).toBe(DIARIO_PROJETO.length);
  });

  it('merges the code diary with the user entries, newest first', () => {
    const doUsuario = [{ id: 'u1', data: '2099-01-01', titulo: 'Meu marco', descricao: 'x', categoria: 'aprendizado' as const, tags: [] }];
    const todas = juntarDiario(doUsuario);
    expect(todas[0]).toMatchObject({ id: 'u1', origem: 'voce' });
    expect(todas).toHaveLength(DIARIO_PROJETO.length + 1);
    const md = diarioEmMarkdown(todas);
    expect(md.indexOf('Nasce a SegInfo Study')).toBeLessThan(md.indexOf('Meu marco')); // cronológico
  });

  it('study context never carries inventory or risky notes', () => {
    localStorage.setItem('seginfo:sessoes', JSON.stringify([
      { id: 'a', data: '2026-11-01', minutos: 30, nota: 'revisei MITRE ATT&CK' },
      { id: 'b', data: '2026-11-02', minutos: 30, nota: 'configurei 10.10.10.5' },
    ]));
    const ctx = contextoDoEstudo();
    expect(ctx).toContain('revisei MITRE ATT&CK');
    expect(ctx).not.toContain('10.10.10.5');
  });
});
