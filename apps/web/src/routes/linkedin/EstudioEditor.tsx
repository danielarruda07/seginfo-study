import type { ReactNode } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { SelectButton } from 'primereact/selectbutton';
import { LIMITE_POST, ROTULO_VISIBILIDADE, textoDoPost, VISIBILIDADES, type FormatoPost, type RascunhoLinkedin, type Visibilidade } from '@seginfo/shared';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { FORMATOS } from '@/services/linkedin';
import { STATUS_META } from './pipelineRegras';
import { MidiaRascunho } from './MidiaRascunho';

const OPCOES_VISIBILIDADE = VISIBILIDADES.map((value) => ({ value, label: ROTULO_VISIBILIDADE[value] }));

export interface FormEstudio {
  titulo: string; gancho: string; corpo: string;
  direcaoVisual: string; textoAlternativo: string; roteiroSlides: string;
  topicoId?: string; projetoId: string | null; formato: FormatoPost; visibilidade: Visibilidade;
}
export const FORM_VAZIO: FormEstudio = {
  titulo: '', gancho: '', corpo: '', direcaoVisual: '', textoAlternativo: '', roteiroSlides: '', topicoId: undefined, projetoId: null, formato: 'texto', visibilidade: 'PUBLIC',
};

type Opcao = { label: string; value: string };

