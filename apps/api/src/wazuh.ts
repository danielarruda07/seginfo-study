import https from 'node:https';
import type { FastifyInstance } from 'fastify';
import { AmbienteFiltroSchema, ambienteDoAtivo, type AmbienteFiltro } from '@seginfo/shared';
import { z } from 'zod';

const VARIAVEIS = ['WAZUH_API_URL', 'WAZUH_API_USERNAME', 'WAZUH_API_PASSWORD'] as const;
const ERROS_CERT = ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID'];

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {});
const text = (v: unknown): string | null => typeof v === 'string' && v ? v : null;
const items = (v: unknown): Obj[] => {
  const d = obj(obj(v).data);
  return Array.isArray(d.affected_items) ? d.affected_items.map(obj) : [];
};
const daemons = (v: unknown): { nome: string | null; estado: string | null }[] => items(v).flatMap((d) => {
  // Wazuh 4.14 returns one object keyed by daemon name; keep compatibility with
  // versions that return the older { name, status } item shape.
  if (text(d.name) || text(d.status)) return [{ nome: text(d.name), estado: text(d.status) }];
  return Object.entries(d).flatMap(([nome, estado]) => {
    const value = text(estado);
    return value ? [{ nome, estado: value }] : [];
  });
});
const erroTexto = (e: unknown): string => e instanceof Error ? e.message : 'Falha inesperada na consulta ao Wazuh.';

export const wazuhFaltando = (): string[] => VARIAVEIS.filter((k) => !process.env[k]);

function request(method: 'GET' | 'POST' | 'PUT', path: string, headers: Record<string, string> = {}, ca?: string, insecure = false, body?: string): Promise<string> {
  const base = new URL(process.env.WAZUH_API_URL as string);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: base.hostname, port: base.port || 55000, path, method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}), ...headers },
      timeout: 8_000, ca, rejectUnauthorized: !insecure,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const status = res.statusCode ?? 0;
        if (status >= 400) return reject(new Error(status === 401 || status === 403
          ? `Wazuh API ${method} ${path}: acesso recusado (HTTP ${status}); confira usuário e permissões somente leitura.`
          : `Wazuh API ${method} ${path}: HTTP ${status}.`));
        resolve(body);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Tempo limite ao consultar a API do Wazuh (8 s).')));
    req.on('error', (e: NodeJS.ErrnoException) => {
      if (e.message.startsWith('Wazuh API ')) return reject(e);
      if (e.code && ERROS_CERT.includes(e.code)) return reject(new Error(`Wazuh API ${method} ${path}: certificado TLS não confiável. Configure WAZUH_API_CA_B64 ou, apenas no laboratório, WAZUH_API_TLS_INSEGURO=true.`));
      reject(new Error(`Wazuh API ${method} ${path}: não foi possível alcançar a API pela rede privada; confira URL, porta e firewall.`));
    });
    req.end(body);
  });
}

async function consultar(path: string, token: string, ca?: string, insecure = false): Promise<unknown> {
  const raw = await request('GET', path, { Authorization: `Bearer ${token}` }, ca, insecure);
  try { return JSON.parse(raw); } catch { throw new Error('Wazuh API devolveu uma resposta inválida.'); }
}

/** Executa uma chamada Wazuh API para ferramentas de agente; credenciais e JWT nunca saem do servidor. */
export async function wazuhApi(method: 'GET' | 'PUT', path: string): Promise<unknown> {
  const faltando = wazuhFaltando();
  if (faltando.length) throw new Error(`Wazuh não configurado no servidor: falta definir ${faltando.join(', ')}.`);
  let apiUrl: URL;
  try { apiUrl = new URL(process.env.WAZUH_API_URL as string); }
  catch { throw new Error('WAZUH_API_URL inválida.'); }
  if (apiUrl.protocol !== 'https:' || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash || !['', '/'].includes(apiUrl.pathname)) {
    throw new Error('Use WAZUH_API_URL em HTTPS, apenas com host e porta.');
  }
  const insecure = process.env.WAZUH_API_TLS_INSEGURO === 'true';
  let ca: string | undefined;
  if (!insecure && process.env.WAZUH_API_CA_B64) {
    try { ca = Buffer.from(process.env.WAZUH_API_CA_B64, 'base64').toString('utf8'); }
    catch { throw new Error('WAZUH_API_CA_B64 inválida.'); }
  }
  const basic = Buffer.from(`${process.env.WAZUH_API_USERNAME}:${process.env.WAZUH_API_PASSWORD}`).toString('base64');
  const token = (await request('POST', '/security/user/authenticate?raw=true', { Authorization: `Basic ${basic}` }, ca, insecure)).trim();
  if (!token || token.length > 8192) throw new Error('Wazuh API não retornou um token de sessão válido.');
  const raw = await request(method, path, { Authorization: `Bearer ${token}` }, ca, insecure);
  try { return JSON.parse(raw); } catch { throw new Error('Wazuh API devolveu uma resposta inválida.'); }
}

