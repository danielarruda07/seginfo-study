import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultBlob } from '@seginfo/shared';

// O servidor é simulado: guarda o último blob e devolve uma data nova a cada gravação.
const servidor = vi.hoisted(() => ({
  blob: null as VaultBlob | null,
  gravacoes: [] as Array<string | null | undefined>,
  falhar: null as Error | null,
}));
vi.mock('./cofre2fa', () => ({
  cofre2fa: {
    gravarBlob: vi.fn(async (blob: VaultBlob, base: string | null | undefined) => {
      if (servidor.falhar) throw servidor.falhar;
      servidor.gravacoes.push(base);
      servidor.blob = blob;
      return `v${servidor.gravacoes.length}`;
    }),
  },
}));

import * as vault from './vault';
import { NS } from './store';

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

const SENHA = 'frase longa de teste do cofre';
const credencial = { titulo: 'FortiGate', usuario: 'admin', url: '', notas: '', secret: 's3gr3d0' };

describe('Cofre no modo servidor (segundo fator ativo)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage());
    servidor.blob = null;
    servidor.gravacoes = [];
    servidor.falhar = null;
  });
  afterEach(() => {
    vault.lock();
    vi.unstubAllGlobals();
  });

  it('ativação: leva o blob, liga o modo servidor e não deixa cópia no navegador', async () => {
    await vault.initVault(SENHA);
    await vault.saveEntry(credencial);
    expect(vault.temCopiaLocal()).toBe(true);

    servidor.blob = await vault.blobAtual(); // o servidor guarda isto na própria ativação
    vault.concluirMigracao('v0');

    expect(vault.modoServidor()).toBe(true);
    expect(vault.temCopiaLocal()).toBe(false);
    expect(localStorage.getItem(`${NS}vault:blob`)).toBeNull();
    expect(vault.isInitialized()).toBe(true);
  });

  it('grava no servidor com a versão carregada e nunca no localStorage', async () => {
    await vault.initVault(SENHA);
    servidor.blob = await vault.blobAtual();
    vault.concluirMigracao('v0');

    await vault.saveEntry(credencial);
    await vault.saveEntry({ ...credencial, titulo: 'Proxmox' });

    expect(servidor.gravacoes).toEqual(['v0', 'v1']); // cada PUT leva a versão anterior (detecção de conflito)
    expect(vault.temCopiaLocal()).toBe(false);
  });

  it('abre em outro aparelho só com o blob do servidor e a senha-mestra', async () => {
    await vault.initVault(SENHA);
    await vault.saveEntry(credencial);
    const blob = await vault.blobAtual();
    vault.lock();
    vi.stubGlobal('localStorage', mockStorage()); // aparelho novo: nada local

    expect(await vault.unlockServidor('senha errada qualquer', { ...blob, atualizadoEm: 'v9' })).toBe(false);
    expect(await vault.unlockServidor(SENHA, { ...blob, atualizadoEm: 'v9' })).toBe(true);
    expect(vault.listEntries().map((e) => e.titulo)).toEqual(['FortiGate']);
    expect(vault.getSecret(vault.listEntries()[0].id)).toBe('s3gr3d0');
    expect(await vault.unlockServidor(SENHA, null)).toBe(false);
  });

  it('se o servidor recusar a gravação, desfaz a mudança na memória', async () => {
    await vault.initVault(SENHA);
    await vault.saveEntry(credencial);
    servidor.blob = await vault.blobAtual();
    vault.concluirMigracao('v0');

    servidor.falhar = new Error('sessão expirada');
    await expect(vault.saveEntry({ ...credencial, titulo: 'Novo' })).rejects.toThrow('sessão expirada');
    await expect(vault.removeEntry(vault.listEntries()[0].id)).rejects.toThrow();
    await expect(vault.importEntries(JSON.stringify([{ titulo: 'Importado', secret: 'x' }]))).rejects.toThrow();
    expect(vault.listEntries().map((e) => e.titulo)).toEqual(['FortiGate']);
  });

  it('importação grava uma vez só', async () => {
    await vault.initVault(SENHA);
    servidor.blob = await vault.blobAtual();
    vault.concluirMigracao('v0');

    const r = await vault.importEntries(JSON.stringify([
      { titulo: 'A', secret: '1' }, { titulo: 'B', secret: '2' }, { titulo: 'C', secret: '3' },
    ]));
    expect(r).toEqual({ novas: 3, atualizadas: 0 });
    expect(servidor.gravacoes).toHaveLength(1);
  });

  it('desligar o 2FA devolve o cofre ao navegador', async () => {
    await vault.initVault(SENHA);
    await vault.saveEntry(credencial);
    servidor.blob = await vault.blobAtual();
    vault.concluirMigracao('v0');

    await vault.voltarParaLocal();
    expect(vault.modoServidor()).toBe(false);
    expect(vault.temCopiaLocal()).toBe(true);
    vault.lock();
    expect(await vault.unlock(SENHA)).toBe(true);
    expect(vault.listEntries()).toHaveLength(1);
  });
});
