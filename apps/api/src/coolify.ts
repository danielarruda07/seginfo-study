import http from 'node:http';
import https from 'node:https';

/**
 * Cliente mínimo da API do Coolify (v4), usado pelas ferramentas dos agentes.
 *
 * - COOLIFY_URL: endereço do painel visto de dentro do container da API (ex.: http://IP-DA-VM:8000).
 * - COOLIFY_API_TOKEN (Secret): token criado em Keys & Tokens → API tokens.
 * - COOLIFY_TLS_INSEGURO=true só se o painel usar HTTPS com certificado próprio.
 *
 * O token fica no servidor; o modelo só vê o resultado. Um caminho de URL nunca vem do modelo:
 * as ferramentas montam o caminho a partir de um UUID validado.
 */

const VARIAVEIS = ['COOLIFY_URL', 'COOLIFY_API_TOKEN'] as const;

export const coolifyFaltando = (): string[] => VARIAVEIS.filter((k) => !process.env[k]);

export class ErroCoolify extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function coolifyChamar(metodo: 'GET' | 'POST', caminho: string): Promise<unknown> {
  const faltando = coolifyFaltando();
  if (faltando.length) return Promise.reject(new Error(`Coolify não configurado no servidor: falta definir ${faltando.join(', ')}.`));
  let base: URL;
  try { base = new URL(process.env.COOLIFY_URL as string); } catch { return Promise.reject(new Error('COOLIFY_URL inválida. Use http://endereco:8000.')); }
  const token = (process.env.COOLIFY_API_TOKEN ?? '').trim();
  const seguro = base.protocol === 'https:';
  const mod = seguro ? https : http;
  const prefixo = base.pathname.replace(/\/+$/, '');
  return new Promise((resolve, reject) => {
    const req = mod.request({
      hostname: base.hostname, port: base.port || (seguro ? 443 : 80), path: `${prefixo}/api/v1${caminho}`, method: metodo,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(metodo === 'POST' ? { 'Content-Length': 0 } : {}) },
      timeout: 15_000,
      ...(seguro ? { rejectUnauthorized: process.env.COOLIFY_TLS_INSEGURO !== 'true' } : {}),
    }, (res) => {
      const partes: Buffer[] = [];
      res.on('data', (c: Buffer) => partes.push(c));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        const texto = Buffer.concat(partes).toString('utf8');
        if (status === 401 || status === 403) return reject(new ErroCoolify('O Coolify recusou o token (HTTP ' + status + '). Confira COOLIFY_API_TOKEN e a permissão dele (read para consultar, write/deploy para agir).', status));
        if (status >= 400) {
          let msg = '';
          try { msg = String((JSON.parse(texto) as { message?: string }).message ?? ''); } catch { /* corpo não é JSON */ }
          return reject(new ErroCoolify(`Coolify ${metodo} ${caminho}: HTTP ${status}${msg ? ` (${msg.slice(0, 200)})` : ''}.`, status));
        }
        try { resolve(texto ? JSON.parse(texto) : {}); } catch { resolve(texto.slice(0, 2000)); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('O Coolify não respondeu em 15 s.')));
    req.on('error', (e) => reject(e instanceof ErroCoolify ? e : new Error(`Não foi possível alcançar o Coolify: ${e.message}`)));
    req.end();
  });
}

/**
 * Ações de ciclo de vida: versões novas do Coolify usam POST, as mais antigas da v4 só GET.
 * Tenta POST e, se a rota não existir com esse método, repete com GET.
 */
export async function coolifyAcao(caminho: string): Promise<unknown> {
  try {
    return await coolifyChamar('POST', caminho);
  } catch (e) {
    if (e instanceof ErroCoolify && (e.status === 404 || e.status === 405)) return coolifyChamar('GET', caminho);
    throw e;
  }
}
