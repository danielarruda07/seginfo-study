import { describe, expect, it } from 'vitest';
import {
  validarRepoUrl, validarBranch, severidadeSarif, extrairCwes, normalizarSarif, resumoDosAchados, sanearPatches,
} from './codescan.js';

describe('codescan — validação do repositório (segurança do git clone)', () => {
  it('aceita https e ssh do git', () => {
    expect(validarRepoUrl('https://github.com/dono/repo').ok).toBe(true);
    expect(validarRepoUrl('https://github.com/dono/repo.git').ok).toBe(true);
    expect(validarRepoUrl('git@github.com:dono/repo.git').ok).toBe(true);
    expect(validarRepoUrl('ssh://git@gitea.local:2222/dono/repo.git').ok).toBe(true);
  });

  it('recusa transportes e opções que executam comando', () => {
    expect(validarRepoUrl('ext::sh -c touch% /tmp/pwned').ok).toBe(false);
    expect(validarRepoUrl('fd::17').ok).toBe(false);
    expect(validarRepoUrl('--upload-pack=touch /tmp/x').ok).toBe(false);
    expect(validarRepoUrl('-uhttps://x').ok).toBe(false);
    expect(validarRepoUrl('file:///etc').ok).toBe(false);
    expect(validarRepoUrl('/home/repo').ok).toBe(false);
    expect(validarRepoUrl('http://github.com/dono/repo').ok).toBe(false); // sem TLS
    expect(validarRepoUrl('https://github.com/dono/repo x').ok).toBe(false);
    expect(validarRepoUrl('https://github.com/dono/repo\n--x').ok).toBe(false);
  });

  it('valida branch', () => {
    expect(validarBranch('feat/nova-tela')).toBe(true);
    expect(validarBranch('main')).toBe(true);
    expect(validarBranch('-x')).toBe(false);
    expect(validarBranch('a..b')).toBe(false);
    expect(validarBranch('a b')).toBe(false);
    expect(validarBranch('a;rm')).toBe(false);
  });
});

describe('codescan — SARIF', () => {
  it('severidade por security-severity (CVSS) e por level', () => {
    expect(severidadeSarif('9.8', 'warning')).toBe('critica');
    expect(severidadeSarif(7.5, undefined)).toBe('alta');
    expect(severidadeSarif('5.0', undefined)).toBe('media');
    expect(severidadeSarif('2', undefined)).toBe('baixa');
    expect(severidadeSarif(undefined, 'error')).toBe('alta');
    expect(severidadeSarif(undefined, 'note')).toBe('baixa');
    expect(severidadeSarif(undefined, undefined)).toBe('info');
  });

  it('extrai CWEs de vários formatos de tag', () => {
    expect(extrairCwes(['external/cwe/cwe-89', 'CWE-79', 'security', 'cwe:22'])).toEqual(['CWE-89', 'CWE-79', 'CWE-22']);
    expect(extrairCwes(undefined)).toEqual([]);
  });

  it('normaliza achados com regra, local, CWE e ordena por severidade', () => {
    const sarif = {
      version: '2.1.0',
      runs: [{
        tool: { driver: { name: 'claude-security', rules: [
          { id: 'sqli', shortDescription: { text: 'SQL injection' }, help: { text: 'Use queries parametrizadas.' }, properties: { tags: ['external/cwe/cwe-89'], 'security-severity': '8.8' } },
          { id: 'hdr', shortDescription: { text: 'Cabeçalho ausente' }, properties: { tags: ['CWE-693'] } },
        ] } },
        results: [
          { ruleId: 'hdr', level: 'note', message: { text: 'Falta CSP' } },
          { ruleId: 'sqli', ruleIndex: 0, level: 'error', message: { text: 'Concatenação na query' }, properties: { claudeSecurityPluginFindingId: 'F1' },
            locations: [{ physicalLocation: { artifactLocation: { uri: 'src/db.ts' }, region: { startLine: 42 } } }] },
        ],
      }],
    };
    const a = normalizarSarif(sarif);
    expect(a).toHaveLength(2);
    expect(a[0]).toMatchObject({ id: 'F1', titulo: 'SQL injection', severidade: 'alta', cwe: ['CWE-89'], arquivo: 'src/db.ts', linha: 42, recomendacao: 'Use queries parametrizadas.' });
    expect(a[1]).toMatchObject({ regra: 'hdr', severidade: 'baixa', arquivo: null });
    expect(resumoDosAchados(a)).toEqual({ critica: 0, alta: 1, media: 0, baixa: 1, info: 0 });
  });

  it('tolera documento inválido', () => {
    expect(normalizarSarif(null)).toEqual([]);
    expect(normalizarSarif({ runs: 'x' })).toEqual([]);
    expect(normalizarSarif({ runs: [{}] })).toEqual([]);
  });
});

describe('codescan — patches', () => {
  it('aceita só nome seguro e tamanho razoável', () => {
    const r = sanearPatches([
      { nome: 'F1.patch', conteudo: 'diff --git a b', nota: 'nota' },
      { nome: '../../etc/passwd.patch', conteudo: 'x' },
      { nome: 'F2.patch', conteudo: 'y'.repeat(300_000) },
      { nome: 'F3.txt', conteudo: 'z' },
    ]);
    expect(r.map((p) => p.nome)).toEqual(['F1.patch']);
    expect(sanearPatches('x')).toEqual([]);
  });
});
