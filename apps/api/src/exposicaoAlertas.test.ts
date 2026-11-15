import { afterEach, describe, expect, it, vi } from 'vitest';

const enviados = vi.hoisted(() => [] as { msg: string; porta: number; host: string }[]);
vi.mock('node:dgram', () => ({
  default: {
    createSocket: () => ({
      on: () => undefined,
      close: () => undefined,
      send: (b: Buffer, porta: number, host: string, cb: () => void) => { enviados.push({ msg: b.toString('utf8'), porta, host }); cb(); },
    }),
  },
}));

const { carimboRfc3164, filtrarParaTelegram, linhaSyslog, mensagemTelegram, notificarMudancas } = await import('./exposicaoAlertas.js');

const ev = (mudancas: { tipo: string; severidade: 'alta' | 'media' | 'info'; texto: string; fonte?: string }[]) =>
  ({ alvo: 'exemplo.com', tipoAlvo: 'dominio', quando: '2026-11-15T18:00:00.000Z', mudancas });

afterEach(() => {
  enviados.length = 0;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('alertas da exposição', () => {
  it('carimbo RFC 3164 com dia alinhado por espaço', () => {
    expect(carimboRfc3164(new Date(2026, 10, 5, 9, 3, 7))).toBe('Nov  5 09:03:07');
    expect(carimboRfc3164(new Date(2026, 10, 15, 18, 0, 0))).toBe('Nov 15 18:00:00');
  });

  it('linha syslog: PRI de local0 pela severidade, programa e JSON', () => {
    const d = new Date(2026, 10, 15, 18, 0, 0);
    const e = ev([]);
    const alta = linhaSyslog(e, { tipo: 'porta-aberta', severidade: 'alta', texto: 'Porta 22 aberta' }, d);
    expect(alta.startsWith('<132>Nov 15 18:00:00 seginfo seginfo-exposicao: {')).toBe(true);
    const json = JSON.parse(alta.slice(alta.indexOf('{')));
    expect(json).toEqual({ evento: 'seginfo.exposicao.mudanca', alvo: 'exemplo.com', tipoAlvo: 'dominio', tipo: 'porta-aberta', severidade: 'alta', texto: 'Porta 22 aberta', fonte: 'basica', quando: e.quando });
    expect(linhaSyslog(e, { tipo: 'x', severidade: 'media', texto: '' }, d).startsWith('<133>')).toBe(true);
    expect(linhaSyslog(e, { tipo: 'x', severidade: 'info', texto: '' }, d).startsWith('<134>')).toBe(true);
  });

  it('filtro do Telegram: padrão só alta; "media" inclui médias; info nunca', () => {
    const ms = ev([
      { tipo: 'a', severidade: 'alta', texto: '1' }, { tipo: 'b', severidade: 'media', texto: '2' }, { tipo: 'c', severidade: 'info', texto: '3' },
    ]).mudancas;
    expect(filtrarParaTelegram(ms, undefined).map((m) => m.tipo)).toEqual(['a']);
    expect(filtrarParaTelegram(ms, 'media').map((m) => m.tipo)).toEqual(['a', 'b']);
    expect(filtrarParaTelegram(ms, 'qualquer').map((m) => m.tipo)).toEqual(['a']);
  });

  it('mensagem do Telegram em texto simples e cortada em 3500', () => {
    const t = mensagemTelegram(ev([]), [{ tipo: 'a', severidade: 'alta', texto: 'Porta 3389 aberta' }]);
    expect(t).toContain('Alvo: exemplo.com');
    expect(t).toContain('[ALTA] Porta 3389 aberta');
    const longa = mensagemTelegram(ev([]), Array.from({ length: 100 }, () => ({ tipo: 'a', severidade: 'alta' as const, texto: 'x'.repeat(80) })));
    expect(longa.length).toBeLessThanOrEqual(3500);
  });

  it('sem variáveis: só stdout, sem syslog nem Telegram', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await notificarMudancas(ev([{ tipo: 'a', severidade: 'alta', texto: '1' }]));
    expect(enviados).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it('com variáveis: uma linha syslog por mudança e uma mensagem só com as graves', async () => {
    vi.stubEnv('WAZUH_SYSLOG_HOST', '192.0.2.10');
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'tok');
    vi.stubEnv('TELEGRAM_CHAT_ID', '42');
    const f = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', f);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await notificarMudancas(ev([{ tipo: 'a', severidade: 'alta', texto: 'grave' }, { tipo: 'b', severidade: 'info', texto: 'leve' }]));
    expect(enviados.map((x) => [x.host, x.porta])).toEqual([['192.0.2.10', 514], ['192.0.2.10', 514]]);
    expect(f).toHaveBeenCalledTimes(1);
    const corpo = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(corpo.chat_id).toBe('42');
    expect(corpo.text).toContain('grave');
    expect(corpo.text).not.toContain('leve');
  });

  it('Telegram que falha não lança nem vaza o token', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'segredo123');
    vi.stubEnv('TELEGRAM_CHAT_ID', '42');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('https://api.telegram.org/botsegredo123 falhou'); }));
    const saida: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => { saida.push(String(s)); return true; });
    await expect(notificarMudancas(ev([{ tipo: 'a', severidade: 'alta', texto: '1' }]))).resolves.toBeUndefined();
    expect(saida.join('')).not.toContain('segredo123');
  });
});
