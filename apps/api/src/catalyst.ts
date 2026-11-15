import { Client } from 'ssh2';

/**
 * Cliente mínimo por SSH para o Catalyst 2960 (Cisco IOS), usado pelas ferramentas dos agentes.
 *
 * - Autentica por usuário e senha SSH (CATALYST_HOST, CATALYST_USER, CATALYST_PASSWORD) ou por
 *   chave privada (CATALYST_PRIVATE_KEY_B64, PEM em base64) — a senha fica só no servidor, o
 *   modelo nunca a vê, só o resultado dos comandos.
 * - Não existe uma "API" no Catalyst 2960: comandos são enviados por um canal `exec` em sessão
 *   de shell interativa (IOS pede confirmação em alguns comandos de configuração), lendo a saída
 *   até o prompt voltar. É mais frágil que uma API REST — por isso cada ferramenta de escrita
 *   manda o texto exato dos comandos (sem geração livre pelo modelo) e sempre confirma o running-config
 *   depois.
 * - Cada chamada abre e fecha a própria conexão SSH (sem pool): o volume de uso é baixo e isso
 *   evita manter sessão SSH aberta indefinidamente no processo da API.
 */

const VARIAVEIS = ['CATALYST_HOST', 'CATALYST_USER'] as const;

/** Nomes (não valores) das variáveis que faltam para falar com o switch. Senha OU chave, uma das duas. */
export function catalystFaltando(): string[] {
  const base: string[] = VARIAVEIS.filter((k) => !process.env[k]);
  if (!process.env.CATALYST_PASSWORD && !process.env.CATALYST_PRIVATE_KEY_B64) base.push('CATALYST_PASSWORD ou CATALYST_PRIVATE_KEY_B64');
  return base;
}

/**
 * Impressão digital (SHA256, base64 sem "=") da chave do switch na última conexão. O teste de
 * conexão mostra este valor para você fixar em CATALYST_HOST_KEY_SHA256.
 */
export let ultimaImpressaoDigital: string | null = null;

/** Marcador de fim de saída: um prompt IOS termina em #, >, ou (config...)# . */
const PROMPT_RE = /[\r\n][\w.-]+[>#]\s*$|[\r\n][\w.-]+\([\w-]*\)#\s*$/;

/**
 * Executa uma sequência de comandos IOS numa única sessão de shell e devolve a saída concatenada,
 * um bloco por comando. `enable` e o modo de configuração (quando precisos) devem estar na própria
 * lista de comandos — esta função não assume nenhum modo implícito.
 */
export function catalystExecutar(comandos: string[]): Promise<string> {
  const faltando = catalystFaltando();
  if (faltando.length > 0) {
    return Promise.reject(new Error(`Catalyst não configurado no servidor: falta definir ${faltando.join(' e ')}.`));
  }
  const host = process.env.CATALYST_HOST as string;
  const port = Number(process.env.CATALYST_PORT) || 22;
  const username = process.env.CATALYST_USER as string;
  const password = process.env.CATALYST_PASSWORD;
  let privateKey: Buffer | undefined;
  if (!password && process.env.CATALYST_PRIVATE_KEY_B64) {
    try {
      privateKey = Buffer.from(process.env.CATALYST_PRIVATE_KEY_B64, 'base64');
    } catch {
      return Promise.reject(new Error('CATALYST_PRIVATE_KEY_B64 não é um base64 válido.'));
    }
  }

  return new Promise((resolve, reject) => {
    const conn = new Client();
    let saida = '';
    const timeoutGeral = setTimeout(() => { conn.end(); reject(new Error('O Catalyst não respondeu em 30 segundos (rede, firewall, ou a sessão pediu algo não previsto).')); }, 30_000);

    conn.on('ready', () => {
      conn.shell({ term: 'vt100' }, (err, stream) => {
        if (err) { clearTimeout(timeoutGeral); conn.end(); return reject(new Error(`Falha ao abrir o shell SSH: ${err.message}`)); }

        // Sem paginação ("--More--"), e entra no modo privilegiado se houver senha de enable.
        const enable = process.env.CATALYST_ENABLE_PASSWORD;
        const fila = [...(enable ? ['enable'] : []), 'terminal length 0', ...comandos];
        let senhaEnviada = false;
        const enviarProximo = () => {
          const cmd = fila.shift();
          if (cmd === undefined) { clearTimeout(timeoutGeral); stream.end('exit\n'); return; }
          stream.write(`${cmd}\n`);
        };

        stream.on('data', (chunk: Buffer) => {
          saida += chunk.toString('utf8');
          if (enable && !senhaEnviada && /[\r\n]Password:\s*$/i.test(saida)) {
            senhaEnviada = true;
            stream.write(`${enable}\n`);
            return;
          }
          if (PROMPT_RE.test(saida)) enviarProximo();
        });
        stream.on('close', () => { clearTimeout(timeoutGeral); conn.end(); resolve(saida); });
        stream.stderr.on('data', (chunk: Buffer) => { saida += chunk.toString('utf8'); });
        // dá tempo do banner/prompt inicial chegar antes do primeiro comando
        setTimeout(enviarProximo, 500);
      });
    });
    conn.on('error', (err: Error & { level?: string }) => {
      clearTimeout(timeoutGeral);
      if (err.level === 'client-authentication') return reject(new Error('O Catalyst recusou as credenciais SSH (usuário/senha ou chave incorretos, ou "line vty" sem "login local").'));
      if (/verification failed/i.test(err.message)) {
        return reject(new Error(`A chave SSH do switch (SHA256:${ultimaImpressaoDigital ?? '?'}) não confere com CATALYST_HOST_KEY_SHA256. Nada foi enviado. Se o switch foi trocado ou reinstalado, atualize a variável.`));
      }
      reject(new Error(`Falha de conexão SSH com o Catalyst: ${err.message}`));
    });
    const fixada = process.env.CATALYST_HOST_KEY_SHA256?.trim().replace(/^SHA256:/, '').replace(/=+$/, '');
    conn.connect({
      host, port, username, password, privateKey,
      readyTimeout: 10_000,
      // Com a impressão digital configurada, só conversa com o switch certo (evita interceptação).
      hostHash: 'sha256',
      hostVerifier: (hash: string) => {
        ultimaImpressaoDigital = Buffer.from(hash, 'hex').toString('base64').replace(/=+$/, '');
        return !fixada || fixada === ultimaImpressaoDigital;
      },
      algorithms: {
        // IOS antigos (comum em 2960) só oferecem cifras/chaves que o ssh2 não habilita mais por
        // padrão; sem isto a conexão falha mesmo com credenciais corretas.
        kex: ['diffie-hellman-group14-sha1', 'diffie-hellman-group1-sha1', 'diffie-hellman-group-exchange-sha1'],
        cipher: ['aes128-cbc', '3des-cbc', 'aes128-ctr'],
        serverHostKey: ['ssh-rsa', 'ssh-dss'],
      },
    });
  });
}
