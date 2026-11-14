import { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import type { ArsenalItem, TipoArsenal } from '@seginfo/shared';
import { FormField } from '@/components/ui/FormField';
import { DOMINIO_ARSENAL_OPTS, TIPO_ARSENAL_META, TIPO_ARSENAL_OPTS, parseTags } from './regras';

export type ArsenalDraft = Partial<ArsenalItem> & { nome: string; tipo: TipoArsenal };

const DICA_CONTEUDO: Record<TipoArsenal, string> = {
  prompt: 'O texto do prompt, pronto para colar no modelo.',
  skill: 'A definição da skill: objetivo, passos e regras.',
  agente: 'As instruções do agente (papel, ferramentas, limites).',
};

/** Cadastro/edição de item do Arsenal (diálogo do guia: blocos, tipo em cartões, salvar sempre habilitado). */
export function ArsenalForm({ inicial, onCancel, onSave }: { inicial: ArsenalDraft; onCancel: () => void; onSave: (d: ArsenalDraft) => void }) {
  const [d, setD] = useState<ArsenalDraft>(inicial);
  const [requisitos, setRequisitos] = useState((inicial.requisitos ?? []).join(', '));
  const [tags, setTags] = useState((inicial.tags ?? []).join(', '));
  const [erro, setErro] = useState('');
  const novo = !inicial.id;
  const set = (p: Partial<ArsenalDraft>) => setD({ ...d, ...p });

  function salvar() {
    if (!d.nome.trim()) return setErro('Dê um nome ao item.');
    onSave({ ...d, nome: d.nome.trim(), requisitos: requisitos.split(',').map((s) => s.trim()).filter(Boolean), tags: parseTags(tags) });
  }

  const footer = (
    <div className="iv-form__footer">
      <small>* obrigatório</small>
      <Button label="Cancelar" text onClick={onCancel} />
      <Button label={novo ? 'Adicionar ao arsenal' : 'Salvar alterações'} icon="pi pi-check" onClick={salvar} />
    </div>
  );

  return (
    <Dialog visible header={novo ? `Novo ${TIPO_ARSENAL_META[d.tipo].label.toLowerCase()}` : `Editar · ${inicial.nome}`} onHide={onCancel} footer={footer}
      style={{ width: '780px' }} breakpoints={{ '820px': '96vw' }} draggable={false}>
      <form className="iv-form" onSubmit={(e) => { e.preventDefault(); salvar(); }} noValidate>
        <fieldset>
          <legend>O que é</legend>
          <div className="iv-typecards" role="radiogroup" aria-label="Tipo">
            {TIPO_ARSENAL_OPTS.map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={d.tipo === o.value} className="iv-typecard"
                onClick={() => set({ tipo: o.value })}>
                <i className={`pi ${o.icon}`} aria-hidden="true" /> {o.label}
              </button>
            ))}
          </div>
          <div className="iv-form__grid iv-mt">
            <FormField id="ars-nome" label="Nome" required error={erro}>
              <InputText id="ars-nome" value={d.nome} onChange={(e) => { set({ nome: e.target.value }); setErro(''); }} placeholder="Ex.: pentest-api" aria-invalid={!!erro} />
            </FormField>
            <FormField id="ars-dominio" label="Domínio">
              <Dropdown inputId="ars-dominio" value={d.dominio ?? 'geral'} options={DOMINIO_ARSENAL_OPTS} onChange={(e) => set({ dominio: e.value })} />
            </FormField>
            <FormField id="ars-resumo" label="Resumo" hint="O que faz, em 1 ou 2 linhas (aparece no cartão)." full>
              <InputTextarea id="ars-resumo" value={d.resumo ?? ''} onChange={(e) => set({ resumo: e.target.value })} rows={2} />
            </FormField>
          </div>
        </fieldset>
        <fieldset>
          <legend>Conteúdo</legend>
          <div className="iv-form__grid">
            <FormField id="ars-conteudo" label="Texto completo" hint={DICA_CONTEUDO[d.tipo]} full>
              <InputTextarea id="ars-conteudo" value={d.conteudo ?? ''} onChange={(e) => set({ conteudo: e.target.value })} rows={8} className="mono" />
            </FormField>
            <FormField id="ars-quando" label="Quando usar" full>
              <InputTextarea id="ars-quando" value={d.quandoUsar ?? ''} onChange={(e) => set({ quandoUsar: e.target.value })} rows={2} placeholder="Contexto em que vale aplicar." />
            </FormField>
            <FormField id="ars-req" label="Requisitos" hint="Separados por vírgula (ex.: Docker, nmap).">
              <InputText id="ars-req" value={requisitos} onChange={(e) => setRequisitos(e.target.value)} />
            </FormField>
            <FormField id="ars-tags" label="Tags" hint="Separadas por vírgula; ligam o item à base dos agentes.">
              <InputText id="ars-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="pentest, api, authz" />
            </FormField>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
