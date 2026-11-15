import { X509Certificate } from 'node:crypto';
import https from 'node:https';
import tls from 'node:tls';
import { resumirErroProxmox } from './proxmoxErro.js';

/**
 * Cliente mínimo da API do Proxmox VE, usado pelas ferramentas dos agentes.
 *
 * - Autentica com token de API (PROXMOX_TOKEN = usuario@realm!nome=segredo). O token fica só
 *   no servidor: o modelo nunca o vê, só recebe o resultado das consultas.
 * - proxmoxGet lê; proxmoxAlterar muda o ambiente e só é usada por ferramentas de escrita,
 *   que o runtime nunca executa sem aprovação na tela.
 * - TLS: o certificado padrão do Proxmox é assinado pela CA do próprio cluster. O caminho certo
 *   é confiar nessa CA (PROXMOX_CA_B64 = pve-root-ca.pem em base64). PROXMOX_TLS_INSEGURO=true
 *   desliga a verificação e só deve ser usado em laboratório.
 */

const VARIAVEIS = ['PROXMOX_URL', 'PROXMOX_TOKEN'] as const;
const ERROS_DE_CERTIFICADO = ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID'];

/** Nomes (não valores) das variáveis que faltam para falar com o Proxmox. */
export const proxmoxFaltando = (): string[] => VARIAVEIS.filter((k) => !process.env[k]);

export const proxmoxGet = (caminho: string): Promise<unknown> => pedir('GET', caminho);

/**
 * Altera algo no Proxmox e espera a tarefa terminar. Só é chamada pelas ferramentas de escrita,
 * e essas só rodam depois da aprovação na tela (ver agenteRuntime.ts).
 * A maioria das alterações devolve o id de uma tarefa (UPID) que roda em segundo plano no nó.
 */
export async function proxmoxAlterar(
  metodo: 'POST' | 'PUT' | 'DELETE',
  no: string,
  caminho: string,
  parametros: Record<string, string | number> = {},
  /** quanto esperar a tarefa terminar antes de devolver "em andamento" (clone completo demora mais) */
  esperaSegundos = 90,
): Promise<string> {
  const corpo = new URLSearchParams(Object.entries(parametros).map(([k, v]): [string, string] => [k, String(v)])).toString();
  const upid = await pedir(metodo, caminho, corpo);
  if (typeof upid !== 'string' || !upid.startsWith('UPID:')) return 'Concluído.';
  for (let i = 0; i < Math.ceil(esperaSegundos / 2); i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const t = (await pedir('GET', `/nodes/${no}/tasks/${encodeURIComponent(upid)}/status`)) as { status?: string; exitstatus?: string };
    if (t.status === 'stopped') {
      if (t.exitstatus === 'OK') return 'Tarefa concluída com sucesso.';
      throw new Error(`A tarefa terminou com erro no Proxmox: ${resumirErroProxmox(t.exitstatus ?? 'sem detalhe')}`);
    }
  }
  return `A tarefa foi iniciada e ainda está em andamento no Proxmox depois de ${esperaSegundos} segundos. Consulte o estado antes de concluir que terminou.`;
}

function pedir(metodo: 'GET' | 'POST' | 'PUT' | 'DELETE', caminho: string, corpo = ''): Promise<unknown> {
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
  let token: string;
  try {
    token = tokenConfigurado();
  } catch (e) {
    return Promise.reject(e);
  }
  // Com a verificação desligada, a CA não é usada: um valor ruim nela não pode impedir a consulta.
  const inseguro = process.env.PROXMOX_TLS_INSEGURO === 'true';
  let ca: string | undefined;
  try {
    ca = inseguro ? undefined : caConfigurada()?.pem;
  } catch (e) {
    return Promise.reject(e);
  }

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: base.hostname,
        port: base.port || 8006,
        path: `/api2/json${caminho}`,
        method: metodo,
        headers: {
          Authorization: `PVEAPIToken=${token}`,
          Accept: 'application/json',
          ...(metodo !== 'GET' ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(corpo) } : {}),
        },
        timeout: 10_000,
        ca,
        rejectUnauthorized: !inseguro,
      },
      (res) => {
        const partes: Buffer[] = [];
        res.on('data', (c: Buffer) => partes.push(c));
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          if (status === 401) {
            const [id] = token.split('=');
            return reject(new Error(
              `O Proxmox não reconheceu o token (HTTP 401). O formato está certo e o token enviado foi "${id}" (segredo omitido). ` +
              'Então: ou esse usuário/nome de token não existe exatamente assim no Proxmox, ou o segredo não é o desse token, ou o token expirou.',
            ));
          }
          if (status === 403) return reject(new Error(`O token foi aceito, mas não tem permissão para ${caminho} (HTTP 403): dê uma role ao token em Datacenter → Permissions.`));
          // O Proxmox explica o motivo na linha de status (ex.: "VM is locked", "snapshot name already used").
          if (status >= 400) return reject(new Error(`O Proxmox respondeu HTTP ${status} para ${caminho}${res.statusMessage ? `: ${resumirErroProxmox(res.statusMessage)}` : ''}`));
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
      if (e.code && ERROS_DE_CERTIFICADO.includes(e.code)) {
        return void diagnosticoTls(base, e.code).then((texto) => reject(new Error(texto)));
      }
      reject(new Error(e.message));
    });
    req.end(metodo !== 'GET' ? corpo : undefined);
  });
}

// ---------- token ----------

