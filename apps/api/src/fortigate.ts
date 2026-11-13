import https from 'node:https';

/**
 * Cliente mínimo da API REST do FortiGate (FortiOS), usado pelas ferramentas dos agentes.
 *
 * - Autentica com API token (Settings > Administrators > novo admin REST API, ou CLI
 *   `config system api-user`). O token fica só no servidor: o modelo nunca o vê, só recebe o
 *   resultado das consultas. Enviado como `Authorization: Bearer <token>` no header, nunca na URL
 *   (a partir do FortiOS 7.4.5/7.6.1 a URL nem é mais aceita por padrão).
 * - fortigateGet lê `/api/v2/cmdb/...` e `/api/v2/monitor/...`; fortigateAlterar (POST/PUT/DELETE)
 *   muda a configuração e só é chamada por ferramentas de escrita, que o runtime nunca executa
 *   sem aprovação na tela.
 * - TLS: o FortiGate normalmente usa um certificado autoassinado na interface de gerência. Sem
 *   uma CA própria configurada no cluster (caso comum em laboratório), a verificação é desligada
 *   com FORTIGATE_TLS_INSEGURO=true — mesmo modelo usado em proxmox.ts.
 */

const VARIAVEIS = ['FORTIGATE_URL', 'FORTIGATE_TOKEN'] as const;
const ERROS_DE_CERTIFICADO = ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID'];

/** Nomes (não valores) das variáveis que faltam para falar com o FortiGate. */
export const fortigateFaltando = (): string[] => VARIAVEIS.filter((k) => !process.env[k]);

export const fortigateGet = (caminho: string): Promise<unknown> => pedir('GET', caminho);

/**
 * Altera a configuração do FortiGate (CMDB). Só é chamada pelas ferramentas de escrita, e essas
 * só rodam depois da aprovação na tela (ver agenteRuntime.ts).
 */
export async function fortigateAlterar(metodo: 'POST' | 'PUT' | 'DELETE', caminho: string, corpo: Record<string, unknown> = {}): Promise<unknown> {
  return pedir(metodo, caminho, metodo === 'DELETE' ? undefined : JSON.stringify(corpo));
}

function pedir(metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', caminho: string, corpo?: string): Promise<unknown> {
  const faltando = fortigateFaltando();
  if (faltando.length > 0) {
    return Promise.reject(new Error(`FortiGate não configurado no servidor: falta definir ${faltando.join(' e ')}.`));
  }
  let base: URL;
  try {
    base = new URL(process.env.FORTIGATE_URL as string);
  } catch {
    return Promise.reject(new Error('FORTIGATE_URL inválida. Use o formato https://endereco:porta.'));
  }
  const token = (process.env.FORTIGATE_TOKEN ?? '').trim().replace(/^["']|["']$/g, '');
  if (!token) return Promise.reject(new Error('FORTIGATE_TOKEN está vazio.'));
  if (/\s/.test(token)) return Promise.reject(new Error('FORTIGATE_TOKEN tem espaço no meio: confira se não colou algo extra.'));

  const inseguro = process.env.FORTIGATE_TLS_INSEGURO === 'true';

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: base.hostname,
        port: base.port || 443,
        path: caminho,
        method: metodo,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(corpo ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corpo) } : {}),
        },
        timeout: 10_000,
        rejectUnauthorized: !inseguro,
      },
      (res) => {
        const partes: Buffer[] = [];
        res.on('data', (c: Buffer) => partes.push(c));
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          const texto = Buffer.concat(partes).toString('utf8');
          let json: { status?: string; http_status?: number; error?: number | string; cli_error?: string } | undefined;
          try { json = texto ? JSON.parse(texto) : undefined; } catch { /* resposta sem corpo JSON válido */ }
          if (status === 401) return reject(new Error('O FortiGate não reconheceu o token (HTTP 401). Confira se o token não expirou e se o admin REST API está habilitado (trusted hosts inclui a origem da API).'));
          if (status === 403) return reject(new Error(`O token foi aceito, mas não tem permissão para ${caminho} (HTTP 403): confira o perfil de acesso (profile) do admin REST API.`));
          if (status >= 400) {
            const detalhe = json?.cli_error ?? json?.error ?? res.statusMessage ?? 'sem detalhe';
            return reject(new Error(`O FortiGate respondeu HTTP ${status} para ${caminho}: ${detalhe}.`));
          }
          if (!texto) return resolve(undefined);
          try {
            resolve(JSON.parse(texto));
          } catch {
            reject(new Error('O FortiGate devolveu uma resposta que não é JSON.'));
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('O FortiGate não respondeu em 10 segundos (rede, firewall entre a API e o FortiGate, ou "trusted hosts" bloqueando a origem?).')));
    req.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code && ERROS_DE_CERTIFICADO.includes(e.code)) {
        return reject(new Error(
          `Certificado do FortiGate não confiável (${e.code}). Em laboratório, defina FORTIGATE_TLS_INSEGURO=true no serviço da API ` +
          '(Coolify) e faça redeploy; em produção, instale um certificado confiável na interface de gerência.',
        ));
      }
      reject(new Error(e.message));
    });
    req.end(corpo);
  });
}
