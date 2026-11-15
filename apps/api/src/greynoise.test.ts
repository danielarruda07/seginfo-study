import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _reiniciarGreynoise, classificarIp, interpretarResposta, INTERVALO_MIN_MS } from './greynoise.js';

const resposta = (status: number, corpo: unknown) => new Response(corpo === null ? '' : JSON.stringify(corpo), { status });

describe('GreyNoise', () => {
  beforeEach(() => _reiniciarGreynoise());
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); delete process.env.GREYNOISE_API_KEY; });

  it('interpreta ruído, malicioso, benigno (RIOT), não visto e limite', () => {
    expect(interpretarResposta('203.0.113.5', 200, { noise: true, riot: false, classification: 'unknown', name: 'unknown' }))
      .toMatchObject({ estado: 'ruido', noise: true, name: null });
    expect(interpretarResposta('203.0.113.5', 200, { noise: true, classification: 'malicious', last_seen: '2026-11-14' }))
      .toMatchObject({ estado: 'malicioso', last_seen: '2026-11-14' });
    expect(interpretarResposta('203.0.113.5', 200, { noise: false, riot: true, classification: 'benign', name: 'Cloudflare' }))
      .toMatchObject({ estado: 'benigno', riot: true, name: 'Cloudflare' });
    expect(interpretarResposta('203.0.113.5', 404, { message: 'IP not observed' })).toMatchObject({ estado: 'nao-visto' });
    expect(interpretarResposta('203.0.113.5', 429, null)).toMatchObject({ estado: 'limite' });
    expect(interpretarResposta('203.0.113.5', 500, null)).toMatchObject({ estado: 'erro' });
    // link de fora do esquema https vira o link padrão do visualizador
    expect(interpretarResposta('203.0.113.5', 200, { noise: true, link: 'javascript:alert(1)' }).link).toBe('https://viz.greynoise.io/ip/203.0.113.5');
  });

  it('recusa IP privado sem chamar a API', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(classificarIp('10.10.80.21')).rejects.toThrow(/privado/);
    expect(f).not.toHaveBeenCalled();
  });

  it('usa o cache e manda a chave opcional no header', async () => {
    process.env.GREYNOISE_API_KEY = 'k';
    const f = vi.fn(async () => resposta(200, { noise: true, classification: 'malicious' }));
    vi.stubGlobal('fetch', f);
    const a = await classificarIp('198.51.100.7');
    const b = await classificarIp('198.51.100.7');
    expect(a.estado).toBe('malicioso');
    expect(b).toBe(a);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.greynoise.io/v3/community/198.51.100.7');
    expect((init.headers as Record<string, string>).key).toBe('k');
  });

  it('respeita o intervalo mínimo entre consultas e não guarda limite em cache', async () => {
    const horarios: number[] = [];
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async () => { horarios.push(Date.now()); n += 1; return n === 1 ? resposta(404, {}) : resposta(429, null); }));
    const [x, y] = await Promise.all([classificarIp('198.51.100.1'), classificarIp('198.51.100.2')]);
    expect(x.estado).toBe('nao-visto');
    expect(y.estado).toBe('limite');
    expect(horarios[1] - horarios[0]).toBeGreaterThanOrEqual(INTERVALO_MIN_MS - 20);
    // depois de 429 o módulo segura novas consultas, sem chamar a API
    const z = await classificarIp('198.51.100.2');
    expect(z.estado).toBe('limite');
    expect(horarios).toHaveLength(2);
  });
});
