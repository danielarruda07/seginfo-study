import { describe, expect, it, vi } from 'vitest';

vi.mock('../fortigate.js', () => ({ fortigateFaltando: () => [], fortigateGet: vi.fn() }));

const { cruzarExposicao, expandirPortas, exposicaoEsperada, compararEsperadaReal } = await import('./esperadaReal.js');
const { classificarDnsbl, consultaReversa, consultarDnsbl, resultadoDnsbl, lerAbuseIpdb, resultadoAbuseIpdb, lerGreyNoise, resultadoGreyNoise, fontes: fontesRep } = await import('./reputacao.js');
const { avaliarCabecalhos, compararObservatory, compararTls, faixaValidade, resultadoObservatory, resultadoTls, resumirTls } = await import('./saudeSite.js');

const ctxPub = { alvo: { tipo: 'ip-publico' as const, valor: '' }, base: { ips: ['203.0.113.9'], portasPorIp: { '203.0.113.9': [22, 80] } } };

describe('exposição esperada × vista', () => {
  it('expande portas e faixas', () => {
    expect(expandirPortas('80')).toEqual([80]);
    expect(expandirPortas('8000-8002')).toEqual([8000, 8001, 8002]);
    expect(expandirPortas('abc')).toEqual([]);
    expect(expandirPortas('1-65535')).toHaveLength(2048);
  });

  const vips = [
    { name: 'VIP-SSH', portforward: 'enable', protocol: 'tcp', extport: '22', mappedport: '22', mappedip: [{ range: '10.0.0.10' }] },
    { name: 'VIP-WEB', portforward: 'enable', protocol: 'tcp', extport: '8080', mappedport: '80', mappedip: [{ range: '10.0.0.10' }] },
    { name: 'VIP-OFF', portforward: 'enable', protocol: 'tcp', extport: '3389', mappedip: [{ range: '10.0.0.20' }] },
  ];
  const grupos = [{ name: 'GRP', member: [{ name: 'VIP-SSH' }, { name: 'VIP-WEB' }] }];
  const policies = [
    { policyid: 1, name: 'EXPOE', status: 'enable', action: 'accept', schedule: 'JANELA', dstaddr: [{ name: 'GRP' }] },
    { policyid: 2, name: 'DESLIGADA', status: 'disable', action: 'accept', dstaddr: [{ name: 'VIP-OFF' }] },
    { policyid: 3, name: 'DESCARTA', status: 'enable', action: 'deny', dstaddr: [{ name: 'VIP-OFF' }] },
  ];

  it('só conta VIPs de policies ativas que aceitam, resolvendo grupos', () => {
    const e = exposicaoEsperada(vips, grupos, policies);
    expect(e.portas.map((p) => p.porta)).toEqual([22, 8080]);
    expect(e.portas[1]).toMatchObject({ vip: 'VIP-WEB', destino: '10.0.0.10:80', agenda: 'JANELA' });
  });

  it('separa vista e não publicada, publicada e vista, publicada e não vista', () => {
    const r = cruzarExposicao(exposicaoEsperada(vips, grupos, policies), ctxPub.base.portasPorIp, 'ip-publico');
    expect(r.conjuntos.inesperadas).toEqual(['203.0.113.9:80']);
    expect(r.conjuntos.naoVistas).toEqual(['8080']);
    expect(r.destaques[0]).toMatchObject({ valor: 1, tom: 'alta' });
  });

  it('NAT completo cobre qualquer porta', () => {
    const r = cruzarExposicao(exposicaoEsperada([{ name: 'NAT', portforward: 'disable' }], [], [{ status: 'enable', action: 'accept', dstaddr: [{ name: 'NAT' }] }]), { x: [1234] }, 'ip');
    expect(r.conjuntos.inesperadas).toEqual([]);
  });

  it('porta inesperada nova vira alta no IP público e média em outro IP', () => {
    const a = cruzarExposicao({ portas: [], natCompleto: [] }, { x: [22] }, 'ip-publico');
    const b = cruzarExposicao({ portas: [], natCompleto: [] }, { x: [22, 25] }, 'ip-publico');
    expect(compararEsperadaReal(a, b, ctxPub)).toEqual([expect.objectContaining({ tipo: 'exposicao-inesperada', severidade: 'alta' })]);
    expect(compararEsperadaReal(a, b, { ...ctxPub, alvo: { tipo: 'ip', valor: 'x' } })[0].severidade).toBe('media');
    expect(compararEsperadaReal(b, a, ctxPub)[0]).toMatchObject({ tipo: 'exposicao-inesperada-resolvida', severidade: 'info' });
  });
});

