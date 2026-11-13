/**
 * Transforma uma mensagem de erro do Proxmox em algo legível para o agente e para a tela.
 *
 * Erros de tarefa do Proxmox chegam como um bloco único: a mensagem do plugin de armazenamento
 * (no LINSTOR/DRBD, um JSON com dezenas de eventos), seguida do rastro de pilha em Perl. O que
 * interessa é a última mensagem de erro de verdade, mais uma dica quando o caso é conhecido.
 */

/** Casos conhecidos: o que significa e o que fazer, em uma frase. */
const DICAS: { padrao: RegExp; dica: string }[] = [
  {
    padrao: /non-UpToDate DRBD device/i,
    dica: 'Uma réplica DRBD do disco não está sincronizada, e o LINSTOR só tira snapshot com todas em dia. Confira no nó com "linstor resource list -r <recurso>" e "drbdadm status <recurso>".',
  },
  { padrao: /VM is locked|CT is locked/i, dica: 'A VM está travada por outra operação (backup, snapshot ou migração). Espere terminar ou confira em Tasks no Proxmox.' },
  { padrao: /snapshot name .*already used|snapshot .*already exists/i, dica: 'Já existe um snapshot com esse nome. Use outro nome ou apague o antigo.' },
  { padrao: /not running/i, dica: 'A VM está desligada; essa ação só funciona com ela ligada.' },
  { padrao: /already running/i, dica: 'A VM já está ligada.' },
  { padrao: /no space left|not enough space|out of space/i, dica: 'Falta espaço no armazenamento da VM.' },
];

const MAX = 500;

export function resumirErroProxmox(bruto: string): string {
  let texto = bruto.replace(/\s+/g, ' ').trim();
  // corta o rastro de pilha em Perl: " at /usr/share/perl5/... line N."
  const pilha = texto.search(/ at \/usr\/(share|lib)\/perl/);
  if (pilha > 0) texto = texto.slice(0, pilha).trim();

  // LINSTOR: lista de eventos com ret_code; códigos negativos são erros. Fica a última mensagem de erro.
  const erros = [...texto.matchAll(/"ret_code":\s*(-\d+),\s*"message":\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[2]);
  let principal: string;
  if (erros.length > 0) {
    const ultimo = erros[erros.length - 1];
    const prefixo = /^(.*?)\[\{"ret_code"/.exec(texto)?.[1]?.replace(/,?\s*because:?\s*$/i, '').trim();
    principal = prefixo ? `${prefixo}: ${ultimo}` : ultimo;
  } else {
    principal = texto;
  }
  principal = principal.replace(/^TASK ERROR:\s*/i, '');
  if (principal.length > MAX) principal = `${principal.slice(0, MAX)}…`;

  const dica = DICAS.find((d) => d.padrao.test(bruto))?.dica;
  return dica ? `${principal} — ${dica}` : principal;
}
