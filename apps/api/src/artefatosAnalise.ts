import { createHash } from 'node:crypto';

export const hashArtefato = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
export const LIMITE_AMOSTRA = 8 * 1_048_576;

/** Leitura estática: padrões são pistas, nunca confirmação de família ou sucesso. */
export function analisarArtefato(conteudo: string, formato = 'texto') {
  const regras: [string, RegExp, string][] = [
    ['persistencia', /crontab|\/etc\/cron|authorized_keys|rc\.local|systemctl\s+enable|CurrentVersion\\Run|\.bashrc|\.profile/i, 'Configura execução recorrente ou acesso futuro; revise o destino e a linha que inicia o programa.'],
    ['transferencia', /\b(wget|curl|scp|tftp|Invoke-WebRequest|DownloadString)\b/i, 'Contém ferramentas de transferência; verifique URLs, destino e se há execução encadeada. O registro do comando não confirma que a transferência terminou.'],
    ['limpeza', /history\s+-c|HISTFILE|\brm\s+-[rf]|\bshred\b|Clear-EventLog/i, 'Há instruções compatíveis com remoção de arquivos ou histórico; examine o alvo antes de atribuir intenção.'],
    ['mineracao', /xmrig|stratum\+|minerd|cryptonight|supportxmr/i, 'Há indicadores textuais de mineração; confirme parâmetros, conexões e comportamento na evidência.'],
    ['reconhecimento', /\b(uname|whoami|lscpu|hostname|ifconfig|systeminfo|Get-ComputerInfo)\b/i, 'Consulta informações do sistema ou usuário, úteis para reconhecimento do ambiente.'],
    ['execucao', /chmod\s|\bnohup\b|\bbash\s|\bpowershell\b|\bpython\S*\s+-c|\/dev\/tcp\//i, 'Contém preparação ou invocação de programas; a execução bem-sucedida precisa ser confirmada por telemetria.'],
    ['carregamento', /LD_PRELOAD|ld\.so\.preload/i, 'Altera o carregamento de bibliotecas; pode interceptar funções e esconder artefatos. Verifique a biblioteca referenciada.'],
  ];
  const sinais = regras.filter(([, re]) => re.test(conteudo));
  return { categoria: sinais[0]?.[0] ?? (formato === 'elf' || formato === 'pe' ? 'binario' : 'outro'),
    resumo: sinais.length ? sinais.map(([, , explicacao]) => explicacao).join(' ')
      : formato === 'elf' || formato === 'pe' ? 'Binário identificado pelo coletor. Hash, strings e cabeçalho ajudam a triagem; não identificam sozinhos sua função ou família.'
        : 'Sem padrão reconhecido pela leitura estática. Revise o conteúdo e o contexto das ocorrências.',
  };
}

export function validarAmostra(base64: string, sha256: string): Buffer {
  if (!base64 || base64.length > Math.ceil(LIMITE_AMOSTRA / 3) * 4 || base64.length % 4 || /[^A-Za-z0-9+/=]/.test(base64)) throw new Error('Amostra inválida ou maior que 8 MB.');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.toString('base64') !== base64) throw new Error('Base64 inválido.');
  if (bytes.length > LIMITE_AMOSTRA || hashArtefato(bytes) !== sha256) throw new Error('SHA-256 não confere com a amostra.');
  return bytes;
}

export function previaAmostra(bytes: Buffer) {
  const binario = bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])) || bytes.subarray(0, 2).toString() === 'MZ' || bytes.subarray(0, 4096).includes(0);
  if (!binario) return { texto: bytes.subarray(0, 65536).toString('utf8'), modo: 'texto', truncado: bytes.length > 65536 };
  const strings = (bytes.subarray(0, 1_048_576).toString('latin1').match(/[\x20-\x7e]{6,}/g) ?? []).join('\n').slice(0, 60000);
  return { texto: `Cabeçalho (hex): ${bytes.subarray(0, 64).toString('hex')}\n\nStrings para triagem (não representam todo o binário):\n${strings}`, modo: 'strings', truncado: true };
}
