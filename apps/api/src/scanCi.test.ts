import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { avaliarGate, resolverLimites, verificarAssinatura, contarSeveridade, LIMITES_PADRAO } from './scanCi.js';
import type { Severidade } from './scanEndpoint.js';

const achados = (sev: Severidade[]) => sev.map((severidade) => ({ severidade }));

describe('gate de CI — contagem e veredito', () => {
  it('conta por severidade', () => {
    expect(contarSeveridade(achados(['alta', 'alta', 'media', 'info']))).toEqual({ alta: 2, media: 1, baixa: 0, info: 1 });
  });

  it('reprova quando há achado alto no limite padrão', () => {
    const g = avaliarGate(contarSeveridade(achados(['alta'])), LIMITES_PADRAO);
    expect(g.passou).toBe(false);
    expect(g.motivos[0]).toMatch(/alto/);
  });

  it('passa quando só há médios/baixos no limite padrão', () => {
    expect(avaliarGate(contarSeveridade(achados(['media', 'baixa', 'info'])), LIMITES_PADRAO).passou).toBe(true);
  });

  it('respeita limites customizados', () => {
    const contagem = contarSeveridade(achados(['media', 'media', 'media']));
    expect(avaliarGate(contagem, resolverLimites({ media: 2 })).passou).toBe(false);
    expect(avaliarGate(contagem, resolverLimites({ media: 3 })).passou).toBe(true);
  });

  it('resolverLimites usa o padrão nos campos ausentes', () => {
    expect(resolverLimites(undefined)).toEqual(LIMITES_PADRAO);
    expect(resolverLimites({ alta: 2 })).toEqual({ alta: 2, media: Infinity, baixa: Infinity });
  });
});

describe('gate de CI — assinatura HMAC', () => {
  const secret = 'segredo-de-teste';
  const corpoCru = JSON.stringify({ url: 'https://api.exemplo.com' });
  const agora = 1_700_000_000_000; // ms
  const ts = String(Math.floor(agora / 1000));
  const assinar = (t: string, corpo: string, s = secret) => 'sha256=' + createHmac('sha256', s).update(`${t}.${corpo}`).digest('hex');

  it('aceita assinatura correta dentro da janela', () => {
    expect(verificarAssinatura({ secret, timestamp: ts, corpoCru, assinatura: assinar(ts, corpoCru), agora }).ok).toBe(true);
  });

  it('rejeita assinatura de segredo errado', () => {
    const r = verificarAssinatura({ secret, timestamp: ts, corpoCru, assinatura: assinar(ts, corpoCru, 'outro'), agora });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/confere/);
  });

  it('rejeita corpo adulterado', () => {
    const r = verificarAssinatura({ secret, timestamp: ts, corpoCru: corpoCru + ' ', assinatura: assinar(ts, corpoCru), agora });
    expect(r.ok).toBe(false);
  });

  it('rejeita timestamp fora da janela (replay)', () => {
    const velho = String(Math.floor(agora / 1000) - 600);
    const r = verificarAssinatura({ secret, timestamp: velho, corpoCru, assinatura: assinar(velho, corpoCru), agora });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/janela/);
  });

  it('rejeita quando faltam cabeçalhos', () => {
    expect(verificarAssinatura({ secret, timestamp: undefined, corpoCru, assinatura: assinar(ts, corpoCru), agora }).ok).toBe(false);
    expect(verificarAssinatura({ secret, timestamp: ts, corpoCru, assinatura: undefined, agora }).ok).toBe(false);
  });

  it('rejeita assinatura mal formada sem lançar', () => {
    expect(verificarAssinatura({ secret, timestamp: ts, corpoCru, assinatura: 'sha256=zzz', agora }).ok).toBe(false);
  });
});
