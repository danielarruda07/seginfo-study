import { describe, expect, it } from 'vitest';
import type { BackupItem, StorageStatus } from '@/services/armazenamento';
import { fmtData, fmtTam, resumoBackups, situacaoNaRetencao, tomStatus } from './regras';

const b = (id: string, criadoEm: string, status: 'ok' | 'erro' = 'ok', tamanhoBytes = 1_048_576): BackupItem => ({
  id, nomeArquivo: `seginfo-${id}.age`, tamanhoBytes, status, erro: status === 'erro' ? 'falhou' : null, criadoEm,
});
const backups = [b('a', '2026-11-10T03:00:00Z'), b('b', '2026-11-12T03:00:00Z'), b('c', '2026-11-11T03:00:00Z', 'erro'), b('d', '2026-11-09T03:00:00Z')];

describe('formatos', () => {
  it('data e tamanho', () => {
    expect(fmtData('2026-11-12T03:04:05Z')).toBe('2026-11-12 03:04 UTC');
    expect(fmtData(null)).toBe('—');
    expect(fmtTam(10)).toBe('1 KB');
    expect(fmtTam(2_621_440)).toBe('2.5 MB');
    expect(fmtTam(2_147_483_648)).toBe('2.0 GB');
  });
});

describe('tomStatus', () => {
  const base: StorageStatus = { configurado: true, faltando: [], conectado: true, contaNome: 'x', conectadoEm: null, ultimoBackupEm: '2026-11-12', ultimoErro: null, automatico: true, retencao: 14, backups: [] };
  it('classifica configuração, conexão, erro e sucesso', () => {
    expect(tomStatus(undefined)).toBe('ok');
    expect(tomStatus({ ...base, configurado: false })).toBe('warn');
    expect(tomStatus({ ...base, conectado: false })).toBe('warn');
    expect(tomStatus({ ...base, ultimoErro: 'x' })).toBe('crit');
    expect(tomStatus(base)).toBe('ok');
    expect(tomStatus({ ...base, ultimoBackupEm: null })).toBe('warn');
  });
});

describe('resumoBackups', () => {
  it('conta enviados e falhas e soma o uso só dentro da retenção', () => {
    const r = resumoBackups(backups, 2);
    expect(r.enviados).toBe(3);
    expect(r.falhas).toBe(1);
    expect(r.usoBytes).toBe(2 * 1_048_576);
    expect(r.ultimoOk?.id).toBe('b');
    expect(r.ultimaFalha?.id).toBe('c');
  });
});

describe('situacaoNaRetencao', () => {
  it('explica se o backup ainda está no OneDrive', () => {
    expect(situacaoNaRetencao(backups, 'b', 2)).toMatch(/mais recente/);
    expect(situacaoNaRetencao(backups, 'a', 2)).toMatch(/2º.*ainda está/);
    expect(situacaoNaRetencao(backups, 'd', 2)).toMatch(/passou da retenção/);
    expect(situacaoNaRetencao(backups, 'c', 2)).toMatch(/Não foi enviado/);
    expect(situacaoNaRetencao(backups, 'zzz', 2)).toBe('');
  });
});
