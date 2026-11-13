import { afterEach, describe, expect, it, vi } from 'vitest';
import { listarIntegracoes } from './integracoes.js';

const SEGREDOS = {
  PROXMOX_TOKEN: 'root@pam!agent=12345678-1234-1234-1234-1234567890ab',
  PROXMOX_CA_B64: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCg==',
  FORTIGATE_TOKEN: 'fgt-segredo-muito-secreto',
  CATALYST_PASSWORD: 'senha-do-switch',
  ANTHROPIC_API_KEY: 'sk-ant-api03-segredo',
};

afterEach(() => vi.unstubAllEnvs());

describe('listarIntegracoes', () => {
  it('mostra endereço, identidade e TLS sem nunca devolver segredo', () => {
    for (const [k, v] of Object.entries(SEGREDOS)) vi.stubEnv(k, v);
    vi.stubEnv('PROXMOX_URL', 'https://10.0.0.5:8006/');
    vi.stubEnv('PROXMOX_TLS_INSEGURO', 'true');
    vi.stubEnv('FORTIGATE_URL', 'https://10.0.0.1');
    vi.stubEnv('CATALYST_HOST', '10.0.0.2');
    vi.stubEnv('CATALYST_USER', 'agente');

    const lista = listarIntegracoes();
    const json = JSON.stringify(lista);
    for (const segredo of Object.values(SEGREDOS)) expect(json).not.toContain(segredo);
    expect(json).not.toContain('12345678-1234');

    const proxmox = lista.find((i) => i.id === 'proxmox');
    expect(proxmox).toMatchObject({ configurada: true, endereco: '10.0.0.5:8006', identidade: 'root@pam!agent' });
    expect(proxmox?.tls).toContain('Sem verificação');
    expect(lista.find((i) => i.id === 'fortigate')).toMatchObject({ configurada: true, endereco: '10.0.0.1:443' });
    expect(lista.find((i) => i.id === 'catalyst')).toMatchObject({ configurada: true, endereco: '10.0.0.2:22', identidade: 'agente (senha)' });
  });

  it('aponta o que falta quando nada está configurado', () => {
    for (const k of ['PROXMOX_URL', 'PROXMOX_TOKEN', 'FORTIGATE_URL', 'FORTIGATE_TOKEN', 'CATALYST_HOST', 'CATALYST_USER', 'CATALYST_PASSWORD', 'CATALYST_PRIVATE_KEY_B64', 'ANTHROPIC_API_KEY']) vi.stubEnv(k, '');
    const lista = listarIntegracoes();
    expect(lista.every((i) => !i.configurada)).toBe(true);
    expect(lista.find((i) => i.id === 'proxmox')?.faltando).toEqual(['PROXMOX_URL', 'PROXMOX_TOKEN']);
  });
});
