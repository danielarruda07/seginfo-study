import { describe, expect, it, vi } from 'vitest';
import { analisarEmail, ipNaoPublico, normalizarDominio, resumirCertificados, resumirInternetDb } from './osint.js';

vi.mock('./memorias.js', () => ({ buscarNaBase: async () => [] }));
const { REGISTRO } = await import('./agenteFerramentas.js');

const porNome = (nome: string) => REGISTRO.find((f) => f.nome === nome)!;

describe('OSINT passivo', () => {
  it('normaliza domínios e recusa o que não é domínio', () => {
    expect(normalizarDominio(' Exemplo.COM.br. ')).toBe('exemplo.com.br');
    expect(normalizarDominio('*.exemplo.com')).toBe('exemplo.com');
    expect(normalizarDominio('xn--exmplo-qta.com')).toBe('xn--exmplo-qta.com');
    for (const ruim of ['exemplo', 'http://exemplo.com', 'exemplo.com/x', '-a.com', 'a..com', '10.0.0.1/..']) {
      expect(normalizarDominio(ruim)).toBeNull();
    }
  });

  it('separa IP público de privado, reservado e CGNAT', () => {
    for (const p of ['10.1.2.3', '172.20.0.1', '192.168.0.10', '127.0.0.1', '169.254.1.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', 'lixo']) {
      expect(ipNaoPublico(p)).toBe(true);
    }
    for (const p of ['8.8.8.8', '172.32.0.1', '2606:4700::1111']) expect(ipNaoPublico(p)).toBe(false);
  });

  it('resume o crt.sh por subdomínio, ignorando nomes de outros domínios no mesmo certificado', () => {
    const r = resumirCertificados('exemplo.com', [
      { name_value: 'exemplo.com\nwww.exemplo.com', issuer_name: 'C=US, O=Let\'s Encrypt, CN=R11', not_before: '2026-01-10T00:00:00', not_after: '2026-04-10T00:00:00' },
      { name_value: 'vpn.exemplo.com\noutro.net', issuer_name: 'C=US, O=Let\'s Encrypt, CN=R10', not_before: '2026-11-01T00:00:00' },
      { name_value: '*.exemplo.com', common_name: 'www.exemplo.com', issuer_name: 'C=US, O="Google Trust Services", CN=WE1', not_before: '2026-06-01T00:00:00' },
    ]);
    expect(r.certificados).toBe(3);
    expect(r.nomes.map((n) => n.nome)).toEqual(['vpn.exemplo.com', 'exemplo.com', 'www.exemplo.com']);
    expect(r.nomes.find((n) => n.nome === 'www.exemplo.com')).toMatchObject({ certificados: 2, primeiro: '2026-01-10', ultimo: '2026-06-01' });
    expect(r.nomes.find((n) => n.nome === 'exemplo.com')?.curinga).toBe(true);
    expect(r.emissores[0]).toEqual({ nome: "Let's Encrypt", total: 2 });
    expect(r.recentes[0].emitidoEm).toBe('2026-11-01');
  });

  it('InternetDB: 404 quer dizer que nada foi visto; 200 vira portas, softwares e CVEs', () => {
    expect(resumirInternetDb('203.0.113.9', 404, { detail: 'No information available' })).toMatchObject({ encontrado: false });
    const r = resumirInternetDb('203.0.113.9', 200, { ports: [22, 443], cpes: ['cpe:/a:openbsd:openssh:8.9'], hostnames: [], tags: ['self-signed'], vulns: ['CVE-2023-38408'] });
    expect(r).toMatchObject({ encontrado: true, portas: [22, 443], tags: ['self-signed'], vulnerabilidades: ['CVE-2023-38408'] });
    expect(() => resumirInternetDb('203.0.113.9', 429, null)).toThrow(/429/);
  });

  it('aponta SPF ausente, SPF duplicado, +all e DMARC fraco', () => {
    expect(analisarEmail([], [], true).avisos.join(' ')).toMatch(/MX.*SPF/);
    expect(analisarEmail(['v=spf1 -all', 'v=spf1 include:x -all'], ['v=DMARC1; p=reject'], false).avisos.join(' ')).toMatch(/Mais de um/);
    expect(analisarEmail(['v=spf1 +all'], ['v=DMARC1; p=none'], false).avisos.join(' ')).toMatch(/\+all.*p=none/s);
    const bom = analisarEmail(['v=spf1 include:_spf.google.com -all'], ['v=DMARC1; p=reject; rua=mailto:x@y'], true);
    expect(bom).toMatchObject({ politicaDmarc: 'reject', avisos: [] });
  });

  it('as ferramentas são leitura, validam a entrada e rodam sem aprovação', () => {
    for (const nome of ['osint_certificados', 'osint_exposicao_ip', 'osint_dns']) {
      const f = porNome(nome);
      expect(f).toMatchObject({ id: 'osint-passivo', permissao: 'leitura', nivel: 'leve' });
      expect(f.faltando).toBeUndefined();
    }
    expect(porNome('osint_dns').resumir({ dominio: 'Exemplo.com' })).toBe('osint_dns');
    expect(() => porNome('osint_certificados').resumir({ dominio: 'https://exemplo.com/../x' })).toThrow(/domínio inválido/);
    expect(() => porNome('osint_exposicao_ip').resumir({ alvo: '8.8.8.8/../admin' })).toThrow(/Entrada inválida/);
    expect(porNome('osint_exposicao_ip').resumir({})).toBe('osint_exposicao_ip');
  });
});
