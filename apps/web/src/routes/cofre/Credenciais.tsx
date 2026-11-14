import { useMemo, useState, type ChangeEvent } from 'react';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { confirmDialog } from 'primereact/confirmdialog';
import type { VaultEntry } from '@seginfo/shared';
import { ClickCard } from '@/components/ui/ClickCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyState, Pill } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { copySensitiveToClipboard } from '@/lib/clipboard';
import * as vault from '@/services/vault';
import { listAtivos } from '@/services/inventario';
import { todayISO } from '@/services/store';
import { CredencialDrawer } from './CredencialDrawer';
import { CredencialForm, type Rascunho } from './CredencialForm';
import { estadoTeste, filtrarCredenciais } from './regras';

/** Metadados para salvar de novo sem perder o segredo (montado campo a campo: nada extra vaza). */
const paraSalvar = (e: VaultEntry, extra: Partial<VaultEntry> = {}) => ({
  id: e.id, titulo: e.titulo, usuario: e.usuario, url: e.url, ambiente: e.ambiente, ativoId: e.ativoId, notas: e.notas,
  confirmadoEm: e.confirmadoEm, ...extra, secret: vault.getSecret(e.id),
});

/** Lista de credenciais do cofre destravado: cartões sem segredo + ficha com revelar/copiar explícitos. */
export function Credenciais({ onLock }: { onLock: () => void }) {
  const [entries, setEntries] = useState<VaultEntry[]>(() => vault.listEntries());
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<Rascunho | null>(null);
  const [autoLock, setAutoLock] = useState<number>(vault.getAutoLockMinutes());
  const [aviso, setAviso] = useState<{ sev: 'success' | 'info' | 'error'; text: string } | null>(null);
  const ativos = useMemo(() => new Map(listAtivos({ rows: 1000 }).items.map((a) => [a.id, a.nome])), []);
  const visiveis = useMemo(() => filtrarCredenciais(entries, busca), [entries, busca]);
  const sel = useDrawerSelection(visiveis);

  const refresh = () => setEntries(vault.listEntries());

  async function importarArquivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const r = await vault.importEntries(await file.text());
      setAviso({ sev: 'info', text: `${r.novas} credencial(is) nova(s), ${r.atualizadas} atualizada(s). Apague o arquivo de origem: ele tem os segredos em texto puro.` });
    } catch {
      setAviso({ sev: 'error', text: 'Arquivo inválido: esperado um JSON com a lista de credenciais.' });
    }
    refresh();
  }

  async function testadaHoje(e: VaultEntry) {
    await vault.saveEntry(paraSalvar(e, { confirmadoEm: todayISO() }));
    refresh();
  }

  function excluir(e: VaultEntry) {
    confirmDialog({
      header: 'Excluir credencial',
      message: <span>Excluir <strong>{e.titulo}</strong> do cofre? Não dá para desfazer.<br /><small className="iv-muted">Se ela só parou de funcionar, prefira editar e trocar o segredo.</small></span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Excluir', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: async () => { await vault.removeEntry(e.id); sel.close(); refresh(); },
    });
  }

  return (
    <div>
      <div className="iv-card iv-mt">
        <div className="ca-toolbar">
          <div className="iv-row iv-wrap">
            <Button label="Nova credencial" icon="pi pi-plus" onClick={() => setForm({ titulo: '', usuario: '', url: '', notas: '', secret: '' })} />
            <label className="p-button p-component p-button-outlined ca-file">
              <span className="p-button-icon p-button-icon-left pi pi-upload" aria-hidden="true" />
              <span className="p-button-label">Importar arquivo</span>
              <input type="file" accept="application/json,.json" className="ca-file__input" onChange={importarArquivo} />
            </label>
          </div>
          <div className="iv-row iv-wrap">
            <label htmlFor="ca-autolock" className="iv-muted ca-small">Travar após</label>
            <InputNumber inputId="ca-autolock" value={autoLock} onValueChange={(e) => { const m = e.value ?? 0; setAutoLock(m); vault.setAutoLockMinutes(m); }}
              suffix=" min" min={0} max={120} showButtons className="ca-autolock" />
            <Button label="Travar agora" icon="pi pi-lock" outlined severity="secondary" onClick={onLock} />
          </div>
        </div>
        <p className="iv-muted ca-small ca-mb0">Trava automática por inatividade (0 = desligada). O cofre também trava ao ocultar a aba.</p>
        {aviso && <Message severity={aviso.sev} text={aviso.text} className="ca-msg" />}
      </div>

      {entries.length > 0 && (
        <div className="iv-row iv-wrap iv-mt">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por título, usuário, URL ou nota" />
          <span className="iv-muted ca-small" role="status">{visiveis.length} de {entries.length}</span>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="iv-card iv-mt"><EmptyState icon="pi-key" title="Cofre vazio" text="Guarde a primeira credencial: ela é cifrada antes de gravar."
          action={<Button label="Nova credencial" icon="pi pi-plus" onClick={() => setForm({ titulo: '', secret: '' })} />} /></div>
      ) : (
        <div className="ca-cred-grid iv-mt">
          {visiveis.map((e) => {
            const t = estadoTeste(e.confirmadoEm);
            return (
              <ClickCard key={e.id} onOpen={() => sel.open(e.id)} selected={sel.isOpen(e.id)} label={`Abrir credencial ${e.titulo}`} tone={t.tone === 'warning' ? 'warning' : undefined}>
                <div className="ca-post__meta">
                  <i className="pi pi-key iv-muted" aria-hidden="true" />
                  <strong className="ca-flex1 ca-cred__titulo">{e.titulo}</strong>
                  <Button icon="pi pi-copy" text size="small" aria-label={`Copiar segredo de ${e.titulo}`} tooltip="Copiar segredo (limpa em 30 s)"
                    onClick={() => { void copySensitiveToClipboard(vault.getSecret(e.id)); }} />
                </div>
                <div className="iv-muted ca-small ca-cred__linha">{[e.usuario, e.url].filter(Boolean).join(' · ') || 'Sem usuário nem URL'}</div>
                <div className="ca-post__meta ca-cred__rodape">
                  <Pill label={t.rotulo} tone={t.tone} />
                  {e.ativoId && <Pill label={ativos.get(e.ativoId) ?? 'ativo removido'} icon="pi-server" />}
                </div>
              </ClickCard>
            );
          })}
          {visiveis.length === 0 && <p className="iv-muted">Nada encontrado para "{busca}".</p>}
        </div>
      )}

      {sel.item && (
        <CredencialDrawer key={sel.item.id} entry={sel.item} nav={sel.nav} nomeAtivo={sel.item.ativoId ? ativos.get(sel.item.ativoId) : undefined}
          onEditar={() => setForm({ ...paraSalvar(sel.item!) })}
          onTestadaHoje={() => void testadaHoje(sel.item!)}
          onExcluir={() => excluir(sel.item!)} />
      )}

      {form && <CredencialForm inicial={form} onClose={() => setForm(null)} onSalvo={(titulo) => { setForm(null); refresh(); setAviso({ sev: 'success', text: `"${titulo}" guardada no cofre.` }); }} />}
    </div>
  );
}