/** Editor do Estúdio: campos do rascunho, apoio visual e ações de salvar/copiar. O refino entra por `children`. */
export function EstudioEditor({ form, onCampo, editando, topicos, projetos, erro, salvo, salvando, onSalvar, onLimpar, onCopiar, onVerPipeline, onRascunhoAtualizado, children }: {
  form: FormEstudio;
  onCampo: <K extends keyof FormEstudio>(campo: K, valor: FormEstudio[K]) => void;
  editando: RascunhoLinkedin | null;
  topicos: Opcao[]; projetos: Opcao[];
  erro: string; salvo: boolean; salvando: boolean;
  onSalvar: () => void; onLimpar: () => void; onCopiar: () => void; onVerPipeline: () => void;
  /** o servidor mudou o rascunho (arquivo anexado ou trocado): atualizar o que está aberto */
  onRascunhoAtualizado: (r: RascunhoLinkedin) => void;
  children?: ReactNode;
}) {
  const tamanho = textoDoPost(form.gancho, form.corpo).length;
  const visual = form.formato === 'imagem' || form.formato === 'carrossel';
  const liberado = editando && (editando.status === 'aprovado' || editando.status === 'agendado');
  const fechado = editando && (editando.status === 'publicado' || editando.status === 'publicando');
  return (
    <section className="iv-card posts-editor">
      <div className="ca-toolbar">
        <h3 className="ca-h3">
          {editando ? 'Editando rascunho' : 'Editor'}
          {editando && <> <Pill label={STATUS_META[editando.status].label} tone={STATUS_META[editando.status].tone} icon={STATUS_META[editando.status].icon} /></>}
        </h3>
        {(editando || form.titulo || form.corpo || form.gancho) && <Button label="Novo em branco" icon="pi pi-file" text onClick={onLimpar} />}
      </div>
      {liberado && <Message severity="warn" className="ca-w100" text={`Este rascunho está ${editando?.status}. Mudar o gancho ou o corpo devolve para "rascunho": a aprovação vale para um texto específico.`} />}
      {fechado && <Message severity="info" className="ca-w100" text={'Este post já foi publicado. Para reaproveitar o texto, clique em "Novo em branco" e cole o que quiser.'} />}
      <div className="posts-title-row iv-mt">
        <InputText value={form.titulo} onChange={(e) => onCampo('titulo', e.target.value)} placeholder="Título interno do post" aria-label="Título interno do post" maxLength={200} />
        <Dropdown value={form.topicoId} options={topicos} onChange={(e) => onCampo('topicoId', e.value ?? undefined)} placeholder="Tópico relacionado (opcional)" ariaLabel="Tópico relacionado" showClear filter />
      </div>
      <div className="posts-title-row">
        <Dropdown value={form.projetoId} options={projetos} onChange={(e) => onCampo('projetoId', e.value ?? null)} placeholder="Projeto (opcional)" ariaLabel="Projeto"
          showClear emptyMessage="Crie um projeto na aba Projetos" />
        <Dropdown value={form.formato} options={[...FORMATOS]} onChange={(e) => onCampo('formato', e.value)} ariaLabel="Formato do post" />
      </div>
      <div className="iv-row iv-wrap">
        <SelectButton value={form.visibilidade} options={OPCOES_VISIBILIDADE} allowEmpty={false} onChange={(e) => onCampo('visibilidade', e.value)} aria-label="Quem vê o post" />
        <small className="iv-muted">{form.visibilidade === 'CONNECTIONS' ? 'Só as suas conexões veem. Bom para testar a publicação automática.' : 'Qualquer pessoa no LinkedIn vê.'}</small>
      </div>
      <InputText value={form.gancho} onChange={(e) => onCampo('gancho', e.target.value)} placeholder="Gancho (primeira linha, o que prende a atenção)" aria-label="Gancho" />
      <InputTextarea value={form.corpo} onChange={(e) => onCampo('corpo', e.target.value)} rows={12} autoResize placeholder="Desenvolva a ideia, o que aprendeu e como aplicou..." aria-label="Corpo do post" />
      <small className={tamanho > LIMITE_POST ? 'iv-field__error' : 'iv-muted'} aria-live="polite">
        {tamanho} / 3.000 caracteres do post. O tamanho abaixo do limite depende da ideia.
      </small>
      {children}
      {visual && (
        <section className="iv-card iv-col iv-gap" aria-label="Apoio visual">
          <h4 className="ca-h4">Direção visual</h4>
          <p className="iv-muted ca-small ca-mb0">Use a descrição como briefing para criar a arte. Revise termos técnicos e não coloque dados do ambiente ou texto pequeno na imagem.</p>
          {form.formato === 'carrossel' && (
            <label className="iv-col iv-gap"><strong>Roteiro dos slides</strong>
              <InputTextarea value={form.roteiroSlides} onChange={(e) => onCampo('roteiroSlides', e.target.value)} rows={5} autoResize aria-label="Roteiro dos slides" placeholder="Uma ideia por linha: capa, contexto, passos e conclusão." />
            </label>
          )}
          <label className="iv-col iv-gap"><strong>Prompt visual</strong>
            <InputTextarea value={form.direcaoVisual} onChange={(e) => onCampo('direcaoVisual', e.target.value)} rows={4} autoResize aria-label="Direção visual" placeholder="A direção de arte aparecerá aqui após gerar o rascunho." />
          </label>
          <div className="iv-row iv-wrap">
            <Button label="Copiar prompt visual" icon="pi pi-copy" outlined disabled={!form.direcaoVisual} onClick={() => copyToClipboard(form.direcaoVisual)} />
            <Button label="Copiar roteiro" icon="pi pi-copy" outlined disabled={!form.roteiroSlides} onClick={() => copyToClipboard(form.roteiroSlides)} />
          </div>
          <MidiaRascunho rascunho={editando} onAtualizado={onRascunhoAtualizado} />
          <label className="iv-col iv-gap"><strong>Texto alternativo da imagem</strong>
            <InputTextarea value={form.textoAlternativo} onChange={(e) => onCampo('textoAlternativo', e.target.value)} rows={2} autoResize aria-label="Texto alternativo" placeholder="Descreva a informação visual para quem usa leitor de tela." />
          </label>
        </section>
      )}
      <div className="iv-row iv-wrap">
        <Button label={editando ? 'Salvar alterações' : 'Salvar rascunho'} icon="pi pi-save" loading={salvando} onClick={onSalvar} disabled={!form.titulo.trim() || !!fechado} />
        <Button label="Copiar texto" icon="pi pi-copy" outlined onClick={onCopiar} />
        {salvo && <span className="iv-row ca-small" role="status"><i className="pi pi-check-circle ca-ok" aria-hidden="true" /> Salvo no servidor.
          <Button label="Ver no pipeline" icon="pi pi-arrow-right" iconPos="right" text size="small" onClick={onVerPipeline} /></span>}
      </div>
      {erro && <Message severity="error" text={erro} className="ca-w100" />}
    </section>
  );
}