async function statusWazuh(ambiente: AmbienteFiltro) {
  const faltando = wazuhFaltando();
  if (faltando.length) return { configurado: false, faltando, erro: null, consultadoEm: null, manager: null, agentes: null };

  let apiUrl: URL;
  try { apiUrl = new URL(process.env.WAZUH_API_URL as string); }
  catch { return { configurado: true, faltando: [], erro: 'WAZUH_API_URL inválida.', consultadoEm: null, manager: null, agentes: null }; }
  if (apiUrl.protocol !== 'https:' || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash || !['', '/'].includes(apiUrl.pathname)) {
    return { configurado: true, faltando: [], erro: 'Use WAZUH_API_URL em HTTPS, apenas com host e porta (sem credenciais, caminho ou parâmetros).', consultadoEm: null, manager: null, agentes: null };
  }
  const insecure = process.env.WAZUH_API_TLS_INSEGURO === 'true';
  let ca: string | undefined;
  try { if (!insecure && process.env.WAZUH_API_CA_B64) ca = Buffer.from(process.env.WAZUH_API_CA_B64, 'base64').toString('utf8'); }
  catch { return { configurado: true, faltando: [], erro: 'WAZUH_API_CA_B64 inválida.', consultadoEm: null, manager: null, agentes: null }; }

  try {
    const basic = Buffer.from(`${process.env.WAZUH_API_USERNAME}:${process.env.WAZUH_API_PASSWORD}`).toString('base64');
    const token = (await request('POST', '/security/user/authenticate?raw=true', { Authorization: `Basic ${basic}` }, ca, insecure)).trim();
    if (!token || token.length > 8192) throw new Error('Wazuh API não retornou um token de sessão válido.');
    const [rootResult, statusResult, agentsResult] = await Promise.allSettled([
      consultar('/', token, ca, insecure),
      consultar('/manager/status', token, ca, insecure),
      consultar('/agents?limit=500&select=id,name,ip,status,version,lastKeepAlive,os.name,os.version,group', token, ca, insecure),
    ]);
    const failures = [rootResult, statusResult, agentsResult]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => erroTexto(r.reason));
    const r = rootResult.status === 'fulfilled' ? obj(obj(rootResult.value).data) : {};
    const daemonItems = statusResult.status === 'fulfilled' ? daemons(statusResult.value) : [];
    const active = (agentsResult.status === 'fulfilled' ? items(agentsResult.value) : []).filter((a) => ambiente === 'todos' || ambienteDoAtivo(a) === ambiente);
    const counts = { active: 0, disconnected: 0, pending: 0, never_connected: 0, other: 0 };
    const normalized = active.map((a) => {
      const state = text(a.status) ?? 'other';
      if (state in counts) counts[state as keyof typeof counts]++;
      else counts.other++;
      const os = obj(a.os);
      return {
        id: text(a.id), name: text(a.name), ip: text(a.ip), status: state,
        ambiente: ambienteDoAtivo(a),
        version: text(a.version), lastKeepAlive: text(a.lastKeepAlive),
        os: [text(os.name), text(os.version)].filter(Boolean).join(' ') || null,
      };
    });
    return {
      configurado: true, faltando: [], consultadoEm: new Date().toISOString(),
      manager: rootResult.status === 'fulfilled' || statusResult.status === 'fulfilled'
        ? { versao: text(r.api_version), hostname: text(r.hostname), timestamp: text(r.timestamp), daemons: daemonItems }
        : null,
      agentes: agentsResult.status === 'fulfilled' ? { total: active.length, contagens: counts, items: normalized } : null,
      erro: failures.length ? [...new Set(failures)].join(' ') : null,
    };
  } catch (e) {
    return { configurado: true, faltando: [], erro: erroTexto(e), consultadoEm: new Date().toISOString(), manager: null, agentes: null };
  }
}

export async function registerWazuhRoutes(app: FastifyInstance) {
  app.get('/api/wazuh/status', async (req, reply) => {
    const q = z.object({ ambiente: AmbienteFiltroSchema }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: 'Ambiente inválido.' });
    return statusWazuh(q.data.ambiente);
  });
}
