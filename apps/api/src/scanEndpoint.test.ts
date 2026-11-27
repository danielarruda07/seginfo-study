import { describe, expect, it } from 'vitest';
import {
  classificarMetodos, escopoDoIp, parseCookie, montarAchados,
  analisarCors, fingerprintTech, detectarControles, analisarCorpo, resumirOpenApi,
  corpoReflete, locationApontaMarcador, avaliarAutorizacao,
  type InfoTlsScan, type TesteAtivo,
} from './scanEndpoint.js';

const semExtra = { cors: null, corpoSinais: [] as { id: string; descricao: string }[], testesAtivos: [] as TesteAtivo[] };

describe('scanner de endpoint — analisadores', () => {
  it('classifica métodos arriscados a partir do Allow', () => {
    expect(classificarMetodos('GET, POST, OPTIONS')).toEqual({ permitidos: ['GET', 'POST', 'OPTIONS'], arriscados: [] });
    expect(classificarMetodos('GET, PUT, delete, trace').arriscados).toEqual(['PUT', 'DELETE', 'TRACE']);
    expect(classificarMetodos(null)).toEqual({ permitidos: [], arriscados: [] });
  });

  it('classifica escopo interno x externo pelo IP', () => {
    expect(escopoDoIp('10.10.10.99')).toBe('interno');
    expect(escopoDoIp('192.168.1.1')).toBe('interno');
    expect(escopoDoIp('8.8.8.8')).toBe('externo');
    expect(escopoDoIp(null)).toBe('incerto');
    expect(escopoDoIp('nao-ip')).toBe('incerto');
  });

  it('lê flags de cookie', () => {
    expect(parseCookie('sid=abc; Path=/; Secure; HttpOnly; SameSite=Strict')).toEqual({ nome: 'sid', secure: true, httpOnly: true, sameSite: 'Strict' });
    expect(parseCookie('t=1; Path=/')).toEqual({ nome: 't', secure: false, httpOnly: false, sameSite: null });
  });

  it('analisa CORS: reflexo de origem e credenciais', () => {
    const probe = 'https://seginfo-probe.invalid';
    expect(analisarCors(probe, probe, 'true')).toMatchObject({ refleteOrigem: true, permiteCredenciais: true, curinga: false });
    expect(analisarCors(probe, '*', null)).toMatchObject({ curinga: true, refleteOrigem: false, permiteCredenciais: false });
    expect(analisarCors(probe, null, null)).toMatchObject({ acao: null, refleteOrigem: false });
  });

  it('faz fingerprint de tecnologia por cabeçalhos', () => {
    const t = fingerprintTech({ server: 'nginx/1.18.0', 'x-powered-by': 'Express', 'x-aspnet-version': '4.0.30319' });
    expect(t).toContain('nginx/1.18.0');
    expect(t).toContain('Express');
    expect(t.some((x) => x.includes('ASP.NET'))).toBe(true);
    expect(fingerprintTech({})).toEqual([]);
  });

  it('detecta visibilidade de rate-limit e cache', () => {
    expect(detectarControles({ 'x-ratelimit-limit': '100', 'cache-control': 'no-store' })).toEqual({ rateLimit: true, cacheControl: 'no-store', retryAfter: null });
    expect(detectarControles({})).toEqual({ rateLimit: false, cacheControl: null, retryAfter: null });
  });

  it('acha sinais de erro verboso no corpo', () => {
    expect(analisarCorpo('Traceback (most recent call last):\n  File "x"').some((s) => s.id === 'stack-python')).toBe(true);
    expect(analisarCorpo('You have an error in your SQL syntax near').some((s) => s.id === 'erro-sql')).toBe(true);
    expect(analisarCorpo('tudo certo, 200 OK')).toEqual([]);
  });

  it('resume uma spec OpenAPI', () => {
    const spec = { openapi: '3.0.0', info: { title: 'API X', version: '2.1' }, paths: { '/users': { get: {}, post: {} }, '/users/{id}': { get: {}, delete: {} } } };
    const r = resumirOpenApi('http://x/openapi.json', spec);
    expect(r).toMatchObject({ titulo: 'API X', versao: '2.1', rotas: 2, operacoes: 4 });
    expect(r?.amostra).toContain('GET /users');
    expect(resumirOpenApi('u', { foo: 1 })).toBeNull();
  });

  const tlsOk: InfoTlsScan = { protocolo: 'TLSv1.3', emissor: 'Lets Encrypt', validoAte: '2027-01-01', diasRestantes: 120, cadeiaConfiavel: true, erroCadeia: null };

  it('aponta certificado vencido e protocolo obsoleto', () => {
    const vencido = montarAchados({ status: 200, usaHttps: true, tls: { ...tlsOk, diasRestantes: -2 }, cabecalhos: [], metodos: null, cookies: [], exposicoes: [], servidor: null, poweredBy: null, ...semExtra });
    expect(vencido.some((a) => a.id === 'tls-vencido' && a.severidade === 'alta')).toBe(true);
    const velho = montarAchados({ status: 200, usaHttps: true, tls: { ...tlsOk, protocolo: 'TLSv1' }, cabecalhos: [], metodos: null, cookies: [], exposicoes: [], servidor: null, poweredBy: null, ...semExtra });
    expect(velho.some((a) => a.id === 'tls-protocolo')).toBe(true);
  });

  it('marca HTTP puro como achado alto', () => {
    const r = montarAchados({ status: 200, usaHttps: false, tls: null, cabecalhos: [], metodos: null, cookies: [], exposicoes: [], servidor: null, poweredBy: null, ...semExtra });
    expect(r.some((a) => a.id === 'sem-https' && a.severidade === 'alta')).toBe(true);
  });

  it('aponta CORS inseguro, cookie SameSite=None e erro no corpo como achados', () => {
    const probe = 'https://seginfo-probe.invalid';
    const r = montarAchados({
      status: 200, usaHttps: true, tls: tlsOk, cabecalhos: [], metodos: null,
      cookies: [{ nome: 'x', secure: false, httpOnly: true, sameSite: 'None' }],
      cors: analisarCors(probe, probe, 'true'),
      corpoSinais: [{ id: 'erro-sql', descricao: 'erro SQL' }],
      testesAtivos: [],
      exposicoes: [], servidor: null, poweredBy: null,
    });
    expect(r.some((a) => a.id === 'cors-credenciais' && a.severidade === 'alta')).toBe(true);
    expect(r.some((a) => a.id === 'cookie-ss-x' && a.severidade === 'media')).toBe(true);
    expect(r.some((a) => a.id === 'corpo-erro-sql')).toBe(true);
  });

  it('aponta exposição sensível acessível e cabeçalho ausente', () => {
    const r = montarAchados({
      status: 200, usaHttps: true, tls: tlsOk,
      cabecalhos: [{ id: 'csp', nome: 'Content-Security-Policy', presente: false }, { id: 'referrer', nome: 'Referrer-Policy', presente: true }],
      metodos: { arriscados: ['TRACE'] }, cookies: [{ nome: 's', secure: false, httpOnly: false, sameSite: null }],
      exposicoes: [{ caminho: '/.env', status: 200, acessivel: true, sensivel: true }, { caminho: '/robots.txt', status: 200, acessivel: true, sensivel: false }],
      servidor: 'nginx/1.18.0', poweredBy: 'Express', ...semExtra,
    });
    expect(r.some((a) => a.id === 'exp-/.env' && a.severidade === 'alta')).toBe(true);
    expect(r.some((a) => a.id === 'cab-csp' && a.severidade === 'media')).toBe(true);
    expect(r.some((a) => a.id === 'metodos')).toBe(true);
    expect(r.some((a) => a.id === 'cookie-s')).toBe(true);
    expect(r.some((a) => a.id === 'banner-server')).toBe(true);
    expect(r.some((a) => a.id === 'banner-powered')).toBe(true);
    expect(r.some((a) => a.id.includes('robots'))).toBe(false);
    expect(r[0].severidade).toBe('alta');
  });

  it('detecta reflexo do marcador no corpo', () => {
    expect(corpoReflete('<p>busca: sgfRefl0PROBE</p>', 'sgfRefl0PROBE')).toBe(true);
    expect(corpoReflete('<p>busca: &lt;codificado&gt;</p>', 'sgfRefl0PROBE')).toBe(false);
  });

  it('detecta Location apontando para o host-marcador (open redirect)', () => {
    const h = 'seginfo-redir-check.invalid';
    expect(locationApontaMarcador('https://seginfo-redir-check.invalid/or', h)).toBe(true);
    expect(locationApontaMarcador('//seginfo-redir-check.invalid/or', h)).toBe(true);
    expect(locationApontaMarcador('/pagina/local', h)).toBe(false);
    expect(locationApontaMarcador('https://site-legitimo.com/seginfo-redir-check.invalid', h)).toBe(false);
    expect(locationApontaMarcador(null, h)).toBe(false);
  });

  it('sinaliza autorização não forçada quando responde 2xx sem e com credencial', () => {
    expect(avaliarAutorizacao(200, 200).indicio).toBe(true);
    expect(avaliarAutorizacao(401, 200).indicio).toBe(false);
    expect(avaliarAutorizacao(200, 403).indicio).toBe(false);
  });

  it('testes ativos com indício viram achados; sem indício, não', () => {
    const ativos: TesteAtivo[] = [
      { tipo: 'open-redirect', parametro: 'next', indicio: true, detalhe: 'x' },
      { tipo: 'reflexo', parametro: 'q', indicio: true, detalhe: 'x' },
      { tipo: 'autorizacao', parametro: null, indicio: false, detalhe: 'x' },
    ];
    const r = montarAchados({ status: 200, usaHttps: true, tls: tlsOk, cabecalhos: [], metodos: null, cookies: [], cors: null, corpoSinais: [], exposicoes: [], testesAtivos: ativos, servidor: null, poweredBy: null });
    expect(r.some((a) => a.id === 'ativo-redirect-next')).toBe(true);
    expect(r.some((a) => a.id === 'ativo-reflexo-q')).toBe(true);
    expect(r.some((a) => a.id === 'ativo-autorizacao')).toBe(false);
  });
});
