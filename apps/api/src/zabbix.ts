import https from 'node:https';

const VARIAVEIS = ['ZABBIX_API_URL', 'ZABBIX_API_TOKEN'] as const;
const ERROS_CERT = ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID'];

export const zabbixFaltando = (): string[] => VARIAVEIS.filter((k) => !process.env[k]);

/** Chamada JSON-RPC estrita: o agente escolhe o método permitido pelo catálogo, nunca uma URL. */
export function zabbixChamar(metodo: string, parametros: unknown): Promise<unknown> {
  const faltando = zabbixFaltando();
  if (faltando.length) return Promise.reject(new Error(`Zabbix não configurado no servidor: falta definir ${faltando.join(', ')}.`));
  let base: URL;
  try { base = new URL(process.env.ZABBIX_API_URL as string); }
  catch { return Promise.reject(new Error('ZABBIX_API_URL inválida.')); }
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) {
    return Promise.reject(new Error('ZABBIX_API_URL deve usar HTTPS, sem usuário, senha, query ou fragmento.'));
  }
  const token = (process.env.ZABBIX_API_TOKEN ?? '').trim();
  if (!token || /\s/.test(token)) return Promise.reject(new Error('ZABBIX_API_TOKEN está vazio ou contém espaços.'));
  const insecure = process.env.ZABBIX_TLS_INSEGURO === 'true';
  let ca: string | undefined;
  try { if (!insecure && process.env.ZABBIX_CA_B64) ca = Buffer.from(process.env.ZABBIX_CA_B64, 'base64').toString('utf8'); }
  catch { return Promise.reject(new Error('ZABBIX_CA_B64 inválida.')); }
  const body = JSON.stringify({ jsonrpc: '2.0', method: metodo, params: parametros, id: 1 });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: base.hostname, port: base.port || 443, path: base.pathname === '/' ? '/api_jsonrpc.php' : base.pathname, method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json-rpc', 'Content-Length': Buffer.byteLength(body) },
      timeout: 10_000, ca, rejectUnauthorized: !insecure,
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const status = res.statusCode ?? 0;
        if (status >= 400) return reject(new Error(`Zabbix API respondeu HTTP ${status}; confira URL, token e permissões.`));
        let resposta: { result?: unknown; error?: { message?: string; data?: string } };
        try { resposta = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { return reject(new Error('Zabbix API devolveu uma resposta inválida.')); }
        if (resposta.error) return reject(new Error(`Zabbix ${metodo}: ${String(resposta.error.message ?? 'erro')} ${String(resposta.error.data ?? '')}`.trim()));
        resolve(resposta.result);
      });
    });
    req.on('timeout', () => req.destroy(new Error('Tempo limite ao consultar a API do Zabbix (10 s).')));
    req.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code && ERROS_CERT.includes(e.code)) return reject(new Error('Certificado TLS do Zabbix não confiável; configure ZABBIX_CA_B64 ou, somente em laboratório isolado, ZABBIX_TLS_INSEGURO=true.'));
      if (e.message.startsWith('Zabbix ')) return reject(e);
      reject(new Error(`Não foi possível alcançar a API do Zabbix: ${e.message}`));
    });
    req.end(body);
  });
}
