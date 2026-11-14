import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Kpi, StatusStrip } from '@/components/InfraKit';
import { getStorageStatus, getConnectUrl, disconnectOneDrive, runBackup } from '@/services/armazenamento';
import { DestinoCard, DestinoDrawer } from './armazenamento/Destino';
import { Historico } from './armazenamento/Historico';
import { fmtData, fmtTam, resumoBackups, tomStatus } from './armazenamento/regras';
import '@/styles/telas/carreira.css';

type Msg = { sev: 'success' | 'error' | 'info'; texto: string };

export function Armazenamento() {
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['storage-status'], queryFn: getStorageStatus });
  const [ocupado, setOcupado] = useState<'conectar' | 'backup' | 'desconectar' | null>(null);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [destinoAberto, setDestinoAberto] = useState(false);

  // resultado do retorno da Microsoft (?conectado=1 / ?erro=autorizacao)
  const params = new URLSearchParams(window.location.search);
  const retorno = params.get('conectado') ? 'ok' : params.get('erro') ? 'erro' : null;

  const s = status.data;
  const r = resumoBackups(s?.backups ?? [], s?.retencao ?? 14);
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

  function desconectar() {
    confirmDialog({
      header: 'Desconectar o OneDrive',
      message: <span>Os backups já enviados continuam na sua conta, mas novos backups param.<br /><small className="iv-muted">Para revogar também na Microsoft, remova o app em account.microsoft.com/consent.</small></span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Desconectar', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: async () => {
        setOcupado('desconectar'); setMsg(null);
        try { await disconnectOneDrive(); setMsg({ sev: 'info', texto: 'OneDrive desconectado.' }); }
        catch { setMsg({ sev: 'error', texto: 'Falha ao desconectar.' }); }
        finally { setOcupado(null); refresh(); }
      },
    });
  }

  const acoes = !s?.conectado ? (
    <Button label="Conectar OneDrive" icon={ocupado === 'conectar' ? 'pi pi-spinner pi-spin' : 'pi pi-link'} onClick={conectar} disabled={!s?.configurado || ocupado !== null} />
  ) : (
    <>
      <Button label="Fazer backup agora" icon={ocupado === 'backup' ? 'pi pi-spinner pi-spin' : 'pi pi-cloud-upload'} onClick={backupAgora} disabled={ocupado !== null} />
      <Button label="Desconectar" icon="pi pi-times" severity="danger" text onClick={desconectar} disabled={ocupado !== null} />
    </>
  );

  return (
    <div>
      <ConfirmDialog />
      <PageHeader title="Armazenamento"
        subtitle="Cópia cifrada dos seus dados no OneDrive pessoal, fora do lab. Se a VM ou o Proxmox forem perdidos, o backup continua lá." />

      {status.isError && <Message severity="warn" className="ca-w100 ca-mb" text="API ou banco indisponível. Esta tela precisa do servidor (apps/api + PostgreSQL)." />}
      {retorno === 'ok' && <Message severity="success" className="ca-w100 ca-mb" text="OneDrive conectado." />}
      {retorno === 'erro' && <Message severity="error" className="ca-w100 ca-mb" text="A autorização com a Microsoft não foi concluída. Tente conectar de novo." />}
      {msg && <Message severity={msg.sev} className="ca-w100 ca-mb" text={msg.texto} />}

      <StatusStrip tone={status.isError ? 'warn' : tomStatus(s)} icon="pi-cloud">
        {status.isLoading ? 'Carregando…'
          : !s ? 'Sem resposta do servidor.'
          : !s.configurado ? 'Servidor ainda sem a configuração do OneDrive.'
          : !s.conectado ? 'OneDrive não conectado.'
          : s.ultimoErro ? <>Último erro: {s.ultimoErro}</>
          : s.ultimoBackupEm ? <>Último backup: <strong>{fmtData(s.ultimoBackupEm)}</strong></>
          : 'Conectado, mas ainda sem nenhum backup.'}
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Último envio" value={r.ultimoOk ? fmtData(r.ultimoOk.criadoEm).slice(0, 10) : '—'} hint={r.ultimoOk ? fmtData(r.ultimoOk.criadoEm).slice(11) : 'nenhum ainda'} />
        <Kpi label="Enviados" value={r.enviados} hint={`dos últimos ${s?.backups.length ?? 0} registros`} />
        <Kpi label="Com erro" value={r.falhas} tone="danger" hint="no histórico" />
        <Kpi label="Uso estimado" value={r.usoBytes ? fmtTam(r.usoBytes) : '—'} hint={`${s?.retencao ?? 14} cópias mantidas`} />
      </div>

      <DestinoCard s={s} erro={status.isError} selected={destinoAberto} onOpen={() => setDestinoAberto(true)} acoes={acoes} />
      {destinoAberto && s && <DestinoDrawer s={s} onClose={() => setDestinoAberto(false)} />}

      <Historico backups={s?.backups ?? []} retencao={s?.retencao ?? 14} />
    </div>
  );
}
