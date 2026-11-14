import type { BackupItem, StorageStatus } from '@/services/armazenamento';

/** Regras puras da tela Armazenamento. Testes em regras.test.ts. */

export const fmtData = (iso: string | null | undefined) => (iso ? `${iso.replace('T', ' ').slice(0, 16)} UTC` : '—');

export function fmtTam(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** Tom da faixa de estado: sem config ou sem conexão pede ação; erro é crítico. */
export function tomStatus(s: StorageStatus | undefined): 'ok' | 'warn' | 'crit' {
  if (!s) return 'ok';
  if (!s.configurado || !s.conectado) return 'warn';
  if (s.ultimoErro) return 'crit';
  return s.ultimoBackupEm ? 'ok' : 'warn';
}

export interface ResumoBackups {
  enviados: number;
  falhas: number;
  /** soma dos backups enviados que ainda estão dentro da retenção (estimativa do uso no OneDrive) */
  usoBytes: number;
  ultimoOk: BackupItem | null;
  ultimaFalha: BackupItem | null;
}

const recentes = (backups: BackupItem[]) => [...backups].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

export function resumoBackups(backups: BackupItem[], retencao: number): ResumoBackups {
  const ord = recentes(backups);
  const ok = ord.filter((b) => b.status === 'ok');
  return {
    enviados: ok.length,
    falhas: ord.length - ok.length,
    usoBytes: ok.slice(0, retencao).reduce((t, b) => t + b.tamanhoBytes, 0),
    ultimoOk: ok[0] ?? null,
    ultimaFalha: ord.find((b) => b.status === 'erro') ?? null,
  };
}

/** Onde o backup está em relação à retenção: o que o servidor ainda guarda no OneDrive. */
export function situacaoNaRetencao(backups: BackupItem[], id: string, retencao: number): string {
  const ok = recentes(backups).filter((b) => b.status === 'ok');
  const b = backups.find((x) => x.id === id);
  if (!b) return '';
  if (b.status !== 'ok') return 'Não foi enviado: nada deste backup está no OneDrive.';
  const pos = ok.findIndex((x) => x.id === id) + 1;
  if (pos === 1) return `É o mais recente. Fica no OneDrive enquanto estiver entre os ${retencao} últimos.`;
  return pos <= retencao
    ? `${pos}º mais recente de ${retencao} mantidos: ainda está no OneDrive.`
    : `${pos}º mais recente: passou da retenção (${retencao}) e provavelmente já foi apagado do OneDrive.`;
}
