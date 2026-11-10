import { http } from './http';

export interface BackupItem {
  id: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  status: 'ok' | 'erro';
  erro: string | null;
  criadoEm: string;
}

export interface StorageStatus {
  configurado: boolean;
  /** nomes (nunca valores) das variáveis de ambiente que faltam no servidor */
  faltando: string[];
  conectado: boolean;
  contaNome: string | null;
  conectadoEm: string | null;
  ultimoBackupEm: string | null;
  ultimoErro: string | null;
  automatico: boolean;
  retencao: number;
  backups: BackupItem[];
}

export const getStorageStatus = () => http.get<StorageStatus>('/storage/status').then((r) => r.data);

export const getConnectUrl = () =>
  http.get<{ url: string }>('/storage/onedrive/connect').then((r) => r.data.url);

export const disconnectOneDrive = () => http.post('/storage/onedrive/disconnect').then((r) => r.data);

// o upload do backup pode levar mais que o timeout padrão de 10 s
export const runBackup = () => http.post('/storage/backup', undefined, { timeout: 6 * 60_000 }).then((r) => r.data);
