import { useState, type FormEvent } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { FASES_PROJETO, STATUS_PROJETO, type FaseProjeto, type ProjetoLinkedin, type StatusProjeto } from '@seginfo/shared';
import { FormField } from '@/components/ui/FormField';
import { mensagemErro, riscosDePublicacao } from '@/services/linkedin';
import { criarProjeto, editarProjeto } from '@/services/linkedinPipeline';
import { STATUS_PROJETO_META } from './pipelineRegras';

const SITUACOES = STATUS_PROJETO.map((value) => ({ value, label: STATUS_PROJETO_META[value].label }));
const FASES = FASES_PROJETO.map((value) => ({ value, label: ({ iniciacao: 'Iniciação', planejamento: 'Planejamento', execucao: 'Execução', encerramento: 'Encerramento' })[value] }));

/** Criar ou editar um projeto (ou série) de conteúdo. */
export function ProjetoForm({ inicial, pilares, onClose, onSalvo }: {
  inicial: ProjetoLinkedin | null; pilares: string[];
  onClose: () => void; onSalvo: (nome: string) => void;
}) {
  const [f, setF] = useState({
    nome: inicial?.nome ?? '', descricao: inicial?.descricao ?? '', objetivo: inicial?.objetivo ?? '',
    pilar: inicial?.pilar ?? null as string | null, status: (inicial?.status ?? 'ativo') as StatusProjeto,
    resultadoEsperado: inicial?.resultadoEsperado ?? '', escopo: inicial?.escopo ?? '', criteriosSucesso: inicial?.criteriosSucesso ?? '',
    fase: (inicial?.fase ?? 'iniciacao') as FaseProjeto,
  });
  const [erroNome, setErroNome] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const riscos = riscosDePublicacao(`${f.nome}\n${f.descricao}\n${f.objetivo}\n${f.resultadoEsperado}\n${f.escopo}\n${f.criteriosSucesso}`);

  async function salvar(ev?: FormEvent) {
    ev?.preventDefault();
    if (!f.nome.trim()) return setErroNome('Dê um nome ao projeto.');
    setErroNome(''); setErro(''); setSalvando(true);
    const corpo = { nome: f.nome.trim(), descricao: f.descricao.trim(), objetivo: f.objetivo.trim(), pilar: f.pilar || null, status: f.status,
      resultadoEsperado: f.resultadoEsperado.trim(), escopo: f.escopo.trim(), criteriosSucesso: f.criteriosSucesso.trim(), fase: f.fase };
    try {
      if (inicial) await editarProjeto(inicial.id, corpo);
      else await criarProjeto(corpo);
      onSalvo(corpo.nome);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog header={inicial ? 'Editar projeto' : 'Novo projeto'} visible onHide={onClose} className="ca-dialog" style={{ width: 'min(720px, 96vw)' }}
      footer={(
        <div className="iv-form__footer">
          <small>* obrigatório</small>
          <Button label="Cancelar" text onClick={onClose} />
          <Button label={inicial ? 'Salvar alterações' : 'Criar projeto'} icon="pi pi-save" loading={salvando} onClick={() => salvar()} />
        </div>
      )}>
      <form className="iv-form" onSubmit={salvar}>
        <div className="iv-form__grid">
          <FormField id="proj-nome" label="Nome" required full error={erroNome} hint="Um assunto ou uma série: é por ele que você vai separar ideias, rascunhos e posts.">
            <InputText id="proj-nome" value={f.nome} maxLength={80} autoFocus onChange={(e) => { setF({ ...f, nome: e.target.value }); setErroNome(''); }}
              placeholder="Ex.: Honeypot exposto, Rumo à certificação, Construindo a plataforma" />
          </FormField>
          <FormField id="proj-descricao" label="Do que trata" full>
            <InputTextarea id="proj-descricao" value={f.descricao} maxLength={1_000} rows={3} autoResize onChange={(e) => setF({ ...f, descricao: e.target.value })} />
          </FormField>
          <FormField id="proj-objetivo" label="O que você quer com esta série" full hint="Ex.: mostrar prática de detecção com evidência. A IA usa isto no planejador.">
            <InputTextarea id="proj-objetivo" value={f.objetivo} maxLength={500} rows={2} autoResize onChange={(e) => setF({ ...f, objetivo: e.target.value })} />
          </FormField>
          <FormField id="proj-pilar" label="Pilar principal">
            <Dropdown inputId="proj-pilar" value={f.pilar} options={pilares} onChange={(e) => setF({ ...f, pilar: e.value ?? null })} placeholder="Nenhum" showClear />
          </FormField>
          <FormField id="proj-status" label="Situação">
            <Dropdown inputId="proj-status" value={f.status} options={SITUACOES} onChange={(e) => setF({ ...f, status: e.value })} />
          </FormField>
          <FormField id="proj-resultado" label="Resultado esperado" full hint="Que valor ou mudança este projeto deve produzir?">
            <InputTextarea id="proj-resultado" value={f.resultadoEsperado} maxLength={1000} rows={2} autoResize onChange={(e) => setF({ ...f, resultadoEsperado: e.target.value })} />
          </FormField>
          <FormField id="proj-escopo" label="Escopo" full hint="O que está incluído nesta entrega?">
            <InputTextarea id="proj-escopo" value={f.escopo} maxLength={1000} rows={2} autoResize onChange={(e) => setF({ ...f, escopo: e.target.value })} />
          </FormField>
          <FormField id="proj-sucesso" label="Critérios de sucesso" full hint="Como você saberá que entregou o resultado?">
            <InputTextarea id="proj-sucesso" value={f.criteriosSucesso} maxLength={1000} rows={2} autoResize onChange={(e) => setF({ ...f, criteriosSucesso: e.target.value })} />
          </FormField>
          <FormField id="proj-fase" label="Fase atual"><Dropdown inputId="proj-fase" value={f.fase} options={FASES} onChange={(e) => setF({ ...f, fase: e.value })} /></FormField>
        </div>
        {riscos.length > 0 && <p className="ca-aviso" role="status"><i className="pi pi-exclamation-triangle" aria-hidden="true" /> Pode expor: {riscos.join(', ')}. O nome e o objetivo vão para a IA: descreva sem endereços nem nomes de equipamentos.</p>}
        {erro && <small className="iv-field__error" role="alert">{erro}</small>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
