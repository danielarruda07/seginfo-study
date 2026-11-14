import { useId, useMemo, useState } from 'react';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import type { SessaoEstudo } from '@seginfo/shared';
import { addSessao } from '@/services/sessoes';
import { getTopico, listTopicos, trilhaOptions } from '@/services/catalog';
import { listLabs } from '@/services/inventario';
import { todayISO } from '@/services/store';

/** Formulário "Nova sessão" da tela Sessões, com rótulos visíveis e erro no campo. */
export function NovaSessao({ onSaved }: { onSaved: (s: SessaoEstudo) => void }) {
  const id = useId();
  const [data, setData] = useState(todayISO);
  const [minutos, setMinutos] = useState<number | null>(60);
  const [trilhaId, setTrilhaId] = useState<string | undefined>();
  const [topicoId, setTopicoId] = useState<string | undefined>();
  const [labId, setLabId] = useState<string | undefined>();
  const [nota, setNota] = useState('');
  const [erro, setErro] = useState('');

  const topicoOpts = useMemo(() => listTopicos({ trilhaId, rows: 10_000 }).items.map((t) => ({ label: t.titulo, value: t.id })), [trilhaId]);
  const labOpts = useMemo(() => listLabs().map((l) => ({ label: l.titulo, value: l.id })), []);

  /** Escolher o tópico preenche a trilha, para a sessão contar no progresso dela. */
  function escolherTopico(v?: string) {
    setTopicoId(v);
    const t = v ? getTopico(v) : undefined;
    if (t && !trilhaId) setTrilhaId(t.trilhaId);
  }

  function salvar() {
    if (!minutos || minutos <= 0) { setErro('Informe a duração em minutos.'); return; }
    const s = addSessao({ data, minutos, trilhaId, topicoId, labId, nota: nota.trim() });
    setNota(''); setMinutos(60); setTopicoId(undefined); setLabId(undefined); setErro('');
    onSaved(s);
  }

  return (
    <form className="iv-card iv-mt es-form es-form--sessao" onSubmit={(e) => { e.preventDefault(); salvar(); }} noValidate aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="iv-section-label es-form__wide">Nova sessão</h2>
      <label htmlFor={`${id}-d`}><span>Data</span><InputText id={`${id}-d`} type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
      <label htmlFor={`${id}-m`}><span>Duração <span aria-hidden="true">*</span></span>
        <InputNumber inputId={`${id}-m`} value={minutos} onValueChange={(e) => { setMinutos(e.value ?? null); setErro(''); }} suffix=" min" min={1} max={1440} aria-describedby={`${id}-err`} />
      </label>
      <label htmlFor={`${id}-tr`}><span>Trilha</span>
        <Dropdown inputId={`${id}-tr`} value={trilhaId} options={trilhaOptions()} onChange={(e) => { setTrilhaId(e.value ?? undefined); setTopicoId(undefined); }} placeholder="Opcional" showClear />
      </label>
      <label htmlFor={`${id}-tp`}><span>Tópico</span>
        <Dropdown inputId={`${id}-tp`} value={topicoId} options={topicoOpts} onChange={(e) => escolherTopico(e.value ?? undefined)} placeholder="Opcional" showClear filter />
      </label>
      <label htmlFor={`${id}-lb`}><span>Lab</span>
        <Dropdown inputId={`${id}-lb`} value={labId} options={labOpts} onChange={(e) => setLabId(e.value ?? undefined)} placeholder="Opcional" showClear filter />
      </label>
      <label htmlFor={`${id}-n`} className="es-form__wide"><span>O que estudou</span>
        <InputText id={`${id}-n`} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: regras Sigma para logon suspeito" />
      </label>
      <div className="es-form__actions">
        <small id={`${id}-err`} className="es-form__erro" role="alert">{erro}</small>
        <Button type="submit" label="Registrar sessão" icon="pi pi-plus" />
      </div>
    </form>
  );
}
