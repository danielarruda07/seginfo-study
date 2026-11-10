import { useCallback, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Password } from 'primereact/password';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusStrip } from '@/components/InfraKit';
import type { VaultEntry } from '@seginfo/shared';
import * as vault from '@/services/vault';
import { useVaultActivity } from '@/hooks/useVaultActivity';
import { downloadBackup, validateBackup, restoreBackup, MAX_BACKUP_BYTES, type BackupPreview } from '@/services/backup';
import { copySensitiveToClipboard } from '@/lib/clipboard';
import { importarDoNavegador } from '@/services/migrate';
import { detectMode } from '@/services/mode';
import { listAtivos } from '@/services/inventario';

/** Campo de senha padrão do Cofre (sem medidor de força, com botão de mostrar). */
function SecretInput({ value, onChange, placeholder, onKeyDown }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <Password
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      toggleMask
      feedback={false}
      inputStyle={{ width: '100%' }}
      style={{ width: '100%' }}
    />
  );
}

function senhaMestraScore(senha: string): number {
  if (!senha) return 0;
  return [senha.length >= 12, senha.length >= 16, /[a-z]/.test(senha), /[A-Z]/.test(senha), /\d/.test(senha), /[^a-zA-Z0-9]/.test(senha)]
    .filter(Boolean).length;
}

export function Cofre() {
  const [initialized, setInitialized] = useState(vault.isInitialized());
  const [unlocked, setUnlocked] = useState(vault.isUnlocked());
  const [erro, setErro] = useState('');
  const [master, setMaster] = useState('');
  const [master2, setMaster2] = useState('');

  // Auto-lock: quando o cofre travar sozinho (inatividade ou aba oculta),
  // atualiza a UI de volta para a tela de destravar.
  const handleAutoLock = useCallback(() => {
    setUnlocked(false);
    setErro('Cofre travado automaticamente por inatividade.');
  }, []);
  useVaultActivity(unlocked, handleAutoLock);

  async function criar() {
    setErro('');
    if (master.length < 12) return setErro('Use uma senha-mestra com pelo menos 12 caracteres.');
    if (master !== master2) return setErro('As senhas não conferem.');
    await vault.initVault(master);
    setMaster(''); setMaster2('');
    setInitialized(true); setUnlocked(true);
  }

  async function destravar() {
    setErro('');
    const ok = await vault.unlock(master);
    if (!ok) { const seconds = vault.unlockWaitSeconds(); return setErro(`Senha-mestra incorreta.${seconds ? ` Aguarde ${seconds} s antes da próxima tentativa.` : ''}`); }
    setMaster('');
    setUnlocked(true);
  }

  function travar() {
    vault.lock();
    setUnlocked(false);
  }

  return (
    <div>
      <PageHeader
        title="Cofre de Credenciais"
        subtitle="Suas senhas cifradas com AES-GCM. A senha-mestra nunca é salva — sem ela, o cofre é ilegível."
      />

      <StatusStrip tone={unlocked ? 'ok' : 'warn'} icon={unlocked ? 'pi-unlock' : 'pi-lock'}>
        {unlocked ? 'Cofre destravado nesta sessão.' : initialized ? 'Cofre travado. Informe a senha-mestra.' : 'Nenhum cofre ainda. Crie uma senha-mestra.'}
      </StatusStrip>

      {!unlocked && (
        <div className="iv-card iv-mt" style={{ maxWidth: 460 }}>
          {erro && <Message severity="error" text={erro} className="iv-mt" style={{ width: '100%', marginBottom: '1rem' }} />}
          {!initialized ? (
            <div className="iv-col iv-gap">
              <h3 style={{ margin: 0 }}>Criar cofre</h3>
              <p className="iv-muted" style={{ margin: 0, fontSize: '.85rem' }}>
                Use uma frase-senha com pelo menos 12 caracteres. Ela protege tudo e não pode ser recuperada se esquecida.
              </p>
              <SecretInput value={master} onChange={setMaster} placeholder="Senha-mestra" />
              <div className="vault-strength" aria-live="polite">
                <div className="vault-strength__track" role="progressbar" aria-label="Força da frase-senha"
                  aria-valuemin={0} aria-valuemax={6} aria-valuenow={senhaMestraScore(master)}>
                  <span style={{ width: `${(senhaMestraScore(master) / 6) * 100}%` }} />
                </div>
                <span className="iv-muted">{!master ? 'Mínimo 12 caracteres; uma frase longa é mais fácil de lembrar.' : senhaMestraScore(master) >= 5 ? 'Boa frase-senha' : 'Adicione comprimento e variedade.'}</span>
              </div>
              <SecretInput value={master2} onChange={setMaster2} placeholder="Confirmar senha-mestra" />
              <Button label="Criar cofre" icon="pi pi-lock" onClick={criar} />
            </div>
          ) : (
            <div className="iv-col iv-gap">
              <h3 style={{ margin: 0 }}>Destravar</h3>
              <SecretInput value={master} onChange={setMaster} placeholder="Senha-mestra" onKeyDown={(e) => e.key === 'Enter' && destravar()} />
              <Button label="Destravar cofre" icon="pi pi-unlock" onClick={destravar} />
            </div>
          )}
        </div>
      )}

      {unlocked && <VaultManager onLock={travar} />}

      <BackupCard />
    </div>
  );
}

