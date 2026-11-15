import dgram from 'node:dgram';
import type { Mudanca, Severidade } from './exposicaoFontes/tipos.js';

/**
 * Para onde vão as mudanças da "Minha exposição" além da tela:
 * - stdout: uma linha JSON por mudança (sempre);
 * - syslog UDP para o Wazuh manager, quando WAZUH_SYSLOG_HOST existe (WAZUH_SYSLOG_PORT, padrão 514);
 *   o manager tem decoder (program_name seginfo-exposicao) e regras próprias para virar alerta;
 * - Telegram, quando TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID existem: uma mensagem por varredura com
 *   as mudanças a partir de EXPOSICAO_TELEGRAM_MIN (padrão 'alta'; aceita 'media').
 * Tudo é melhor-esforço: nunca lança.
 */

export interface EventoExposicao { alvo: string; tipoAlvo: string; quando: string; mudancas: Mudanca[] }

const FACILIDADE_LOCAL0 = 16;
/** alta → warning (4), media → notice (5), info → informational (6) */
const SEVERIDADE_SYSLOG: Record<Severidade, number> = { alta: 4, media: 5, info: 6 };
const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Carimbo RFC 3164: "Nov  5 09:03:07" (dia com espaço à esquerda). */
export function carimboRfc3164(d: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${MESES[d.getMonth()]} ${String(d.getDate()).padStart(2, ' ')} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

export function payloadMudanca(e: EventoExposicao, m: Mudanca) {
  return {
    evento: 'seginfo.exposicao.mudanca',
    alvo: e.alvo,
    tipoAlvo: e.tipoAlvo,
    tipo: m.tipo,
    severidade: m.severidade,
    texto: m.texto,
    fonte: m.fonte ?? 'basica',
    quando: e.quando,
  };
}

export function linhaSyslog(e: EventoExposicao, m: Mudanca, agora = new Date()): string {
  const pri = FACILIDADE_LOCAL0 * 8 + SEVERIDADE_SYSLOG[m.severidade];
  return `<${pri}>${carimboRfc3164(agora)} seginfo seginfo-exposicao: ${JSON.stringify(payloadMudanca(e, m))}`;
}

const PESO: Record<Severidade, number> = { alta: 0, media: 1, info: 2 };

/** Mudanças que entram no Telegram, conforme EXPOSICAO_TELEGRAM_MIN ('alta' padrão; 'media' inclui médias). */
export function filtrarParaTelegram(mudancas: Mudanca[], minimo = process.env.EXPOSICAO_TELEGRAM_MIN): Mudanca[] {
  const limite: Severidade = minimo === 'media' ? 'media' : 'alta';
  return mudancas.filter((m) => PESO[m.severidade] <= PESO[limite]);
}

const ROTULO: Record<Severidade, string> = { alta: 'ALTA', media: 'MÉDIA', info: 'INFO' };

export function mensagemTelegram(e: EventoExposicao, mudancas: Mudanca[]): string {
  const linhas = [`SegInfo · Minha exposição`, `Alvo: ${e.alvo}`, `Varredura: ${e.quando}`, ''];
  for (const m of mudancas) linhas.push(`[${ROTULO[m.severidade]}] ${m.texto}`);
  const t = linhas.join('\n');
  return t.length > 3500 ? `${t.slice(0, 3490)}\n…` : t;
}

function enviarSyslog(linhas: string[]): Promise<void> {
  const host = process.env.WAZUH_SYSLOG_HOST;
  if (!host || linhas.length === 0) return Promise.resolve();
  const porta = Number(process.env.WAZUH_SYSLOG_PORT ?? '514') || 514;
  return new Promise((resolve) => {
    let fim = false;
    let s: dgram.Socket;
    const acabar = () => {
      if (fim) return;
      fim = true;
      clearTimeout(prazo);
      try { s.close(); } catch { /* já fechado */ }
      resolve();
    };
    const prazo = setTimeout(acabar, 3_000);
    try {
      s = dgram.createSocket(host.includes(':') ? 'udp6' : 'udp4');
      s.on('error', acabar);
      let pendentes = linhas.length;
      for (const l of linhas) {
        s.send(Buffer.from(l, 'utf8'), porta, host, () => { if (--pendentes === 0) acabar(); });
      }
    } catch {
      acabar();
    }
  });
}

async function enviarTelegram(e: EventoExposicao): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  const graves = filtrarParaTelegram(e.mudancas);
  if (!graves.length) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: mensagemTelegram(e, graves), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // sem log do erro bruto: a URL contém o token
    process.stdout.write(`${JSON.stringify({ evento: 'seginfo.exposicao.telegram_falhou', alvo: e.alvo })}\n`);
  }
}

export async function notificarMudancas(e: EventoExposicao): Promise<void> {
  for (const m of e.mudancas) {
    process.stdout.write(`${JSON.stringify({ evento: 'seginfo.exposicao.mudanca', quando: e.quando, alvo: e.alvo, tipoAlvo: e.tipoAlvo, ...m })}\n`);
  }
  if (!e.mudancas.length) return;
  const agora = new Date();
  await Promise.allSettled([
    enviarSyslog(e.mudancas.map((m) => linhaSyslog(e, m, agora))),
    enviarTelegram(e),
  ]);
}
