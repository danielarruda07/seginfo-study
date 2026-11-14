import { useMemo, useState, type FormEvent } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import type { VaultEntry } from '@seginfo/shared';
import { FormField } from '@/components/ui/FormField';
import * as vault from '@/services/vault';
import { listAtivos } from '@/services/inventario';
import { todayISO } from '@/services/store';
import { SecretInput } from './CofreAcesso';
import { explicarFalhaGravar } from './falhas';

export type Rascunho = Partial<VaultEntry> & { secret?: string };

/** Cadastro/edição de credencial. O segredo só existe no estado deste diálogo enquanto ele está aberto. */
export function CredencialForm({ inicial, onClose, onSalvo, onSessaoExpirou }: {
  inicial: Rascunho; onClose: () => void; onSalvo: (titulo: string) => void; onSessaoExpirou: () => void;
}) {
  const [c, setC] = useState<Rascunho>(inicial);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ativos = useMemo(() => listAtivos({ rows: 1000 }).items.map((a) => ({ label: `${a.nome}${a.endereco ? ` · ${a.endereco}` : ''}`, value: a.id })), []);

  async function salvar(ev?: FormEvent) {
    ev?.preventDefault();
    if (!c.titulo?.trim()) return setErro('Dê um título para achar a credencial depois.');
    setSalvando(true);
    try {
      await vault.saveEntry({
        id: c.id, titulo: c.titulo.trim(), usuario: c.usuario ?? '', url: c.url ?? '', ambiente: c.ambiente, ativoId: c.ativoId,
        notas: c.notas ?? '', confirmadoEm: c.confirmadoEm || undefined, secret: c.secret ?? '',
      });
    } catch (e) {
      setSalvando(false);
      const f = explicarFalhaGravar(e);
      if (f.expirou) { onClose(); onSessaoExpirou(); return; }
      return setErro(f.texto);
    }
    setSalvando(false);
    onSalvo(c.titulo.trim());
  }

  return (
    <Dialog header={c.id ? 'Editar credencial' : 'Nova credencial'} visible onHide={onClose} style={{ width: 'min(780px, 96vw)' }}
      footer={(
        <div className="iv-form__footer">
          <small>* obrigatório</small>
          <Button label="Cancelar" text onClick={onClose} />
          <Button label={c.id ? 'Salvar alterações' : 'Guardar no cofre'} icon="pi pi-lock" loading={salvando} onClick={() => salvar()} />
        </div>
      )}>
      <form className="iv-form" onSubmit={salvar} autoComplete="off">
        <fieldset>
          <legend>Acesso</legend>
          <div className="iv-form__grid">
            <FormField id="cred-titulo" label="Título" required full error={erro} hint="Ex.: Firewall do lab (admin web)">
              <InputText id="cred-titulo" value={c.titulo ?? ''} onChange={(e) => setC({ ...c, titulo: e.target.value })} autoFocus />
            </FormField>
            <FormField id="cred-usuario" label="Usuário">
              <InputText id="cred-usuario" value={c.usuario ?? ''} onChange={(e) => setC({ ...c, usuario: e.target.value })} autoComplete="off" />
            </FormField>
            <FormField id="cred-segredo" label="Senha / segredo" hint="Cifrado com AES-GCM antes de gravar.">
              <SecretInput id="cred-segredo" value={c.secret ?? ''} onChange={(secret) => setC({ ...c, secret })} autoComplete="new-password" />
            </FormField>
            <FormField id="cred-url" label="URL ou host" full hint="Ex.: https://fw.example ou 192.0.2.10">
              <InputText id="cred-url" value={c.url ?? ''} onChange={(e) => setC({ ...c, url: e.target.value })} />
            </FormField>
          </div>
        </fieldset>
        <fieldset>
          <legend>Contexto</legend>
          <div className="iv-form__grid">
            <FormField id="cred-ativo" label="Ativo relacionado">
              <Dropdown inputId="cred-ativo" value={c.ativoId} options={ativos} onChange={(e) => setC({ ...c, ativoId: e.value, ambiente: 'criecomia' })} placeholder="Nenhum" showClear filter />
            </FormField>
            <FormField id="cred-teste" label="Testada em" hint="Data em que funcionou pela última vez.">
              <span className="iv-row">
                <InputText id="cred-teste" type="date" value={c.confirmadoEm ?? ''} onChange={(e) => setC({ ...c, confirmadoEm: e.target.value })} />
                <Button type="button" label="Hoje" text size="small" onClick={() => setC({ ...c, confirmadoEm: todayISO() })} />
              </span>
            </FormField>
            <FormField id="cred-notas" label="Notas" full hint="Cifradas no cofre, mas aparecem sem máscara na ficha: não ponha segredos aqui.">
              <InputTextarea id="cred-notas" value={c.notas ?? ''} onChange={(e) => setC({ ...c, notas: e.target.value })} rows={2} autoResize />
            </FormField>
          </div>
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
