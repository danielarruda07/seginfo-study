import { describe, expect, it } from 'vitest';
import type { FerramentaCatalogo, Lab, RangeAlvo } from '@seginfo/shared';
import { passaFiltroUso, resumirFerramenta } from './resumo';

const nmap: FerramentaCatalogo = { id: 'nmap', nome: 'Nmap', fase: 'varredura', dominio: 'red', descricao: '', kali: true };
const lab: Lab = { id: 'l', titulo: 'Recon', objetivo: '', dominio: 'red', nivel: 'basico', ativosAlvo: [], passos: ['rodar nmap'], resultadoEsperado: '' };
const alvo: RangeAlvo = { id: 'k', nome: 'Kali', dominio: 'red', categoria: 'vm_atacante', descricao: '', portas: [], ferramentas: ['nmap'] };

describe('resumo da ferramenta', () => {
  it('conta registros, pendências, labs e alvos', () => {
    const r = resumirFerramenta(nmap, [
      { ferramentaId: 'nmap', tipo: 'teste' }, { ferramentaId: 'nmap', tipo: 'pendencia' }, { ferramentaId: 'outra', tipo: 'pendencia' },
    ], [lab], [alvo]);
    expect(r).toEqual({ registros: 2, pendencias: 1, labs: 1, alvos: 1 });
  });

  it('filtra por uso', () => {
    const vazio = { registros: 0, pendencias: 0, labs: 0, alvos: 0 };
    expect(passaFiltroUso(nmap, vazio, undefined)).toBe(true);
    expect(passaFiltroUso(nmap, vazio, 'kali')).toBe(true);
    expect(passaFiltroUso(nmap, vazio, 'registro')).toBe(false);
    expect(passaFiltroUso(nmap, { ...vazio, pendencias: 1 }, 'pendencia')).toBe(true);
    expect(passaFiltroUso(nmap, { ...vazio, alvos: 2 }, 'range')).toBe(true);
  });
});
