import { describe, expect, it } from 'vitest';
import type { Ativo } from '@seginfo/shared';
import { camposAlterados, mesclar, planejarSincronizacao } from './sincronizacao';

const ativo = (p: Partial<Ativo>): Ativo => ({
  id: 'x', ambiente: 'criecomia', tipo: 'vm', nome: 'x', endereco: '', funcao: '', estado: 'ativo',
  detalhes: {}, tags: [], labsRelacionados: [], ...p,
});

describe('sincronização do inventário', () => {
  it('a varredura atualiza nome, endereço e estado, mas preserva o que foi escrito à mão', () => {
    const meu = ativo({ id: 'lab-vm-100', nome: 'app (VMID 100)', endereco: '192.0.2.10', funcao: 'Hospeda o app', criticidade: 'critica', exposicao: 'interna', labsRelacionados: ['lab-1'], tags: ['meu'], detalhes: { nota: 'minha anotação' } });
    const visto = ativo({ id: 'lab-vm-100', nome: 'app (VMID 100)', endereco: '192.0.2.99', funcao: 'Máquina virtual', estado: 'desativado', tags: ['sincronizado', 'proxmox'], detalhes: { 'nó': 'pm01' }, confirmadoEm: '2026-11-14' });
    const m = mesclar(meu, visto);
    expect(m).toMatchObject({ endereco: '192.0.2.99', estado: 'desativado', funcao: 'Hospeda o app', criticidade: 'critica', exposicao: 'interna', labsRelacionados: ['lab-1'], confirmadoEm: '2026-11-14' });
    expect(m.tags.sort()).toEqual(['meu', 'proxmox', 'sincronizado']);
    expect(m.detalhes).toEqual({ nota: 'minha anotação', 'nó': 'pm01' });
    expect(camposAlterados(meu, m)).toEqual(['endereço', 'estado', 'detalhes', 'tags']);
  });

  it('função vazia é preenchida pela varredura', () => {
    expect(mesclar(ativo({ funcao: '  ' }), ativo({ funcao: 'Nó do cluster Proxmox' })).funcao).toBe('Nó do cluster Proxmox');
  });

  it('separa novos, atualizados e sem mudança; nada é apagado', () => {
    const existentes = [
      ativo({ id: 'a', nome: 'A', tags: ['sincronizado'] }),
      ativo({ id: 'b', nome: 'B', tags: ['sincronizado'], confirmadoEm: '2026-11-01' }),
      ativo({ id: 'manual', nome: 'Criado por mim' }),
      ativo({ id: 'sumiu', nome: 'Celular antigo', tags: ['descoberta-rede'] }),
    ];
    const descobertos = [
      ativo({ id: 'a', nome: 'A renomeada', tags: ['sincronizado'] }),
      ativo({ id: 'b', nome: 'B', tags: ['sincronizado'], confirmadoEm: '2026-11-14' }),
      ativo({ id: 'c', nome: 'Novo' }),
    ];
    const p = planejarSincronizacao(existentes, descobertos, true);
    expect(p.novos.map((a) => a.id)).toEqual(['c']);
    expect(p.atualizados.map((u) => [u.antes.id, u.campos])).toEqual([['a', ['nome']]]);
    expect(p.iguais.map((a) => a.id)).toEqual(['b']);
    expect(p.naoVistos.map((a) => a.id)).toEqual(['sumiu']); // o criado à mão não entra
    expect(p.resultado.map((a) => a.id)).toEqual(['a', 'b', 'manual', 'sumiu', 'c']);
    expect(p.resultado.find((a) => a.id === 'b')?.confirmadoEm).toBe('2026-11-14');
  });

  it('com fonte em erro, não aponta "não vistos" (pareceria que tudo sumiu)', () => {
    const p = planejarSincronizacao([ativo({ id: 'sumiu', tags: ['sincronizado'] })], [], false);
    expect(p.naoVistos).toEqual([]);
  });
});
