import { describe, expect, it } from 'vitest';
import { classificarMetodos, escopoDoIp, parseCookie, montarAchados, type InfoTlsScan } from './scanEndpoint.js';

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

  const tlsOk: InfoTlsScan = { protocolo: 'TLSv1.3', emissor: 'Lets Encrypt', validoAte: '2027-01-01', diasRestantes: 120, cadeiaConfiavel: true, erroCadeia: null };

  it('aponta certificado vencido e protocolo obsoleto', () => {
    const vencido = montarAchados({ status: 200, usaHttps: true, tls: { ...tlsOk, diasRestantes: -2 }, cabecalhos: [], metodos: null, cookies: [], exposicoes: [], servidor: null, poweredBy: null });
    expect(vencido.some((a) => a.id === 'tls-vencido' && a.severidade === 'alta')).toBe(true);
    const velho = montarAchados({ status: 200, usaHttps: true, tls: { ...tlsOk, protocolo: 'TLSv1' }, cabecalhos: [], metodos: null, cookies: [], exposicoes: [], servidor: null, poweredBy: null });
    expect(velho.some((a) => a.id === 'tls-protocolo')).toBe(true);
  });

  it('marca HTTP puro como achado alto', () => {
    const r = montarAchados({ status: 200, usaHttps: false, tls: null, cabecalhos: [], metodos: null, cookies: [], exposicoes: [], servidor: null, poweredBy: null });
    expect(r.some((a) => a.id === 'sem-https' && a.severidade === 'alta')).toBe(true);
  });

  it('aponta exposição sensível acessível e cabeçalho ausente', () => {
    const r = montarAchados({
      status: 200, usaHttps: true, tls: tlsOk,
      cabecalhos: [{ id: 'csp', nome: 'Content-Security-Policy', presente: false }, { id: 'referrer', nome: 'Referrer-Policy', presente: true }],
      metodos: { arriscados: ['TRACE'] }, cookies: [{ nome: 's', secure: false, httpOnly: false }],
      exposicoes: [{ caminho: '/.env', status: 200, acessivel: true, sensivel: true }, { caminho: '/robots.txt', status: 200, acessivel: true, sensivel: false }],
      servidor: 'nginx/1.18.0', poweredBy: 'Express',
    });
    expect(r.some((a) => a.id === 'exp-/.env' && a.severidade === 'alta')).toBe(true);
    expect(r.some((a) => a.id === 'cab-csp' && a.severidade === 'media')).toBe(true);
    expect(r.some((a) => a.id === 'metodos')).toBe(true);
    expect(r.some((a) => a.id === 'cookie-s')).toBe(true);
    expect(r.some((a) => a.id === 'banner-server')).toBe(true);
    expect(r.some((a) => a.id === 'banner-powered')).toBe(true);
    // robots.txt (não sensível) não vira achado
    expect(r.some((a) => a.id.includes('robots'))).toBe(false);
    // ordenação: altos primeiro
    expect(r[0].severidade).toBe('alta');
  });
});
