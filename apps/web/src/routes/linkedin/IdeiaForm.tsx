import { useState, type FormEvent } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import type { FormatoPost, IdeiaLinkedin } from '@seginfo/shared';
import { FormField } from '@/components/ui/FormField';
import { FORMATOS, mensagemErro, riscosDePublicacao } from '@/services/linkedin';
import { criarIdeia, editarIdeia } from '@/services/linkedinPipeline';
import { detalheDoErro } from './dados';

type Opcao = { label: string; value: string };
export interface IdeiaInicial { id?: string; titulo?: string; briefing?: string; pilar?: string | null; projetoId?: string | null; formato?: FormatoPost | null; sugeridaPara?: string | null }

export const ideiaParaForm = (i: IdeiaLinkedin): IdeiaInicial => ({
  id: i.id, titulo: i.titulo, briefing: i.briefing, pilar: i.pilar, projetoId: i.projetoId, formato: i.formato, sugeridaPara: i.sugeridaPara,
});

/** Criar ou editar uma ideia do backlog. Só o título é obrigatório: ideia boa é a que foi anotada. */
export function IdeiaForm({ inicial, projetos, pilares, onClose, onSalva }: {
  inicial: IdeiaInicial; projetos: Opcao[]; pilares: string[];
  onClose: () => void; onSalva: (nome: string) => void;
}) {
  const [f, setF] = useState({
    titulo: inicial.titulo ?? '', briefing: inicial.briefing ?? '', pilar: inicial.pilar ?? null as string | null,
    projetoId: inicial.projetoId ?? null as string | null, formato: inicial.formato ?? null as FormatoPost | null, sugeridaPara: inicial.sugeridaPara ?? '',
  });
  const [erroTitulo, setErroTitulo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const riscos = riscosDePublicacao(`${f.titulo}\n${f.briefing}`);

  async function salvar(ev?: FormEvent) {
    ev?.preventDefault();
    if (f.titulo.trim().length < 3) return setErroTitulo('Dê um título à ideia (pelo menos 3 caracteres).');
    setErroTitulo(''); setErro(''); setSalvando(true);
    const corpo = {
      titulo: f.titulo.trim(), briefing: f.briefing.trim(), pilar: f.pilar || null, projetoId: f.projetoId || null,
      formato: f.formato || null, sugeridaPara: f.sugeridaPara || null,
    };
    try {
      if (inicial.id) await editarIdeia(inicial.id, corpo);
      else await criarIdeia({ ...corpo, origem: 'manual' });
      onSalva(corpo.titulo);
    } catch (e) {
      setErro(detalheDoErro(e).status === 409 ? 'Já existe uma ideia com este título.' : mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog header={inicial.id ? 'Editar ideia' : 'Nova ideia'} visible onHide={onClose} className="ca-dialog" style={{ width: 'min(720px, 96vw)' }}
      footer={(
        <div className="iv-form__footer">
          <small>* obrigatório</small>
          <Button label="Cancelar" text onClick={onClose} />
          <Button label={inicial.id ? 'Salvar alterações' : 'Guardar ideia'} icon="pi pi-save" loading={salvando} onClick={() => salvar()} />
        </div>
      )}>
      <form className="iv-form" onSubmit={salvar}>
        <div className="iv-form__grid">
          <FormField id="ideia-titulo" label="A ideia em uma linha" required full error={erroTitulo}>
            <InputText id="ideia-titulo" value={f.titulo} maxLength={200} autoFocus onChange={(e) => { setF({ ...f, titulo: e.target.value }); setErroTitulo(''); }}
              placeholder="Ex.: o que três dias de honeypot me ensinaram sobre senhas" />
          </FormField>
          <FormField id="ideia-briefing" label="Briefing" full hint="O que você quer contar, qual evidência tem e para quem. Vira o pedido para a IA no Estúdio.">
            <InputTextarea id="ideia-briefing" value={f.briefing} maxLength={3_000} rows={4} autoResize onChange={(e) => setF({ ...f, briefing: e.target.value })} />
          </FormField>
          <FormField id="ideia-projeto" label="Projeto">
            <Dropdown inputId="ideia-projeto" value={f.projetoId} options={projetos} onChange={(e) => setF({ ...f, projetoId: e.value ?? null })}
              placeholder="Sem projeto" showClear emptyMessage="Crie um projeto na aba Projetos" />
          </FormField>
          <FormField id="ideia-pilar" label="Pilar">
            <Dropdown inputId="ideia-pilar" value={f.pilar} options={pilares} onChange={(e) => setF({ ...f, pilar: e.value ?? null })} placeholder="A IA escolhe" showClear />
          </FormField>
          <FormField id="ideia-formato" label="Formato">
            <Dropdown inputId="ideia-formato" value={f.formato} options={[...FORMATOS]} onChange={(e) => setF({ ...f, formato: e.value ?? null })} placeholder="A decidir" showClear />
          </FormField>
          <FormField id="ideia-data" label="Sugerida para" hint="Opcional: aparece no calendário do pipeline.">
            <InputText id="ideia-data" type="date" value={f.sugeridaPara} onChange={(e) => setF({ ...f, sugeridaPara: e.target.value })} />
          </FormField>
        </div>
        {riscos.length > 0 && <p className="ca-aviso" role="status"><i className="pi pi-exclamation-triangle" aria-hidden="true" /> Pode expor: {riscos.join(', ')}. O briefing vai para a IA: descreva sem endereços nem nomes de equipamentos.</p>}
        {erro && <small className="iv-field__error" role="alert">{erro}</small>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
