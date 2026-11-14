import { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { FormField } from '@/components/ui/FormField';
import type { Escopo, MemoriaCorpo } from '@/services/cerebro';
import { ESCOPO_OPTS, parseTags } from './regras';

export interface MemoriaInicial { id?: string; titulo: string; conteudo: string; tags: string[]; escopo: Escopo }

/** Criar/editar memória: diálogo do guia, salvar sempre habilitado com erro no campo. */
export function MemoriaForm({ inicial, salvando, onCancel, onSave }: {
  inicial: MemoriaInicial; salvando: boolean; onCancel: () => void; onSave: (id: string | undefined, corpo: MemoriaCorpo) => void;
}) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [conteudo, setConteudo] = useState(inicial.conteudo);
  const [tags, setTags] = useState(inicial.tags.join(', '));
  const [escopo, setEscopo] = useState<Escopo>(inicial.escopo);
  const [erro, setErro] = useState('');
  const novo = !inicial.id;

  function salvar() {
    if (!titulo.trim()) return setErro('Dê um título à memória.');
    onSave(inicial.id, { titulo: titulo.trim(), conteudo, tags: parseTags(tags), escopo });
  }

  const footer = (
    <div className="iv-form__footer">
      <small>* obrigatório</small>
      <Button label="Cancelar" text onClick={onCancel} />
      <Button label={novo ? 'Guardar memória' : 'Salvar alterações'} icon={salvando ? 'pi pi-spinner pi-spin' : 'pi pi-check'} disabled={salvando} onClick={salvar} />
    </div>
  );

  return (
    <Dialog visible header={novo ? 'Nova memória' : `Editar · ${inicial.titulo}`} onHide={onCancel} footer={footer}
      style={{ width: '780px' }} breakpoints={{ '820px': '96vw' }} draggable={false}>
      <form className="iv-form" onSubmit={(e) => { e.preventDefault(); salvar(); }} noValidate>
        <fieldset>
          <legend>Identificação</legend>
          <div className="iv-form__grid">
            <FormField id="mem-titulo" label="Título" required error={erro} full>
              <InputText id="mem-titulo" value={titulo} onChange={(e) => { setTitulo(e.target.value); setErro(''); }} aria-invalid={!!erro} />
            </FormField>
            <FormField id="mem-tags" label="Tags" hint="Separadas por vírgula. Agentes leem as memórias pessoais das tags que têm na base.">
              <InputText id="mem-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ad, kerberos" />
            </FormField>
            <FormField id="mem-escopo" label="Escopo">
              <Dropdown inputId="mem-escopo" value={escopo} options={ESCOPO_OPTS} onChange={(e) => setEscopo(e.value)} />
            </FormField>
          </div>
        </fieldset>
        <fieldset>
          <legend>Conteúdo</legend>
          <FormField id="mem-conteudo" label="Texto (aceita Markdown)" full>
            <InputTextarea id="mem-conteudo" value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={14} />
          </FormField>
        </fieldset>
      </form>
    </Dialog>
  );
}
