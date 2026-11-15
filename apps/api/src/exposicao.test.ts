import { describe, expect, it, vi } from 'vitest';

vi.mock('./db.js', () => ({ prisma: {} }));
const { compararExposicao, resumoDoResultado, validarAlvo } = await import('./exposicao.js');
type R = Parameters<typeof compararExposicao>[1];

const base = (p: Partial<R> = {}): R => ({ tipo: 'dominio', valor: 'exemplo.com', certificados: null, dns: null, ip: null, erros: [], ...p });
const cert = (nomes: string[], omitidos = 0) => ({
  dominio: 'exemplo.com', certificados: nomes.length, subdominios: nomes.length, nomesOmitidos: omitidos, emissores: [], recentes: [], observacao: '',
  nomes: nomes.map((nome) => ({ nome, primeiro: '2026-01-01', ultimo: '2026-01-01', certificados: 1, curinga: false })),
}) as unknown as R['certificados'];
const ip = (itens: { ip: string; portas?: number[]; vulnerabilidades?: string[] }[]) =>
  ({ origem: 'teste', resultados: itens.map((i) => ({ encontrado: true, ...i })) }) as unknown as R['ip'];
const dns = (p: { a?: string[]; mx?: string[]; avisos?: string[] } = {}) =>
  ({ dominio: 'exemplo.com', existe: true, a: p.a ?? [], aaaa: [], cname: [], mx: p.mx ?? [], ns: ['ns1'], txt: [], caa: [], email: {}, avisos: p.avisos ?? [], observacao: '' }) as unknown as R['dns'];

describe('compararExposicao', () => {
  it('primeira varredura não gera mudança', () => {
    expect(compararExposicao(null, base({ certificados: cert(['a.exemplo.com']) }))).toEqual([]);
  });

  it('subdomínio novo é médio; sumir é info, mas não quando a lista do crt.sh foi cortada', () => {
    const m = compararExposicao(base({ certificados: cert(['a.exemplo.com', 'b.exemplo.com']) }), base({ certificados: cert(['a.exemplo.com', 'vpn.exemplo.com']) }));
    expect(m.map((x) => [x.tipo, x.severidade])).toEqual([['subdominio-novo', 'media'], ['subdominio-sumiu', 'info']]);
    expect(m[0].texto).toContain('vpn.exemplo.com');
    const cortado = compararExposicao(base({ certificados: cert(['a.exemplo.com', 'b.exemplo.com'], 10) }), base({ certificados: cert(['a.exemplo.com']) }));
    expect(cortado).toEqual([]);
  });

  it('porta aberta e CVE nova são alta, ordenadas antes do resto', () => {
    const antes = base({ ip: ip([{ ip: '203.0.113.5', portas: [443], vulnerabilidades: ['CVE-2020-1'] }]), dns: dns() });
    const agora = base({ ip: ip([{ ip: '203.0.113.5', portas: [22, 443], vulnerabilidades: ['CVE-2024-9'] }]), dns: dns({ avisos: ['Sem CAA'] }) });
    const m = compararExposicao(antes, agora);
    expect(m.map((x) => x.tipo)).toEqual(['porta-aberta', 'cve-nova', 'aviso-dns-novo', 'cve-resolvida']);
    expect(m[0].texto).toContain('22');
  });

  it('IP público que muda: avisa a troca e continua comparando as portas', () => {
    const antes = base({ tipo: 'ip-publico', valor: '', ip: ip([{ ip: '203.0.113.5', portas: [80] }]) });
    const agora = base({ tipo: 'ip-publico', valor: '', ip: ip([{ ip: '198.51.100.7', portas: [] }]) });
    expect(compararExposicao(antes, agora).map((x) => x.tipo)).toEqual(['ip-publico', 'porta-fechada']);
  });

  it('registro DNS alterado e aviso resolvido', () => {
    const m = compararExposicao(base({ dns: dns({ a: ['203.0.113.5'], avisos: ['Sem DMARC'] }) }), base({ dns: dns({ a: ['198.51.100.7'] }) }));
    expect(m.map((x) => x.tipo)).toEqual(['dns-registro', 'aviso-dns-resolvido']);
    expect(m[0].texto).toMatch(/Registro A mudou/);
  });

  it('fonte que falhou numa das varreduras não vira mudança', () => {
    const antes = base({ certificados: cert(['a.exemplo.com']), ip: ip([{ ip: '203.0.113.5', portas: [443] }]) });
    const agora = base({ erros: [{ fonte: 'certificados', mensagem: 'timeout' }, { fonte: 'ip', mensagem: 'timeout' }] });
    expect(compararExposicao(antes, agora)).toEqual([]);
  });
});

describe('resumo e validação', () => {
  it('resume portas, subdomínios, CVEs e avisos', () => {
    const r = resumoDoResultado(base({ certificados: cert(['a.exemplo.com']), dns: dns({ avisos: ['x', 'y'] }), ip: ip([{ ip: '203.0.113.5', portas: [22, 443], vulnerabilidades: ['CVE-1'] }]) }));
    expect(r).toEqual({ portas: 2, subdominios: 1, cves: 1, avisosDns: 2, ips: ['203.0.113.5'] });
    expect(resumoDoResultado(base()).subdominios).toBeNull();
  });

  it('valida domínio, IP público e recusa IP privado', () => {
    expect(validarAlvo('dominio', 'Exemplo.COM.')).toEqual({ valor: 'exemplo.com' });
    expect(validarAlvo('dominio', 'http://x')).toHaveProperty('erro');
    expect(validarAlvo('ip', '192.168.0.1')).toHaveProperty('erro');
    expect(validarAlvo('ip', '8.8.8.8')).toEqual({ valor: '8.8.8.8' });
    expect(validarAlvo('ip-publico', 'ignorado')).toEqual({ valor: '' });
  });
});
