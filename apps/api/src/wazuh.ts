import https from 'node:https';
import type { FastifyInstance } from 'fastify';
import type { AuthedRequest } from './auth.js';

const VARIAVEIS = ['WAZUH_API_URL', 'WAZUH_API_USERNAME', 'WAZUH_API_PASSWORD'] as const;
const ERROS_CERT = ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID'];

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {});
const text = (v: unknown): string | null => typeof v === 'string' && v ? v : null;
const items = (v: unknown): Obj[] => {
  const d = obj(obj(v).data);
  return Array.isArray(d.affected_items) ? d.affected_items.map(obj) : [];
};

export const wazuhFaltando = (): string[] => VARIAVEIS.filter((k) => !process.env[k]);

function request(method: 'GET' | 'POST', path: string, headers: Record<string, string> = {}, ca?: string, insecure = false): Promise<string> {
  const base = new URL(process.env.WAZUH_API_URL as string);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: base.hostname, port: base.port || 55000, path, method,
      headers: { Accept: 'application/json', ...headers },
      timeout: 8_000, ca, rejectUnauthorized: !insecure,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        const status = res.statusCode ?? 0;
        if (status >= 400) return reject(new Error(status === 401 || status === 403
          ? `Wazuh API recusou a consulta (HTTP ${status}); confira usuário e permissões somente leitura.`
          : `Wazuh API respondeu HTTP ${status}.`));
        resolve(body);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Tempo limite ao consultar a API do Wazuh (8 s).')));
    req.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code && ERROS_CERT.includes(e.code)) return reject(new Error('Certificado TLS do Wazuh não é confiável. Configure WAZUH_API_CA_B64 ou, apenas no laboratório, WAZUH_API_TLS_INSEGURO=true.'));
      reject(new Error('Não foi possível alcançar a API do Wazuh pela rede privada; confira URL, porta e firewall.'));
    });
    req.end();
  });
}

async function consultar(path: string, token: string, ca?: string, insecure = false): Promise<unknown> {
  const raw = await request('GET', path, { Authorization: `Bearer ${token}` }, ca, insecure);
  try { return JSON.parse(raw); } catch { throw new Error('Wazuh API devolveu uma resposta inválida.'); }
}

async function statusWazuh() {
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
    const [root, status, agents] = await Promise.all([
      consultar('/', token, ca, insecure),
      consultar('/manager/status', token, ca, insecure),
      consultar('/agents?limit=500&select=id,name,ip,status,version,lastKeepAlive,os', token, ca, insecure),
    ]);
    const r = obj(obj(root).data);
    const active = items(agents);
    const counts = { active: 0, disconnected: 0, pending: 0, never_connected: 0, other: 0 };
    const normalized = active.map((a) => {
      const state = text(a.status) ?? 'other';
      if (state in counts) counts[state as keyof typeof counts]++;
      else counts.other++;
      const os = obj(a.os);
      return {
        id: text(a.id), name: text(a.name), ip: text(a.ip), status: state,
        version: text(a.version), lastKeepAlive: text(a.lastKeepAlive),
        os: [text(os.name), text(os.version)].filter(Boolean).join(' ') || null,
      };
    });
    return {
      configurado: true, faltando: [], erro: null, consultadoEm: new Date().toISOString(),
      manager: { versao: text(r.api_version), hostname: text(r.hostname), timestamp: text(r.timestamp),
        daemons: items(status).map((d) => ({ nome: text(d.name), estado: text(d.status) })) },
      agentes: { total: active.length, contagens: counts, items: normalized },
    };
  } catch (e) {
    return { configurado: true, faltando: [], erro: (e as Error).message, consultadoEm: new Date().toISOString(), manager: null, agentes: null };
  }
}

export async function registerWazuhRoutes(app: FastifyInstance) {
  app.get('/api/wazuh/status', async () => statusWazuh());
}
