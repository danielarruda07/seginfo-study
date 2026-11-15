import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Resolver } from 'node:dns/promises';
import { bannerCurto, fontes as fontesShodanCensys, lerHostCensys, lerHostShodan, resultadoCensys, resultadoShodan } from './shodanCensys.js';
import { fontes as fontesTypo, gerarCandidatos, resolverCandidatos, resultadoParecidos, separarDominio, variacoesDoRotulo } from './typosquatting.js';
import { analisarCdx, classificarUrl, fontes as fontesWayback, normalizarUrl, resultadoWayback } from './wayback.js';
import type { ContextoFonte } from './tipos.js';

const ctx = (valor: string, ips: string[] = []): ContextoFonte => ({ alvo: { tipo: 'dominio', valor }, base: { ips, portasPorIp: {} } });
const fonte = (lista: typeof fontesTypo, id: string) => lista.find((f) => f.id === id)!;

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Shodan API', () => {
  const resposta = {
    org: 'Provedor X', isp: 'Provedor X', os: null, last_update: '2026-11-10T12:00:00', tags: ['self-signed'],
    data: [
      { port: 443, transport: 'tcp', product: 'nginx', version: '1.24', timestamp: '2026-11-09T01:02:03',
        http: { title: 'Painel\n<b>Login</b>' }, ssl: { cert: { subject: { CN: 'exemplo.com' }, expires: '20270101000000Z' } },
        data: 'HTTP/1.1 200 OK\r\nServer: nginx\u0000\u0007' + 'x'.repeat(400) },
      { port: 22, transport: 'tcp', product: 'OpenSSH', data: 'SSH-2.0-OpenSSH_9.6' },
    ],
  };

  it('lê serviços, título, certificado e banner limpo', () => {
    const h = lerHostShodan('203.0.113.5', resposta);
    expect(h.servicos.map((s) => s.porta)).toEqual([22, 443]);
    const s443 = h.servicos[1];
    expect(s443).toMatchObject({ produto: 'nginx', versao: '1.24', tituloHttp: 'Painel <b>Login</b>', certificado: 'exemplo.com, expira 01/01/2027', visto: '2026-11-09' });
    expect(s443.banner.length).toBeLessThanOrEqual(201);
    expect(s443.banner).not.toMatch(/[\u0000-\u001f]/);
    expect(bannerCurto('a\r\n\tb')).toBe('a b');
  });

  it('compara serviços: novo é alta, sumido é info', () => {
    const f = fonte(fontesShodanCensys, 'shodan-api');
    const antes = resultadoShodan([{ ...lerHostShodan('203.0.113.5', resposta), servicos: lerHostShodan('203.0.113.5', resposta).servicos.slice(0, 1) }], []);
    const depois = resultadoShodan([lerHostShodan('203.0.113.5', resposta)], []);
    const m = f.comparar!(antes, depois, ctx('exemplo.com'));
    expect(m).toEqual([expect.objectContaining({ tipo: 'shodan-servico-novo', severidade: 'alta' })]);
    expect(m[0].texto).toContain('443/tcp nginx');
  });

  it('fica desligado sem chave e trata 429 e 404', async () => {
    const f = fonte(fontesShodanCensys, 'shodan-api');
    vi.stubEnv('SHODAN_API_KEY', '');
    expect(f.faltando!()).toEqual(['SHODAN_API_KEY']);
    vi.stubEnv('SHODAN_API_KEY', 'k');
    expect(f.faltando!()).toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"x"}', { status: 429 })));
    await expect(f.coletar(ctx('exemplo.com', ['203.0.113.5']))).rejects.toThrow(/429/);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    const r = await f.coletar(ctx('exemplo.com', ['203.0.113.5', '10.0.0.1']));
    expect(r?.secoes.at(-1)?.titulo).toBe('Sem registro no Shodan');
    expect(r?.conjuntos.servicos).toEqual([]);
    expect(await f.coletar(ctx('exemplo.com', ['10.0.0.1']))).toBeNull(); // IP privado não é consultado
  });
});

