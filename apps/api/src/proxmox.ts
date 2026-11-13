import https from 'node:https';

/**
 * Cliente mínimo da API do Proxmox VE, usado pelas ferramentas dos agentes.
 *
 * - Autentica com token de API (PROXMOX_TOKEN = usuario@realm!nome=segredo). O token fica só
 *   no servidor: o modelo nunca o vê, só recebe o resultado das consultas.
 * - Este arquivo só faz GET. Escrita entra junto com a tela de aprovação.
 * - TLS: o certificado padrão do Proxmox é assinado pela CA do próprio cluster. O caminho certo
 *   é confiar nessa CA (PROXMOX_CA_B64 = pve-root-ca.pem em base64). PROXMOX_TLS_INSEGURO=true
 *   desliga a verificação e só deve ser usado em laboratório.
 */

const VARIAVEIS = ['PROXMOX_URL', 'PROXMOX_TOKEN'] as const;

/** Nomes (não valores) das variáveis que faltam para falar com o Proxmox. */
export const proxmoxFaltando = (): string[] => VARIAVEIS.filter((k) => !process.env[k]);

export function proxmoxGet(caminho: string): Promise<unknown> {
  const faltando = proxmoxFaltando();
  if (faltando.length > 0) {
    return Promise.reject(new Error(`Proxmox não configurado no servidor: falta definir ${faltando.join(' e ')}.`));
  }
  let base: URL;
  try {
    base = new URL(process.env.PROXMOX_URL as string);
  } catch {
    return Promise.reject(new Error('PROXMOX_URL inválida. Use o formato https://endereco:8006.'));
  }
  const ca = process.env.PROXMOX_CA_B64 ? Buffer.from(process.env.PROXMOX_CA_B64, 'base64') : undefined;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: base.hostname,
        port: base.port || 8006,
        path: `/api2/json${caminho}`,
        method: 'GET',
        headers: { Authorization: `PVEAPIToken=${process.env.PROXMOX_TOKEN}`, Accept: 'application/json' },
        timeout: 10_000,
        ca,
        rejectUnauthorized: process.env.PROXMOX_TLS_INSEGURO !== 'true',
      },
      (res) => {
        const partes: Buffer[] = [];
        res.on('data', (c: Buffer) => partes.push(c));
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          if (status === 401 || status === 403) return reject(new Error(`O Proxmox recusou o token (HTTP ${status}): confira o token e as permissões dele.`));
          if (status >= 400) return reject(new Error(`O Proxmox respondeu HTTP ${status} para ${caminho}.`));
          try {
            resolve((JSON.parse(Buffer.concat(partes).toString('utf8')) as { data: unknown }).data);
          } catch {
            reject(new Error('O Proxmox devolveu uma resposta que não é JSON.'));
          }
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('O Proxmox não respondeu em 10 segundos (rede ou firewall entre a API e o Proxmox?).')));
    req.on('error', (e: NodeJS.ErrnoException) => {
      const tls = ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID'];
      if (e.code && tls.includes(e.code)) {
        return reject(new Error(`Certificado do Proxmox não confiável (${e.code}): defina PROXMOX_CA_B64 com a CA do cluster.`));
      }
      reject(new Error(e.message));
    });
    req.end();
  });
}
