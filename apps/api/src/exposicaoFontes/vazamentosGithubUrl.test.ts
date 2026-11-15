import { afterEach, describe, expect, it, vi } from 'vitest';
import { fontes as fontesVaz, lerHibp, lerXposedOrNot, resultadoVazamentos } from './vazamentos.js';
import { caminhoArriscado, fontes as fontesGh, lerBuscaGithub, resultadoGithub } from './github.js';
import { fontes as fontesRep, lerUrlscan, lerVirusTotal, resultadoUrlscan, resultadoVirusTotal } from './reputacaoUrl.js';
import type { ContextoFonte } from './tipos.js';

const ctxEmail: ContextoFonte = { alvo: { tipo: 'email', valor: 'pessoa@exemplo.com' }, base: { ips: [], portasPorIp: {} } };
const ctxDominio: ContextoFonte = { alvo: { tipo: 'dominio', valor: 'exemplo.com' }, base: { ips: [], portasPorIp: {} } };

const resposta = (status: number, corpo: unknown) =>
  new Response(corpo === null ? '' : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('vazamentos', () => {
  const analytics = {
    ExposedBreaches: {
      breaches_details: [
        { breach: 'LojaA', xposed_date: '2019', xposed_data: 'Email addresses;Passwords', password_risk: 'plaintext', xposed_records: 10 },
        { breach: 'ForumB', xposed_date: '2021', xposed_data: 'Email addresses;Usernames', password_risk: 'unknown' },
      ],
    },
  };

  it('lê o XposedOrNot e marca senha em texto puro como grave', () => {
    const l = lerXposedOrNot(analytics);
    expect(l.map((v) => [v.nome, v.senha])).toEqual([['LojaA', 'texto-puro'], ['ForumB', 'sem-senha']]);
    const r = resultadoVazamentos('x', 'X', '', l);
    expect(r.destaques).toEqual([{ rotulo: 'Vazamentos', valor: 2, tom: 'alta' }, { rotulo: 'Com senha', valor: 1, tom: 'alta' }]);
    expect(r.secoes[0].itens[0].texto).toBe('ForumB (2021)');
    expect(r.secoes.at(-1)?.titulo).toBe('O que fazer');
    expect(lerXposedOrNot({ ExposedBreaches: null })).toEqual([]);
  });

  it('lê o HIBP', () => {
    expect(lerHibp([{ Title: 'Site', BreachDate: '2020-01-01', DataClasses: ['Passwords'], PwnCount: 5 }])[0])
      .toMatchObject({ nome: 'Site', senha: 'desconhecido', registros: 5 });
  });

  it('vazamento novo vira mudança alta; sem chave o HIBP fica desligado', async () => {
    const xon = fontesVaz[0];
    const a = resultadoVazamentos(xon.id, xon.nome, '', lerXposedOrNot({ ExposedBreaches: { breaches_details: [analytics.ExposedBreaches.breaches_details[1]] } }));
    const b = resultadoVazamentos(xon.id, xon.nome, '', lerXposedOrNot(analytics));
    expect(xon.comparar!(a, b, ctxEmail)).toEqual([expect.objectContaining({ tipo: 'vazamento-novo', severidade: 'alta' })]);
    expect(xon.comparar!(b, a, ctxEmail)).toEqual([]);
    vi.stubEnv('HIBP_API_KEY', '');
    expect(fontesVaz[1].faltando!()).toEqual(['HIBP_API_KEY']);
  });

  it('coleta pelo XposedOrNot e trata 429', async () => {
    const f = vi.fn(async () => resposta(200, analytics));
    vi.stubGlobal('fetch', f);
    const r = await fontesVaz[0].coletar(ctxEmail);
    expect(r?.conjuntos.vazamentos).toEqual(['LojaA', 'ForumB']);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain('breach-analytics?email=pessoa%40exemplo.com');
    vi.stubGlobal('fetch', vi.fn(async () => resposta(429, {})));
    await expect(fontesVaz[0].coletar(ctxEmail)).rejects.toThrow(/429/);
  });
});

describe('github', () => {
  it('classifica arquivos sensíveis pelo nome', () => {
    for (const p of ['.env', 'app/.env.production', 'config/settings.py', 'deploy/docker-compose.yml', 'keys/id_rsa', 'cert.pem', 'wp-config.php', 'src/config.json']) {
      expect(caminhoArriscado(p)).toBe(true);
    }
    for (const p of ['README.md', 'docs/lista.txt', 'src/index.ts']) expect(caminhoArriscado(p)).toBe(false);
  });

  it('lê a busca e compara: arquivo sensível novo é alto, menção nova é média', () => {
    const json = { total_count: 2, items: [
      { path: '.env', html_url: 'https://github.com/a/b/blob/x/.env', repository: { full_name: 'a/b' } },
      { path: 'README.md', html_url: 'https://github.com/c/d/blob/x/README.md', repository: { full_name: 'c/d' } },
    ] };
    const { total, itens } = lerBuscaGithub(json);
    const depois = resultadoGithub(total, itens);
    const antes = resultadoGithub(0, []);
    expect(depois.destaques[1]).toEqual({ rotulo: 'Arquivos sensíveis', valor: 1, tom: 'alta' });
    const m = fontesGh[0].comparar!(antes, depois, ctxDominio);
    expect(m.map((x) => [x.tipo, x.severidade])).toEqual([['github-arquivo-sensivel', 'alta'], ['github-mencao-nova', 'media']]);
  });

  it('usa o token no cabeçalho e explica o limite', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'tkn');
    const f = vi.fn(async () => resposta(403, { message: 'rate limit' }));
    vi.stubGlobal('fetch', f);
    await expect(fontesGh[0].coletar(ctxDominio)).rejects.toThrow(/limitou/);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('tkn');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tkn');
  });
});