describe('Censys', () => {
  it('lê a resposta da Search v2 e da Platform v3', () => {
    const v2 = lerHostCensys('203.0.113.5', { result: { last_updated_at: '2026-11-01T00:00:00Z', autonomous_system: { asn: 64500, name: 'AS EXEMPLO' },
      services: [{ port: 80, service_name: 'HTTP', software: [{ vendor: 'nginx', product: 'nginx' }] }] } });
    expect(v2).toMatchObject({ atualizado: '2026-11-01', as: 'AS64500 AS EXEMPLO', servicos: [{ porta: 80, nome: 'HTTP', software: ['nginx nginx'] }] });
    const v3 = lerHostCensys('203.0.113.5', { result: { resource: { services: [{ port: 22, protocol: 'SSH' }] } } });
    expect(v3.servicos).toEqual([{ porta: 22, nome: 'SSH', software: [] }]);
  });

  it('liga com qualquer um dos dois jeitos de credencial e compara portas', () => {
    const f = fonte(fontesShodanCensys, 'censys');
    vi.stubEnv('CENSYS_API_TOKEN', ''); vi.stubEnv('CENSYS_API_ID', ''); vi.stubEnv('CENSYS_API_SECRET', '');
    expect(f.faltando!()).toHaveLength(1);
    vi.stubEnv('CENSYS_API_TOKEN', 't');
    expect(f.faltando!()).toEqual([]);
    const a = resultadoCensys([{ ip: '203.0.113.5', atualizado: null, as: null, servicos: [{ porta: 80, nome: 'HTTP', software: [] }] }], [], 'v2');
    const b = resultadoCensys([{ ip: '203.0.113.5', atualizado: null, as: null, servicos: [{ porta: 8080, nome: 'HTTP', software: [] }] }], [], 'v2');
    expect(f.comparar!(a, b, ctx('exemplo.com')).map((m) => [m.tipo, m.severidade])).toEqual([['censys-porta-nova', 'alta'], ['censys-porta-sumiu', 'info']]);
  });
});