/** Quem o servidor usa para falar com o Proxmox, sem o segredo (ex.: root@pam!agent). Null se não houver token válido. */
export function proxmoxIdentidade(): string | null {
  try {
    return tokenConfigurado().split('=')[0];
  } catch {
    return null;
  }
}

/**
 * Lê PROXMOX_TOKEN e confere o formato usuario@realm!nome=segredo antes de enviar, para o erro
 * dizer o que está errado no valor (sem mostrar o segredo) em vez de um 401 genérico.
 */
function tokenConfigurado(): string {
  let t = (process.env.PROXMOX_TOKEN ?? '').trim().replace(/^["']|["']$/g, '');
  if (t.startsWith('PVEAPIToken=')) t = t.slice('PVEAPIToken='.length);
  const erro = (motivo: string) => new Error(`PROXMOX_TOKEN em formato errado: ${motivo}. O formato é usuario@realm!nome=segredo, por exemplo root@pam!agente=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.`);
  const igual = t.indexOf('=');
  if (igual < 0) throw erro('falta o "=" seguido do segredo (parece que só uma parte foi colada)');
  const id = t.slice(0, igual);
  const segredo = t.slice(igual + 1);
  if (!id.includes('!')) throw erro('falta o "!" entre o usuário e o nome do token');
  if (!id.split('!')[0].includes('@')) throw erro('o usuário precisa do realm, como root@pam');
  if (/\s/.test(t)) throw erro('há espaço no meio do valor');
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(segredo)) {
    throw erro(`o segredo depois do "=" tem ${segredo.length} caracteres e não parece o UUID de 36 caracteres que o Proxmox gera`);
  }
  return t;
}

// ---------- certificado ----------

/** CN de um nome X.509 no formato do Node ("C=..\nO=..\nCN=.."). */
const nomeDe = (dn: string) => dn.split('\n').find((l) => l.startsWith('CN='))?.slice(3) ?? dn.split('\n').join(', ');

/**
 * Lê PROXMOX_CA_B64. Aceita o PEM em base64 (recomendado) ou o próprio PEM colado, mesmo que o
 * painel tenha trocado as quebras de linha por espaços. Lança um erro explicando o que está errado.
 */
function caConfigurada(): { pem: string; nome: string } | undefined {
  const bruto = process.env.PROXMOX_CA_B64?.trim();
  if (!bruto) return undefined;
  const texto = bruto.includes('BEGIN CERTIFICATE') ? bruto : Buffer.from(bruto.replace(/\s+/g, ''), 'base64').toString('utf8');
  const corpos = [...texto.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g)].map((m) => m[1].replace(/\s+/g, ''));
  if (corpos.length === 0) {
    // Tamanho e forma do valor ajudam a ver o que foi colado, sem expor o conteúdo.
    const forma = bruto.startsWith('LS0tLS1CRUdJTi') ? 'começa certo, então foi cortado no fim' : 'não começa como um certificado em base64 (deveria começar com LS0tLS1CRUdJTi)';
    throw new Error(
      `PROXMOX_CA_B64 está definida, mas não contém um certificado: o valor tem ${bruto.length} caracteres (o esperado é perto de 2800) e ${forma}. ` +
      'Corrija o valor, ou defina PROXMOX_TLS_INSEGURO=true para o laboratório (aí a CA é ignorada).',
    );
  }
  const pem = corpos
    .map((c) => ['-----BEGIN CERTIFICATE-----', ...(c.match(/.{1,64}/g) ?? []), '-----END CERTIFICATE-----', ''].join('\n'))
    .join('');
  try {
    return { pem, nome: nomeDe(new X509Certificate(pem).subject) };
  } catch {
    throw new Error('PROXMOX_CA_B64 está definida, mas o certificado está corrompido (valor cortado na cópia?). Gere de novo com: base64 -w0 /etc/pve/pve-root-ca.pem.');
  }
}

/**
 * Explica uma falha de certificado: abre só o handshake TLS (nenhum pedido e nenhum token são
 * enviados) para ler quem emitiu o certificado do servidor e compara com a CA configurada.
 */
function diagnosticoTls(base: URL, codigo: string): Promise<string> {
  let ca: { nome: string } | undefined;
  try {
    ca = caConfigurada();
  } catch {
    ca = undefined;
  }
  const configurada = ca
    ? `A CA configurada em PROXMOX_CA_B64 é "${ca.nome}".`
    : 'PROXMOX_CA_B64 está vazia neste container (variável não definida, ou redeploy não feito depois de defini-la).';
  return new Promise((resolve) => {
    const pronto = (servidor: string) => resolve(`Certificado do Proxmox não confiável (${codigo}). ${servidor} ${configurada}`);
    const s = tls.connect({ host: base.hostname, port: Number(base.port) || 8006, rejectUnauthorized: false, timeout: 5000 }, () => {
      const c = s.getPeerCertificate();
      s.destroy();
      const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(', ') : v);
      const emissor = texto(c.issuer?.CN) ?? texto(c.issuer?.O) ?? 'desconhecido';
      const sujeito = texto(c.subject?.CN) ?? 'desconhecido';
      pronto(`O servidor apresentou o certificado "${sujeito}", emitido por "${emissor}".`);
    });
    s.on('timeout', () => { s.destroy(); pronto('Não foi possível ler o certificado do servidor.'); });
    s.on('error', () => pronto('Não foi possível ler o certificado do servidor.'));
  });
}