describe('reputação', () => {
  it('urlscan: conta análises e destaca as maliciosas', () => {
    const { total, analises } = lerUrlscan({ total: 3, results: [
      { task: { uuid: 'u1', time: '2026-11-01T00:00:00Z', url: 'http://x' }, page: { url: 'https://exemplo.com/' }, verdicts: null },
      { task: { uuid: 'u2', time: '2026-11-02T00:00:00Z' }, page: { url: 'https://exemplo.com/login' }, verdicts: { malicious: true } },
    ] });
    expect(total).toBe(3);
    const r = resultadoUrlscan(total, analises);
    expect(r.conjuntos.maliciosas).toEqual(['u2']);
    expect(r.secoes[0].itens[0].link).toBe('https://urlscan.io/result/u2/');
    expect(fontesRep[0].comparar!(resultadoUrlscan(0, []), r, ctxDominio)[0]).toMatchObject({ tipo: 'urlscan-maliciosa', severidade: 'alta' });
  });

  it('VirusTotal: lê estatísticas e acusa quando passa de 0 para malicioso', () => {
    const limpo = lerVirusTotal('exemplo.com', { data: { attributes: { last_analysis_stats: { malicious: 0, suspicious: 0, harmless: 60, undetected: 20 }, reputation: 0, last_analysis_date: 1_760_000_000 } } });
    const sujo = { ...limpo, maliciosos: 3 };
    expect(limpo).toMatchObject({ inofensivos: 60, analisadoEm: expect.stringMatching(/^\d{4}-/) });
    expect(resultadoVirusTotal([limpo]).destaques[0]).toMatchObject({ valor: 'limpo', tom: 'ok' });
    const m = fontesRep[1].comparar!(resultadoVirusTotal([limpo]), resultadoVirusTotal([sujo]), ctxDominio);
    expect(m).toEqual([expect.objectContaining({ tipo: 'virustotal-malicioso', severidade: 'alta' })]);
  });

  it('VirusTotal: chave no cabeçalho e desligado sem chave', async () => {
    vi.stubEnv('VT_API_KEY', '');
    expect(fontesRep[1].faltando!()).toEqual(['VT_API_KEY']);
    vi.stubEnv('VT_API_KEY', 'k');
    const f = vi.fn(async () => resposta(200, { data: { attributes: { last_analysis_stats: { malicious: 1 } } } }));
    vi.stubGlobal('fetch', f);
    const r = await fontesRep[1].coletar(ctxDominio);
    expect(r?.conjuntos.maliciosos).toEqual(['exemplo.com']);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://www.virustotal.com/api/v3/domains/exemplo.com');
    expect((init.headers as Record<string, string>)['x-apikey']).toBe('k');
  });
});