function VaultManager({ onLock }: { onLock: () => void }) {
  const [entries, setEntries] = useState<VaultEntry[]>(vault.listEntries());
  const [editing, setEditing] = useState<(Partial<VaultEntry> & { secret?: string }) | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const [autoLock, setAutoLock] = useState<number>(vault.getAutoLockMinutes());

  function refresh() { setEntries(vault.listEntries()); }

  async function salvar() {
    if (!editing?.titulo?.trim()) return;
    await vault.saveEntry({
      id: editing.id,
      titulo: editing.titulo!,
      usuario: editing.usuario ?? '',
      url: editing.url ?? '',
      ambiente: editing.ambiente,
      ativoId: editing.ativoId,
      notas: editing.notas ?? '',
      secret: editing.secret ?? '',
    });
    setEditing(null);
    refresh();
  }
  async function excluir(id: string) {
    await vault.removeEntry(id);
    refresh();
  }

  function alterarAutoLock(min: number) {
    setAutoLock(min);
    vault.setAutoLockMinutes(min);
  }

  return (
    <div>
      <div className="iv-row iv-wrap iv-mt" style={{ justifyContent: 'space-between' }}>
        <Button label="Nova credencial" icon="pi pi-plus" onClick={() => setEditing({ titulo: '', usuario: '', url: '', notas: '', secret: '' })} />
        <div className="iv-row iv-wrap">
          <span className="iv-muted" style={{ fontSize: '.82rem' }}>Travar após</span>
          <InputNumber value={autoLock} onValueChange={(e) => alterarAutoLock(e.value ?? 0)} suffix=" min" min={0} max={120} showButtons style={{ width: 130 }} />
          <Button label="Travar agora" icon="pi pi-lock" outlined severity="secondary" onClick={onLock} />
        </div>
      </div>
      <p className="iv-muted" style={{ fontSize: '.78rem', marginTop: '.5rem' }}>
        Trava automática por inatividade (0 = desligada). O cofre também trava ao ocultar a aba.
      </p>

      {editing && (
        <div className="iv-card iv-mt" style={{ maxWidth: 520 }}>
          <h3 style={{ marginTop: 0 }}>{editing.id ? 'Editar' : 'Nova'} credencial</h3>
          <div className="iv-col iv-gap">
            <InputText value={editing.titulo ?? ''} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} placeholder="Título (ex: FortiGate FG-LAB)" />
            <InputText value={editing.usuario ?? ''} onChange={(e) => setEditing({ ...editing, usuario: e.target.value })} placeholder="Usuário" />
            <SecretInput value={editing.secret ?? ''} onChange={(secret) => setEditing({ ...editing, secret })} placeholder="Senha / segredo" />
            <InputText value={editing.url ?? ''} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="URL / host" />
            <Dropdown value={editing.ativoId} options={listAtivos({ rows: 1000 }).items.map((a) => ({ label: `${a.nome}${a.endereco ? ` · ${a.endereco}` : ''}`, value: a.id }))} onChange={(e) => setEditing({ ...editing, ativoId: e.value, ambiente: 'criecomia' })} placeholder="Ativo relacionado (opcional)" showClear filter />
            <InputTextarea value={editing.notas ?? ''} onChange={(e) => setEditing({ ...editing, notas: e.target.value })} rows={2} placeholder="Notas" />
            <div className="iv-row">
              <Button label="Salvar" icon="pi pi-save" onClick={salvar} />
              <Button label="Cancelar" text onClick={() => setEditing(null)} />
            </div>
          </div>
        </div>
      )}

      <div className="iv-col iv-gap iv-mt">
        {entries.length === 0 && <p className="iv-muted">Cofre vazio. Adicione sua primeira credencial.</p>}
        {entries.map((e) => (
          <div key={e.id} className="iv-card">
            <div className="iv-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{e.titulo}</strong>
                {e.usuario && <span className="iv-muted"> · {e.usuario}</span>}
                {e.url && <div className="iv-muted" style={{ fontSize: '.82rem' }}>{e.url}</div>}
                {e.ativoId && <div className="iv-muted" style={{ fontSize: '.78rem' }}>Vinculado a: {listAtivos({ rows: 1000 }).items.find((a) => a.id === e.ativoId)?.nome ?? 'ativo removido'}</div>}
              </div>
              <div className="iv-row">
                <span className="vault-secret-preview" aria-label={revealed[e.id] ? 'Segredo revelado' : 'Segredo oculto'}>
                  {revealed[e.id] ? vault.getSecret(e.id) || '(vazio)' : '••••••••'}
                </span>
                <Button icon={revealed[e.id] ? 'pi pi-eye-slash' : 'pi pi-eye'} text aria-label={revealed[e.id] ? 'Ocultar segredo' : 'Revelar segredo'} onClick={() => setRevealed({ ...revealed, [e.id]: !revealed[e.id] })} />
                <Button icon="pi pi-copy" text aria-label="Copiar segredo" onClick={() => { void copySensitiveToClipboard(vault.getSecret(e.id)); }} tooltip="Copiar segredo (tenta limpar após 30 s)" />
                <Button icon="pi pi-pencil" text onClick={() => setEditing({ ...e, secret: vault.getSecret(e.id) })} />
                <Button icon="pi pi-trash" text severity="danger" onClick={() => excluir(e.id)} />
              </div>
            </div>
            {e.notas && <p className="iv-muted" style={{ margin: '.5rem 0 0', fontSize: '.84rem' }}>{e.notas}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function BackupCard() {
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [fileText, setFileText] = useState<string>('');
  const [msg, setMsg] = useState<{ sev: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  async function sincronizarServidor() {
    setMsg(null);
    setSincronizando(true);
    try {
      const mode = await detectMode();
      if (mode !== 'servidor') {
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
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) {
      setPreview({ valid: false, error: 'O arquivo excede o limite de 25 MB.', keys: [], hasVault: false });
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      setFileText(text);
      setPreview(validateBackup(text));
      setMsg(null);
    };
    reader.onerror = () => setPreview({ valid: false, error: 'Não foi possível ler o arquivo selecionado.', keys: [], hasVault: false });
    reader.readAsText(file);
  }

  function restaurar(mode: 'replace' | 'merge') {
    if (!preview?.valid) return;
    if (mode === 'replace' && !window.confirm('Substituir todos os dados locais deste navegador pelos dados do backup? Esta ação não pode ser desfeita.')) return;
    const r = restoreBackup(fileText, mode);
    if (r.valid) {
      setMsg({ sev: 'success', text: 'Backup restaurado. Recarregando...' });
      setTimeout(() => window.location.reload(), 900);
    } else {
      setMsg({ sev: 'error', text: r.error ?? 'Falha ao restaurar.' });
    }
  }

  return (
    <div className="iv-card iv-mt">
      <h3 style={{ marginTop: 0 }}>Backup & Restauração</h3>
      <p className="iv-muted" style={{ marginTop: 0, fontSize: '.85rem' }}>
        Exporta todos os dados locais (estudo, inventário, metas e o cofre já cifrado).
        Nenhum segredo sai em texto puro: o cofre é incluído como blob criptografado.
      </p>
      <Message severity="warn" style={{ width: '100%', marginBottom: '1rem' }}
        text="O backup local contém também a topologia do seu homelab em texto legível. Guarde o arquivo em local privado e não o publique." />

      <div className="iv-row iv-wrap">
        <Button label="Exportar backup" icon="pi pi-download" onClick={exportarBackup} />
        <label className="p-button p-component p-button-outlined" style={{ cursor: 'pointer' }}>
          <span className="p-button-icon p-button-icon-left pi pi-upload" />
          <span className="p-button-label">Escolher arquivo...</span>
          <input type="file" accept="application/json,.json" hidden onChange={onFile} />
        </label>
        <Button label="Importar no servidor" icon={sincronizando ? 'pi pi-spinner pi-spin' : 'pi pi-cloud-upload'} severity="secondary" outlined onClick={sincronizarServidor} disabled={sincronizando} tooltip="Mescla os dados deste navegador no PostgreSQL; repetir não cria cópias" />
      </div>

      {preview && (
        <div className="iv-mt">
          {preview.valid ? (
            <>
              <Message severity="info" style={{ width: '100%' }}
                text={`Backup válido (v${preview.version}, de ${preview.exportedAt?.slice(0, 10)}). ${preview.keys.length} conjuntos de dados${preview.hasVault ? ', incluindo o cofre cifrado' : ''}.`} />
              <div className="iv-row iv-wrap iv-mt">
                <Button label="Restaurar (substituir tudo)" icon="pi pi-replay" severity="danger" onClick={() => restaurar('replace')} />
                <Button label="Mesclar" icon="pi pi-plus" outlined onClick={() => restaurar('merge')} />
              </div>
        <p className="iv-muted" style={{ fontSize: '.78rem' }}>
                "Substituir" apaga os dados atuais antes de importar. "Mesclar" sobrescreve só as chaves do arquivo.
              </p>
            </>
          ) : (
            <Message severity="error" style={{ width: '100%' }} text={preview.error} />
          )}
        </div>
      )}

      {msg && <Message severity={msg.sev} style={{ width: '100%', marginTop: '1rem' }} text={msg.text} />}
    </div>
  );
}
