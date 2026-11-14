import { useState, type ChangeEvent } from 'react';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { confirmDialog } from 'primereact/confirmdialog';
import { downloadBackup, validateBackup, restoreBackup, MAX_BACKUP_BYTES, type BackupPreview } from '@/services/backup';
import { importarDoNavegador } from '@/services/migrate';
import { detectMode } from '@/services/mode';

type Msg = { sev: 'success' | 'error' | 'info'; text: string };

/** Backup local (arquivo) e restauração, mais a importação dos dados do navegador no servidor. */
export function BackupCard() {
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [fileText, setFileText] = useState('');
  const [msg, setMsg] = useState<Msg | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  async function sincronizarServidor() {
    setMsg(null);
    setSincronizando(true);
    try {
      if (await detectMode() !== 'servidor') {
        setMsg({ sev: 'error', text: 'Servidor indisponível. A API precisa estar no ar (npm run dev:api) ou deployada.' });
        return;
      }
      const r = await importarDoNavegador();
      const total = Object.values(r.imported).reduce((a, b) => a + b, 0);
      setMsg({ sev: 'success', text: `Importação concluída: ${total} registros processados. Repetir não cria cópias.` });
    } catch {
      setMsg({ sev: 'error', text: 'Falha ao sincronizar com o servidor.' });
    } finally {
      setSincronizando(false);
    }
  }

  function exportarBackup() {
    try {
      downloadBackup();
      setMsg({ sev: 'success', text: 'Backup exportado. Guarde o arquivo em local privado: ele contém a topologia do homelab.' });
    } catch (e) {
      setMsg({ sev: 'error', text: e instanceof Error ? e.message : 'Não foi possível exportar o backup.' });
    }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) return setPreview({ valid: false, error: 'O arquivo excede o limite de 25 MB.', keys: [], hasVault: false });
    const reader = new FileReader();
    reader.onload = () => { const text = String(reader.result); setFileText(text); setPreview(validateBackup(text)); setMsg(null); };
    reader.onerror = () => setPreview({ valid: false, error: 'Não foi possível ler o arquivo selecionado.', keys: [], hasVault: false });
    reader.readAsText(file);
  }

  function aplicar(mode: 'replace' | 'merge') {
    const r = restoreBackup(fileText, mode);
    if (r.valid) {
      setMsg({ sev: 'success', text: 'Backup restaurado. Recarregando...' });
      setTimeout(() => window.location.reload(), 900);
    } else {
      setMsg({ sev: 'error', text: r.error ?? 'Falha ao restaurar.' });
    }
  }

  function restaurar(mode: 'replace' | 'merge') {
    if (!preview?.valid) return;
    if (mode === 'merge') return aplicar('merge');
    confirmDialog({
      header: 'Substituir todos os dados locais',
      message: <span>Apagar os dados deste navegador e pôr os do backup no lugar? Não dá para desfazer.<br /><small className="iv-muted">Prefira <strong>Mesclar</strong> se só quer recuperar parte dos dados.</small></span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Substituir tudo', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: () => aplicar('replace'),
    });
  }

  return (
    <section className="iv-card iv-mt" aria-labelledby="ca-backup-titulo">
      <h3 id="ca-backup-titulo" className="ca-h3">Backup e restauração</h3>
      <p className="iv-muted ca-small">
        Exporta todos os dados locais (estudo, inventário, metas e o cofre já cifrado).
        Nenhum segredo sai em texto puro: o cofre vai como blob criptografado.
      </p>
      <Message severity="warn" className="ca-w100 ca-mb"
        text="O backup local contém também a topologia do seu homelab em texto legível. Guarde o arquivo em local privado e não o publique." />

      <div className="iv-row iv-wrap">
        <Button label="Exportar backup" icon="pi pi-download" onClick={exportarBackup} />
        <label className="p-button p-component p-button-outlined ca-file">
          <span className="p-button-icon p-button-icon-left pi pi-upload" aria-hidden="true" />
          <span className="p-button-label">Restaurar de arquivo…</span>
          <input type="file" accept="application/json,.json" className="ca-file__input" onChange={onFile} />
        </label>
        <Button label="Importar no servidor" icon={sincronizando ? 'pi pi-spinner pi-spin' : 'pi pi-cloud-upload'} severity="secondary" outlined
          onClick={sincronizarServidor} disabled={sincronizando} tooltip="Mescla os dados deste navegador no PostgreSQL; repetir não cria cópias" />
      </div>

      {preview && (
        <div className="iv-mt">
          {preview.valid ? (
            <>
              <Message severity="info" className="ca-w100"
                text={`Backup válido (v${preview.version}, de ${preview.exportedAt?.slice(0, 10)}). ${preview.keys.length} conjuntos de dados${preview.hasVault ? ', incluindo o cofre cifrado' : ''}.`} />
              <div className="iv-row iv-wrap iv-mt">
                <Button label="Mesclar" icon="pi pi-plus" onClick={() => restaurar('merge')} />
                <Button label="Substituir tudo" icon="pi pi-replay" severity="danger" outlined onClick={() => restaurar('replace')} />
              </div>
              <p className="iv-muted ca-small ca-mb0">"Mesclar" sobrescreve só as chaves do arquivo. "Substituir" apaga os dados atuais antes de importar.</p>
            </>
          ) : (
            <Message severity="error" className="ca-w100" text={preview.error} />
          )}
        </div>
      )}

      {msg && <Message severity={msg.sev} className="ca-msg" text={msg.text} />}
    </section>
  );
}