describe('reputação', () => {
  it('DNSBL: listado, limpo e consulta recusada da Spamhaus', () => {
    expect(classificarDnsbl(null).estado).toBe('limpo');
    expect(classificarDnsbl(['127.0.0.2']).estado).toBe('listado');
    expect(classificarDnsbl(['127.255.255.254']).estado).toBe('recusada');
    expect(consultaReversa('203.0.113.9', 'zen.spamhaus.org')).toBe('9.113.0.203.zen.spamhaus.org');
  });

  it('DNSBL: NXDOMAIN é limpo, outro erro não é listado', async () => {
    const nx = Object.assign(new Error('x'), { code: 'ENOTFOUND' });
    expect((await consultarDnsbl('203.0.113.9', 'z', () => Promise.reject(nx))).estado).toBe('limpo');
    expect((await consultarDnsbl('203.0.113.9', 'z', () => Promise.reject(Object.assign(new Error('t'), { code: 'ETIMEOUT' })))).estado).toBe('erro');
    expect((await consultarDnsbl('203.0.113.9', 'z', async () => ['127.0.0.4'])).estado).toBe('listado');
  });

  it('DNSBL: entrar em lista vira alta', () => {
    const limpo = resultadoDnsbl([{ ip: '203.0.113.9', zona: 'z', estado: 'limpo', codigos: [] }]);
    const sujo = resultadoDnsbl([{ ip: '203.0.113.9', zona: 'z', estado: 'listado', codigos: ['127.0.0.2'] }]);
    const dnsbl = fontesRep.find((f) => f.id === 'dnsbl')!;
    expect(dnsbl.comparar!(limpo, sujo, ctxPub)[0]).toMatchObject({ tipo: 'reputacao-listado', severidade: 'alta' });
    expect(sujo.destaques[0].tom).toBe('alta');
  });

  it('AbuseIPDB: cruzar 25 é média, cruzar 75 é alta', () => {
    const r = (score: number) => resultadoAbuseIpdb([lerAbuseIpdb('203.0.113.9', { data: { abuseConfidenceScore: score, totalReports: 3 } })]);
    const abuse = fontesRep.find((f) => f.id === 'abuseipdb')!;
    expect(abuse.comparar!(r(0), r(30), ctxPub).map((m) => m.severidade)).toEqual(['media']);
    expect(abuse.comparar!(r(30), r(80), ctxPub).map((m) => m.severidade)).toEqual(['alta']);
    expect(abuse.faltando!()).toEqual(process.env.ABUSEIPDB_API_KEY ? [] : ['ABUSEIPDB_API_KEY']);
  });

  it('GreyNoise: 404 é não visto; passar a varrer ou virar malicioso é alta', () => {
    expect(lerGreyNoise('203.0.113.9', 404, null).visto).toBe(false);
    expect(() => lerGreyNoise('203.0.113.9', 429, null)).toThrow(/limite/);
    const quieto = resultadoGreyNoise([lerGreyNoise('203.0.113.9', 404, null)]);
    const mau = resultadoGreyNoise([lerGreyNoise('203.0.113.9', 200, { noise: true, classification: 'malicious' })]);
    const gn = fontesRep.find((f) => f.id === 'greynoise')!;
    expect(gn.comparar!(quieto, mau, ctxPub).every((m) => m.severidade === 'alta')).toBe(true);
    expect(quieto.destaques[0]).toMatchObject({ valor: 'não visto', tom: 'ok' });
  });
});

describe('saúde do site', () => {
  const agora = Date.parse('2026-11-15T00:00:00Z');

  it('TLS: dias restantes e faixas', () => {
    const t = resumirTls({ issuer: { O: 'Exemplo CA' } as never, valid_to: 'Nov 25 00:00:00 2026 GMT', subjectaltname: 'DNS:exemplo.com, DNS:www.exemplo.com' },
      { protocolo: 'TLSv1.3', autorizado: true, erro: null }, agora);
    expect(t).toMatchObject({ emissor: 'Exemplo CA', diasRestantes: 10, nomesAlternativos: ['exemplo.com', 'www.exemplo.com'] });
    expect([faixaValidade(-1), faixaValidade(10), faixaValidade(20), faixaValidade(90), faixaValidade(null)]).toEqual(['vencido', 'ate14', 'ate30', 'ok', null]);
    expect(resultadoTls('exemplo.com', t).destaques[0].tom).toBe('alta');
  });

  it('TLS: perto de vencer e troca de emissor viram mudança', () => {
    const base = { protocolo: 'TLSv1.3', autorizado: true, erro: null };
    const ok = resultadoTls('e.com', resumirTls({ issuer: { O: 'A' } as never, valid_to: 'Mar 1 00:00:00 2027 GMT' }, base, agora));
    const perto = resultadoTls('e.com', resumirTls({ issuer: { O: 'B' } as never, valid_to: 'Dec 5 00:00:00 2026 GMT' }, base, agora));
    const m = compararTls(ok, perto);
    expect(m.map((x) => [x.tipo, x.severidade])).toEqual([['tls-alerta', 'media'], ['tls-emissor', 'media']]);
  });

  it('cabeçalhos: frame-ancestors substitui X-Frame-Options; nosniff é exigido', () => {
    const av = avaliarCabecalhos({ 'content-security-policy': "default-src 'self'; frame-ancestors 'none'", 'x-content-type-options': 'algo' });
    const p = Object.fromEntries(av.map((c) => [c.id, c.presente]));
    expect(p).toMatchObject({ csp: true, xfo: true, xcto: false, hsts: false });
  });

  it('Observatory: falha não gera conjunto; nota pior é média', () => {
    expect(resultadoObservatory('e.com', { error: 'x' }).conjuntos).toEqual({});
    const b = resultadoObservatory('e.com', { grade: 'B', score: 70 });
    const d = resultadoObservatory('e.com', { grade: 'D', score: 30 });
    expect(compararObservatory(b, d)[0]).toMatchObject({ tipo: 'observatory-piorou', severidade: 'media' });
    expect(compararObservatory(d, b)[0].severidade).toBe('info');
  });
});
