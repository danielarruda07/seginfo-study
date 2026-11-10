import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { Kpi, StatusStrip, Pill } from '@/components/InfraKit';
import {
  getStorageStatus, getConnectUrl, disconnectOneDrive, runBackup, type BackupItem,
} from '@/services/armazenamento';

const fmtData = (iso: string | null) => (iso ? iso.replace('T', ' ').slice(0, 16) + ' UTC' : '—');
const fmtTam = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function Armazenamento() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['storage-status'], queryFn: getStorageStatus });
  const [ocupado, setOcupado] = useState<'conectar' | 'backup' | 'desconectar' | null>(null);
  const [msg, setMsg] = useState<{ sev: 'success' | 'error' | 'info'; texto: string } | null>(null);

  // resultado do retorno da Microsoft (?conectado=1 / ?erro=autorizacao)
  const params = new URLSearchParams(window.location.search);
  const retorno = params.get('conectado') ? 'ok' : params.get('erro') ? 'erro' : null;

  const s = status.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ['storage-status'] });

  async function conectar() {
    setOcupado('conectar'); setMsg(null);
    try {
      const url = await getConnectUrl();
      // só navega para o login da Microsoft; qualquer outro destino é recusado
      if (!url.startsWith('https://login.microsoftonline.com/')) throw new Error('URL de autorização inesperada.');
      window.location.assign(url);
    } catch (e) {
      setMsg({ sev: 'error', texto: e instanceof Error ? e.message : 'Não foi possível iniciar a conexão.' });
      setOcupado(null);
    }
  }

  async function backupAgora() {
    setOcupado('backup'); setMsg(null);
    try {
      await runBackup();
      setMsg({ sev: 'success', texto: 'Backup cifrado enviado ao OneDrive.' });
    } catch (e) {
      const erro = (e as { response?: { data?: { error?: string } } }).response?.data?.error;
      setMsg({ sev: 'error', texto: erro ?? 'Falha ao executar o backup.' });
    } finally {
      setOcupado(null);
      refresh();
    }
  }

  async function desconectar() {
    if (!window.confirm('Desconectar o OneDrive? Os backups já enviados continuam na sua conta.')) return;
    setOcupado('desconectar'); setMsg(null);
    try {
      await disconnectOneDrive();
      setMsg({ sev: 'info', texto: 'OneDrive desconectado. Para revogar o acesso também na Microsoft, remova o app em account.microsoft.com/consent.' });
    } catch {
      setMsg({ sev: 'error', texto: 'Falha ao desconectar.' });
    } finally {
      setOcupado(null);
      refresh();
    }
  }

  const tone = !s ? 'ok' : !s.configurado ? 'warn' : !s.conectado ? 'warn' : s.ultimoErro ? 'crit' : s.ultimoBackupEm ? 'ok' : 'warn';

  return (
    <div>
      <PageHeader
        title="Armazenamento"
        subtitle="Cópia cifrada dos seus dados no OneDrive pessoal, fora do lab. Se a VM ou o Proxmox forem perdidos, o backup continua lá."
      />

      {status.isError && (
        <Message severity="warn" style={{ width: '100%', marginBottom: '1rem' }}
          text="API ou banco indisponível. Esta tela precisa do servidor (apps/api + PostgreSQL)." />
      )}
      {retorno === 'ok' && <Message severity="success" style={{ width: '100%', marginBottom: '1rem' }} text="OneDrive conectado." />}
      {retorno === 'erro' && <Message severity="error" style={{ width: '100%', marginBottom: '1rem' }} text="A autorização com a Microsoft não foi concluída. Tente conectar de novo." />}
      {msg && <Message severity={msg.sev} style={{ width: '100%', marginBottom: '1rem' }} text={msg.texto} />}

      <StatusStrip tone={tone} icon="pi-cloud">
        {!s ? 'Carregando…'
          : !s.configurado ? 'Servidor ainda sem a configuração do OneDrive.'
          : !s.conectado ? 'OneDrive não conectado.'
          : s.ultimoErro ? <>Último erro: {s.ultimoErro}</>
          : s.ultimoBackupEm ? <>Último backup: <strong>{fmtData(s.ultimoBackupEm)}</strong></>
          : 'Conectado, mas ainda sem nenhum backup.'}
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Conta" value={s?.conectado ? (s.contaNome ?? 'Conectada') : '—'} hint={s?.conectado ? `desde ${fmtData(s.conectadoEm)}` : 'não conectada'} />
        <Kpi label="Backup automático" value={s?.automatico ? 'Ligado' : 'Desligado'} hint="a cada 24 h" />
        <Kpi label="Retenção" value={s?.retencao ?? 14} hint="backups mantidos" />
        <Kpi label="Enviados" value={s?.backups.filter((b) => b.status === 'ok').length ?? 0} hint="últimos 20 registros" />
      </div>

      {s && !s.configurado && (
        <div className="iv-card iv-mt">
          <h4 style={{ margin: '0 0 .5rem' }}>Configuração pendente no servidor</h4>
          <p className="iv-muted" style={{ marginTop: 0, fontSize: '.88rem' }}>
            Defina estas variáveis no Coolify (guia: <code>docs/ARMAZENAMENTO.md</code>) e faça redeploy:
          </p>
          <div className="iv-row iv-wrap">{s.faltando.map((v) => <Pill key={v} label={v} color="#f59e0b" />)}</div>
        </div>
      )}

      <div className="iv-card iv-mt">
        <div className="iv-row iv-wrap">
          {!s?.conectado ? (
            <Button label="Conectar OneDrive" icon={ocupado === 'conectar' ? 'pi pi-spinner pi-spin' : 'pi pi-link'}
              onClick={conectar} disabled={!s?.configurado || ocupado !== null} />
          ) : (
            <>
              <Button label="Fazer backup agora" icon={ocupado === 'backup' ? 'pi pi-spinner pi-spin' : 'pi pi-cloud-upload'}
                onClick={backupAgora} disabled={ocupado !== null} />
              <Button label="Desconectar" icon="pi pi-times" severity="danger" outlined
                onClick={desconectar} disabled={ocupado !== null} />
            </>
          )}
        </div>
        <p className="iv-muted" style={{ fontSize: '.8rem', marginBottom: 0 }}>
          O app só enxerga a própria pasta <code>/Apps</code> do seu OneDrive (permissão <code>Files.ReadWrite.AppFolder</code>).
          Os arquivos são cifrados antes de sair do servidor, que guarda só a chave pública.
        </p>
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .6rem' }}>Histórico de backups</h4>
        <DataTable value={s?.backups ?? []} dataKey="id" emptyMessage="Nenhum backup ainda." paginator rows={10}>
          <Column header="Quando (UTC)" style={{ width: 180 }} body={(b: BackupItem) => fmtData(b.criadoEm)} />
          <Column header="Arquivo" body={(b: BackupItem) => <span style={{ fontFamily: 'monospace' }}>{b.nomeArquivo}</span>} />
          <Column header="Tamanho" style={{ width: 110 }} body={(b: BackupItem) => (b.status === 'ok' ? fmtTam(b.tamanhoBytes) : '—')} />
          <Column header="Status" style={{ width: 120 }} body={(b: BackupItem) => (
            <Pill label={b.status === 'ok' ? 'enviado' : 'erro'} color={b.status === 'ok' ? '#16a34a' : '#ef4444'} />
          )} />
          <Column header="Detalhe" field="erro" />
        </DataTable>
      </div>
    </div>
  );
}
