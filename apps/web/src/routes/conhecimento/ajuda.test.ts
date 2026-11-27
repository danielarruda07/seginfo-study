import { describe, expect, it } from 'vitest';
import { COMANDOS, COMO_USAR_POR_ROTA, FERRAMENTAS, FRENTES, ROTEIROS, filtrarFerramentas } from './ajuda';
import { NAV_SECTIONS } from '@/components/shell/nav';

const temControle = (s: string) => [...s].some((ch) => { const n = ch.charCodeAt(0); return n < 32 && n !== 10; });

describe('ajuda', () => {
  it('ids únicos e toda ferramenta tem rota ou comando', () => {
    const ids = FERRAMENTAS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FERRAMENTAS) expect(Boolean(f.to || f.comando), f.id).toBe(true);
  });

  it('toda rota citada existe no menu', () => {
    const rotas = new Set(NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.to)));
    for (const f of FERRAMENTAS) if (f.to) expect(rotas.has(f.to), f.to).toBe(true);
  });

  it('toda frente tem ferramenta e todo roteiro aponta para ferramentas que existem', () => {
    for (const fr of FRENTES) expect(FERRAMENTAS.some((f) => f.frente === fr.id), fr.id).toBe(true);
    const ids = new Set(FERRAMENTAS.map((f) => f.id));
    for (const r of ROTEIROS) for (const p of r.passos) if (p.ferramenta) expect(ids.has(p.ferramenta), p.ferramenta).toBe(true);
  });

  it('a busca ignora acento e caixa', () => {
    expect(filtrarFerramentas('REVISAO').map((f) => f.id)).toContain('revisao');
    expect(filtrarFerramentas('injecao').length).toBeGreaterThan(0);
    expect(filtrarFerramentas('')).toHaveLength(FERRAMENTAS.length);
    expect(filtrarFerramentas('zzzz')).toEqual([]);
  });

  it('comandos e "como usar" apontam para ferramentas e rotas que existem, sem caractere de controle', () => {
    const ids = new Set(FERRAMENTAS.map((f) => f.id));
    const rotas = new Set(NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.to)));
    for (const id of Object.keys(COMANDOS)) expect(ids.has(id), id).toBe(true);
    for (const [rota, lista] of Object.entries(COMO_USAR_POR_ROTA)) {
      expect(rotas.has(rota), rota).toBe(true);
      for (const id of lista) expect(ids.has(id), id).toBe(true);
    }
    for (const c of Object.values(COMANDOS).flat()) expect(temControle(c.codigo), c.rotulo).toBe(false);
    for (const f of FERRAMENTAS) expect(temControle([f.resumo, f.comando ?? '', ...f.passos].join(' ')), f.id).toBe(false);
    expect(COMANDOS.local[0].codigo).toContain('C:' + String.fromCharCode(92) + 'temp' + String.fromCharCode(92) + 'criptobrokers');
  });
});
