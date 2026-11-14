import { useId, useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { trilhaOptions } from '@/services/catalog';
import { todayISO } from '@/services/store';

export interface MetaRascunho { titulo: string; prazo: string; trilhaId?: string }

/** Campos de meta (nova ou edição) com rótulos e erro no próprio campo. */
export function MetaCampos({ inicial, verbo, onSave, onCancel, limparAoSalvar }: {
  inicial?: MetaRascunho; verbo: string; onSave: (r: MetaRascunho) => void; onCancel?: () => void; limparAoSalvar?: boolean;
}) {
  const id = useId();
  const [r, setR] = useState<MetaRascunho>(inicial ?? { titulo: '', prazo: todayISO() });
  const [erro, setErro] = useState('');

  function enviar() {
    if (!r.titulo.trim()) { setErro('Dê um nome à meta.'); return; }
    if (!r.prazo) { setErro('Informe a data-alvo.'); return; }
    onSave(r);
    setErro('');
    if (limparAoSalvar) setR({ titulo: '', prazo: r.prazo, trilhaId: r.trilhaId });
  }

  return (
    <form className="es-form" onSubmit={(e) => { e.preventDefault(); enviar(); }} noValidate>
      <label htmlFor={`${id}-t`} className="es-form__wide">
        <span>Meta <span aria-hidden="true">*</span></span>
        <InputText id={`${id}-t`} value={r.titulo} onChange={(e) => { setR({ ...r, titulo: e.target.value }); setErro(''); }}
          placeholder="Ex.: Concluir a trilha de SIEM" aria-invalid={!!erro && !r.titulo.trim()} aria-describedby={`${id}-err`} />
      </label>
      <label htmlFor={`${id}-p`}>
        <span>Data-alvo <span aria-hidden="true">*</span></span>
        <InputText id={`${id}-p`} type="date" value={r.prazo} onChange={(e) => setR({ ...r, prazo: e.target.value })} />
      </label>
      <label htmlFor={`${id}-tr`}>
        <span>Trilha (opcional)</span>
        <Dropdown inputId={`${id}-tr`} value={r.trilhaId} options={trilhaOptions()} onChange={(e) => setR({ ...r, trilhaId: e.value ?? undefined })} placeholder="Sem trilha" showClear />
      </label>
      <div className="es-form__actions">
        <small id={`${id}-err`} className="es-form__erro" role="alert">{erro}</small>
        {onCancel && <Button type="button" label="Cancelar" text onClick={onCancel} />}
        <Button type="submit" label={verbo} icon={inicial ? 'pi pi-check' : 'pi pi-plus'} />
      </div>
    </form>
  );
}