describe('Domínios parecidos', () => {
  it('separa rótulo e sufixo, inclusive sufixo de dois níveis', () => {
    expect(separarDominio('exemplo.com.br')).toEqual({ rotulo: 'exemplo', sufixo: 'com.br' });
    expect(separarDominio('www.exemplo.ia.br')).toEqual({ rotulo: 'exemplo', sufixo: 'ia.br' });
    expect(separarDominio('exemplo.com')).toEqual({ rotulo: 'exemplo', sufixo: 'com' });
    expect(separarDominio('a.exemplo.io')).toEqual({ rotulo: 'exemplo', sufixo: 'io' });
  });

  it('gera variações de cada técnica, válidas e sem o original', () => {
    const v = variacoesDoRotulo('modelo');
    expect(v.omissao).toContain('mdelo');
    expect(v.repeticao).toContain('mmodelo');
    expect(v.transposicao).toContain('omdelo');
    expect(v.homoglifo).toEqual(expect.arrayContaining(['rnodelo', 'm0delo', 'mode1o']));
    expect(v.hifen).toContain('mo-delo');
    expect(v.vogal).toContain('madelo');
    expect(v.teclado).toContain('nodelo');
    expect(v.palavra).toEqual(expect.arrayContaining(['modelo-login', 'secure-modelo', 'modeloapp']));
    for (const lista of Object.values(v)) for (const x of lista) expect(x).toMatch(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
    const c = gerarCandidatos('modelo.com.br');
    expect(c.length).toBeLessThanOrEqual(300);
    expect(new Set(c).size).toBe(c.length);
    expect(c).not.toContain('modelo.com.br');
    expect(c).toEqual(expect.arrayContaining(['modelo.com', 'modelo.xyz', 'mdelo.com.br', 'rnodelo.com.br', 'modelo-login.com.br']));
  });

  it('resolve com DNS simulado e separa os que apontam para IPs seus', async () => {
    const tabela: Record<string, { ns?: string[]; a?: string[]; mx?: string[] }> = {
      'modelo.com': { ns: ['ns1.x'], a: ['198.51.100.7'], mx: ['mail.x'] },
      'mdelo.com.br': { a: ['203.0.113.5'] },
      'modelo.xyz': { ns: ['ns.x'] },
    };
    const falha = () => Promise.reject(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
    const res = {
      resolveNs: (d: string) => (tabela[d]?.ns ? Promise.resolve(tabela[d].ns!) : falha()),
      resolve4: (d: string) => (tabela[d]?.a ? Promise.resolve(tabela[d].a!) : falha()),
      resolveMx: (d: string) => (tabela[d]?.mx ? Promise.resolve(tabela[d].mx!.map((exchange) => ({ exchange, priority: 10 }))) : falha()),
    } as unknown as Resolver;
    const { achados, consultados } = await resolverCandidatos(gerarCandidatos('modelo.com.br'), ['203.0.113.5'], res, 10_000);
    expect(consultados).toBe(gerarCandidatos('modelo.com.br').length);
    expect(achados.map((p) => p.dominio)).toEqual(['modelo.com', 'mdelo.com.br', 'modelo.xyz']);
    expect(achados.find((p) => p.dominio === 'mdelo.com.br')?.seu).toBe(true);
    const r = resultadoParecidos('modelo.com.br', achados, consultados, consultados);
    expect(r.conjuntos.registrados).toEqual(['modelo.com', 'modelo.xyz']);
    expect(r.conjuntos.comMx).toEqual(['modelo.com']);
    expect(r.destaques[0]).toMatchObject({ valor: 2, tom: 'alta' });
  });

  it('parecido novo é alta, ganhar MX é média; varredura incompleta não compara', () => {
    const f = fonte(fontesTypo, 'typosquatting');
    const p = (dominio: string, mx = false) => ({ dominio, ips: [], mx, seu: false });
    const a = resultadoParecidos('modelo.com.br', [p('modelo.com')], 10, 10);
    const b = resultadoParecidos('modelo.com.br', [p('modelo.com', true), p('modelo.xyz')], 10, 10);
    expect(f.comparar!(a, b, ctx('modelo.com.br')).map((m) => [m.tipo, m.severidade])).toEqual([['parecido-registrado', 'alta'], ['parecido-com-mx', 'media']]);
    const incompleta = resultadoParecidos('modelo.com.br', [p('modelo.com'), p('modelo.xyz')], 5, 10);
    expect(f.comparar!(a, incompleta, ctx('modelo.com.br'))).toEqual([]);
  });
});

describe('Wayback Machine', () => {
  it('classifica caminhos sensíveis e ignora o resto', () => {
    expect(classificarUrl('http://exemplo.com/.env')?.id).toBe('segredo');
    expect(classificarUrl('https://exemplo.com/.git/config')?.id).toBe('segredo');
    expect(classificarUrl('exemplo.com/backup/site.zip')?.id).toBe('backup');
    expect(classificarUrl('http://exemplo.com/dump.sql')?.id).toBe('backup');
    expect(classificarUrl('http://exemplo.com/wp-admin/')?.id).toBe('painel');
    expect(classificarUrl('http://exemplo.com/phpmyadmin/index.php')?.id).toBe('painel');
    expect(classificarUrl('http://exemplo.com/actuator/health')?.id).toBe('debug');
    expect(classificarUrl('http://exemplo.com/api/v1/users')?.id).toBe('api');
    expect(classificarUrl('http://exemplo.com/swagger-ui/')?.id).toBe('api');
    expect(classificarUrl('http://exemplo.com/login')?.id).toBe('login');
    expect(classificarUrl('http://exemplo.com/erro.log')?.id).toBe('arquivo');
    expect(classificarUrl('http://exemplo.com/')).toBeNull();
    expect(classificarUrl('http://exemplo.com/blog/post-1')).toBeNull();
    expect(classificarUrl('http://exemplo.com/sitemap.xml')).toBeNull();
    expect(classificarUrl('http://admin.exemplo.com/sobre')).toBeNull(); // o domínio não conta
  });

  it('analisa o CDX: URLs únicas, hosts e sensíveis com o ano mais recente', () => {
    const linhas = [
      ['original', 'timestamp', 'statuscode', 'mimetype'],
      ['http://exemplo.com/.env', '20190101000000', '200', 'text/plain'],
      ['https://www.exemplo.com/.env', '20230101000000', '404', 'text/html'],
      ['http://loja.exemplo.com/admin', '20210505000000', '302', 'text/html'],
      ['http://exemplo.com/sobre', '20220101000000', '200', 'text/html'],
    ];
    const a = analisarCdx('exemplo.com', linhas);
    expect(a.total).toBe(3);
    expect(a.hosts).toEqual(['exemplo.com', 'loja.exemplo.com']);
    expect(a.sensiveis.map((s) => [s.url, s.ano])).toEqual([['exemplo.com/.env', '2023'], ['loja.exemplo.com/admin', '2021']]);
    expect(normalizarUrl('https://WWW.Exemplo.com:443/a/')).toBe('exemplo.com/a');
    const r = resultadoWayback('exemplo.com', a, false);
    expect(r.destaques[1]).toMatchObject({ valor: 2, tom: 'alta' });
  });

  it('URL sensível nova é média; falha do serviço vira erro legível', async () => {
    const f = fonte(fontesWayback, 'wayback');
    const a = resultadoWayback('exemplo.com', analisarCdx('exemplo.com', [['http://exemplo.com/admin', '2020', '200']]), false);
    const b = resultadoWayback('exemplo.com', analisarCdx('exemplo.com', [['http://exemplo.com/admin', '2020', '200'], ['http://exemplo.com/db.sql', '2024', '200']]), false);
    expect(f.comparar!(a, b, ctx('exemplo.com'))).toEqual([expect.objectContaining({ tipo: 'wayback-url-sensivel', severidade: 'media' })]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    await expect(f.coletar(ctx('exemplo.com'))).rejects.toThrow(/HTTP 503/);
  });
});
