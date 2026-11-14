import type { RadarEvento } from '@/services/radar';

/**
 * Leitura da sessão de um atacante no honeypot (regras puras): classifica cada comando pela
 * intenção mais provável e resume o que aconteceu do primeiro contato até a última ação.
 */

export type Etapa =
  | 'reconhecimento' | 'credencial' | 'download' | 'execucao' | 'persistencia'
  | 'limpeza' | 'mineracao' | 'evasao' | 'outro';

export const ETAPA: Record<Etapa, { rotulo: string; cor: string; dica: string }> = {
  reconhecimento: { rotulo: 'reconhecimento', cor: '#0ea5e9', dica: 'Descobre que máquina é essa: sistema, CPU, memória, usuário, uptime.' },
  credencial: { rotulo: 'privilégio', cor: '#f59e0b', dica: 'Tenta virar root (sudo com a senha descoberta) ou mexer em senhas e usuários.' },
  download: { rotulo: 'download', cor: '#b91c1c', dica: 'Traz o próximo estágio: envia o arquivo por SCP/SFTP ou busca na internet (wget, curl). Pela internet falha: o range não tem saída.' },
  execucao: { rotulo: 'execução', cor: '#dc2626', dica: 'Dá permissão e roda um arquivo (o malware em si).' },
  persistencia: { rotulo: 'persistência', cor: '#7c3aed', dica: 'Garante a volta: crontab, chave SSH, serviço, rc.local.' },
  limpeza: { rotulo: 'limpeza', cor: '#64748b', dica: 'Apaga rastros: o próprio arquivo, histórico, logs.' },
  mineracao: { rotulo: 'mineração', cor: '#a16207', dica: 'Sinais de minerador de criptomoeda (xmrig, stratum, pool).' },
  evasao: { rotulo: 'teste anti-honeypot', cor: '#0f766e', dica: 'Confere se o shell é real (aritmética, $$, /proc, subshell) antes de agir.' },
  outro: { rotulo: 'outro', cor: '#94a3b8', dica: '' },
};

// Ordem importa: o primeiro padrão que casa define a etapa (o mais grave primeiro). `sudo` vem
// depois de execução e limpeza porque é só o veículo: o que conta é o que ele manda rodar.
const REGRAS: [Etapa, RegExp][] = [
  ['mineracao', /xmrig|minerd|stratum\+tcp|cryptonight|monero|nicehash|--donate-level|c3pool|supportxmr/i],
  ['persistencia', /crontab|\/etc\/cron|authorized_keys|systemctl\s+(enable|daemon-reload)|\/etc\/systemd|rc\.local|\.bashrc|\/etc\/init\.d|useradd|adduser/i],
  ['download', /\b(wget|curl|tftp|ftpget|scp|busybox\s+(wget|tftp))\b|\/dev\/tcp\//i],
  ['execucao', /chmod\s+(\+x|[0-7]*[1357][0-7]*\b)|\bnohup\b|\bperl\s+-e|\bpython[\d.]*\s+-c|(?:^|[;&|]|sudo\s+(?:-\S+\s+)*|sh\s+-c\s+)\s*['"\\]*\.{0,2}\/(?!dev\/null)[\w./-]+['"\\]*\s*(?:$|[;&|])/i],
  ['limpeza', /\brm\s+-[rf]+|history\s+-c|unset\s+HISTFILE|HISTFILE=\/dev\/null|\/var\/log|shred\b/i],
  ['credencial', /\bsudo\b|\bpasswd\b|chpasswd|\/etc\/shadow|\bsu\s+-?\s*root\b/i],
  ['evasao', /\$\(\(|\$\$|\/proc\/self|echo\s+\$\(\(|\bfunction\b|^\s*\(\s*\w/i],
  ['reconhecimento', /\b(uname|nproc|lscpu|cpuinfo|meminfo|free|uptime|whoami|id|hostname|ifconfig|ip\s+a|w|last|df|ps|top|lspci|dmidecode|cat\s+\/etc\/(os-release|issue))\b|export\s+PATH/i],
];

export function etapaDoComando(cmd: string): Etapa {
  for (const [etapa, re] of REGRAS) if (re.test(cmd)) return etapa;
  return 'outro';
}

export interface ResumoSessao {
  inicio: string | null;
  fim: string | null;
  duracaoSeg: number;
  tentativasLogin: number;
  loginAceito: { usuario: string | null; quando: string } | null;
  comandos: number;
  arquivos: { nome: string; sha256: string | null; quando: string }[];
  tuneis: string[];
  etapas: Etapa[];
}

const str = (d: Record<string, unknown> | undefined, k: string) => (typeof d?.[k] === 'string' ? (d[k] as string) : null);

/** Resume a sessão: tempo, logins, comandos, arquivos enviados, túneis e etapas na ordem em que apareceram. */
export function resumirSessao(eventos: RadarEvento[]): ResumoSessao {
  const ord = [...eventos].sort((a, b) => a.ocorridoEm.localeCompare(b.ocorridoEm));
  const inicio = ord[0]?.ocorridoEm ?? null;
  const fim = ord.at(-1)?.ocorridoEm ?? null;
  const etapas: Etapa[] = [];
  const marcar = (e: Etapa) => { if (!etapas.includes(e)) etapas.push(e); };
  const r: ResumoSessao = {
    inicio, fim,
    duracaoSeg: inicio && fim ? Math.round((Date.parse(fim) - Date.parse(inicio)) / 1000) : 0,
    tentativasLogin: 0, loginAceito: null, comandos: 0, arquivos: [], tuneis: [], etapas,
  };
  for (const e of ord) {
    if (e.acao === 'login_falha') r.tentativasLogin++;
    else if (e.acao === 'login_ok') { r.tentativasLogin++; r.loginAceito ??= { usuario: e.usuarioTentado, quando: e.ocorridoEm }; }
    else if (e.acao === 'comando') {
      r.comandos++;
      const c = str(e.detalhes, 'comando');
      if (c) { const et = etapaDoComando(c); if (et !== 'outro') marcar(et); }
    } else if (e.acao === 'download') {
      r.arquivos.push({ nome: str(e.detalhes, 'url') ?? '(sem nome)', sha256: str(e.detalhes, 'sha256'), quando: e.ocorridoEm });
      marcar('download');
    } else if (e.acao === 'tunel') {
      const dest = str(e.detalhes, 'destino');
      if (dest && !r.tuneis.includes(dest)) r.tuneis.push(dest);
    }
  }
  return r;
}

export function duracaoTexto(seg: number): string {
  if (seg < 60) return `${seg} s`;
  const m = Math.floor(seg / 60);
  return m < 60 ? `${m} min ${seg % 60} s` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
