import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Message } from 'primereact/message';
import { confirmDialog } from 'primereact/confirmdialog';
import { CONDICOES_PROJETO, InformeProjetoInSchema, MarcoProjetoInSchema, SITUACOES_MARCO,
  type InformeProjeto, type MarcoProjeto, type ProjetoLinkedin } from '@seginfo/shared';
import { FormField } from '@/components/ui/FormField';
import { useInvalidate } from '@/hooks/useInvalidate';
import { mensagemErro } from '@/services/linkedin';
import { criarInformeProjeto, criarMarcoProjeto, editarInformeProjeto, editarMarcoProjeto,
  excluirInformeProjeto, getAndamentoProjeto } from '@/services/linkedinPipeline';
import type { IdeiaInicial } from './IdeiaForm';

const condicoes = CONDICOES_PROJETO.map((value) => ({ value, label: ({ sem_avaliacao: 'Sem avaliação', no_caminho: 'No caminho', atencao: 'Atenção', critico: 'Crítico' })[value] }));
const situacoes = SITUACOES_MARCO.map((value) => ({ value, label: ({ planejado: 'Planejado', em_andamento: 'Em andamento', concluido: 'Concluído' })[value] }));
const dia = (s: string | null | undefined) => s ? s.slice(0, 10).split('-').reverse().join('/') : '—';
const nomeCampo: Record<string, string> = { nome: 'nome', descricao: 'descrição', objetivo: 'objetivo', resultadoEsperado: 'resultado esperado', escopo: 'escopo', criteriosSucesso: 'critérios de sucesso', fase: 'fase', status: 'situação', condicao: 'condição', avanco: 'avanço', entrega: 'entrega', responsavel: 'responsável', prazo: 'prazo', situacao: 'situação', concluidoEm: 'conclusão', data: 'data', resumo: 'resumo', entregas: 'entregas', proximosPassos: 'próximos passos', impedimentos: 'riscos/impedimentos', excluidoEm: 'exclusão' };
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function briefingDoInforme(p: ProjetoLinkedin, i: InformeProjeto): IdeiaInicial {
  return {
    projetoId: p.id,
    origem: 'projeto', origemRef: i.id,
    titulo: `${p.nome}: avanço e aprendizados`.slice(0, 200),
    briefing: [
      `Projeto: ${p.nome}.`, p.objetivo && `Objetivo: ${p.objetivo}.`,
      `Informe de ${dia(i.data)}: ${i.resumo}`,
      i.entregas && `Entregas realizadas: ${i.entregas}`,
      i.proximosPassos && `Próximos passos: ${i.proximosPassos}`,
      i.impedimentos && `Riscos ou impedimentos: ${i.impedimentos}`,
      'Conte a decisão, a entrega, o resultado e o aprendizado com linguagem profissional. Não atribua liderança ou resultados sem evidência; confirme os fatos antes de publicar.',
    ].filter(Boolean).join('\n').slice(0, 3000),
  };
}

export function ProjetoAndamento({ projeto, onNovaIdeia }: { projeto: ProjetoLinkedin; onNovaIdeia: (i: IdeiaInicial) => void }) {
  const invalidate = useInvalidate();
  const { data, isLoading, error } = useQuery({ queryKey: ['linkedin-andamento', projeto.id], queryFn: () => getAndamentoProjeto(projeto.id) });
  const [marco, setMarco] = useState<MarcoProjeto | null | undefined>();
  const [informe, setInforme] = useState<InformeProjeto | null | undefined>();
  const [erroAcao, setErroAcao] = useState('');
  const atualizar = () => invalidate('linkedin-andamento', 'linkedin-projetos');

  async function concluir(m: MarcoProjeto) {
    setErroAcao('');
    try { await editarMarcoProjeto(projeto.id, m.id, { situacao: 'concluido' }); atualizar(); }
    catch (e) { setErroAcao(mensagemErro(e)); }
  }
  function excluir(i: InformeProjeto) {
    confirmDialog({ header: 'Excluir informe', message: `Excluir o informe de ${dia(i.data)}? Ele sairá do andamento, mas ficará no histórico de alterações.`,
      acceptLabel: 'Excluir', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: async () => { try { await excluirInformeProjeto(projeto.id, i.id); atualizar(); } catch (e) { setErroAcao(mensagemErro(e)); } },
    });
  }

  return <>
    <section>
      <h3 className="iv-section-label">Acompanhamento</h3>
      <p className="iv-muted ca-small">Registre entregas e aprendizados. Só o informe escolhido por você vira briefing para uma ideia de post.</p>
      {isLoading && <p role="status">Carregando andamento…</p>}
      {error && <Message severity="error" text={mensagemErro(error)} />}
      {erroAcao && <Message severity="error" text={erroAcao} />}
    </section>
    <section>
      <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between', gap: '.5rem' }}>
        <h3 className="iv-section-label">Marcos ({data?.marcos.length ?? 0})</h3>
        <Button label="Novo marco" icon="pi pi-plus" size="small" outlined onClick={() => setMarco(null)} />
      </div>
      {!isLoading && !data?.marcos.length && <p className="iv-muted ca-small">Nenhum marco registrado. Comece pela próxima entrega verificável.</p>}
      <ul className="ca-lista">
        {data?.marcos.map((m) => <li key={m.id}>
          <strong>{m.nome}</strong> <span className="iv-muted">· {situacoes.find((s) => s.value === m.situacao)?.label} · prazo {dia(m.prazo)}</span>
          {m.entrega && <p className="ca-small ca-mb0">Entrega: {m.entrega}</p>}
          {m.responsavel && <p className="iv-muted ca-small ca-mb0">Responsável: {m.responsavel}</p>}
          <div className="iv-row iv-wrap" style={{ gap: '.3rem' }}>
            {m.situacao !== 'concluido' && <Button label="Concluir" size="small" text onClick={() => concluir(m)} />}
            <Button label="Editar" size="small" text onClick={() => setMarco(m)} />
          </div>
        </li>)}
      </ul>
    </section>
    <section>
      <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between', gap: '.5rem' }}>
        <h3 className="iv-section-label">Informes ({data?.informes.length ?? 0})</h3>
        <Button label="Novo informe" icon="pi pi-plus" size="small" outlined onClick={() => setInforme(null)} />
      </div>
      {!isLoading && !data?.informes.length && <p className="iv-muted ca-small">Nenhum informe. Registre o estado atual, o que entregou e o próximo passo.</p>}
      <ul className="ca-lista">
        {data?.informes.map((i) => <li key={i.id}>
          <strong>{dia(i.data)} · {i.avanco}% · {condicoes.find((c) => c.value === i.condicao)?.label}</strong>
          <p className="ca-small ca-mb0">{i.resumo}</p>
          {i.entregas && <p className="ca-small ca-mb0">Entregas: {i.entregas}</p>}
          {i.proximosPassos && <p className="ca-small ca-mb0">Próximos passos: {i.proximosPassos}</p>}
          {i.impedimentos && <p className="ca-small ca-mb0">Riscos/impedimentos: {i.impedimentos}</p>}
          <small className="iv-muted">Registrado por {data.autores?.[i.autorId] ?? 'usuário'} · alterado em {dia(i.atualizadoEm)}</small>
          <div className="iv-row iv-wrap" style={{ gap: '.3rem' }}>
            <Button label="Criar ideia de post" size="small" text onClick={() => onNovaIdeia(briefingDoInforme(projeto, i))} />
            <Button label="Editar" size="small" text onClick={() => setInforme(i)} />
            <Button label="Excluir" size="small" text severity="danger" onClick={() => excluir(i)} />
          </div>
        </li>)}
      </ul>
      {!!data?.eventos.length && <details><summary className="iv-section-label">Histórico de alterações ({data.eventos.length})</summary>
        <ul className="ca-lista">{data.eventos.map((e) => <li key={e.id} className="ca-small">{dia(e.criadoEm)} · {e.acao} {e.entidade} · {data.autores?.[e.autorId] ?? 'usuário'}{e.campos.length ? ` · campos: ${e.campos.map((c) => nomeCampo[c] ?? c).join(', ')}` : ''}</li>)}</ul>
      </details>}
    </section>
    {marco !== undefined && <MarcoForm projetoId={projeto.id} inicial={marco} onClose={() => setMarco(undefined)} onSalvo={() => { setMarco(undefined); atualizar(); }} />}
    {informe !== undefined && <InformeForm projetoId={projeto.id} inicial={informe} onClose={() => setInforme(undefined)} onSalvo={() => { setInforme(undefined); atualizar(); }} />}
  </>;
}

function MarcoForm({ projetoId, inicial, onClose, onSalvo }: { projetoId: string; inicial: MarcoProjeto | null; onClose: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({ nome: inicial?.nome ?? '', entrega: inicial?.entrega ?? '', responsavel: inicial?.responsavel ?? '', prazo: inicial?.prazo ?? '', situacao: inicial?.situacao ?? 'planejado' });
  const [erro, setErro] = useState(''); const [salvando, setSalvando] = useState(false);
  async function salvar() {
    const b = MarcoProjetoInSchema.safeParse({ ...f, prazo: f.prazo || null });
    if (!b.success) return setErro('Dê um nome ao marco e confira os campos.');
    setSalvando(true); setErro('');
    try { if (inicial) await editarMarcoProjeto(projetoId, inicial.id, b.data); else await criarMarcoProjeto(projetoId, b.data); onSalvo(); }
    catch (e) { setErro(mensagemErro(e)); } finally { setSalvando(false); }
  }
  return <Dialog header={inicial ? 'Editar marco' : 'Novo marco'} visible onHide={onClose} style={{ width: 'min(680px, 96vw)' }}
    footer={<><Button label="Cancelar" text onClick={onClose} /><Button label="Salvar marco" loading={salvando} onClick={salvar} /></>}>
    <div className="iv-form iv-form__grid">
      <FormField id="marco-nome" label="Marco" required full hint="Uma entrega ou decisão verificável."><InputText id="marco-nome" value={f.nome} maxLength={160} onChange={(e) => setF({ ...f, nome: e.target.value })} /></FormField>
      <FormField id="marco-entrega" label="Entrega esperada" full><InputTextarea id="marco-entrega" value={f.entrega} maxLength={1000} rows={2} onChange={(e) => setF({ ...f, entrega: e.target.value })} /></FormField>
      <FormField id="marco-responsavel" label="Responsável"><InputText id="marco-responsavel" value={f.responsavel} maxLength={120} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></FormField>
      <FormField id="marco-prazo" label="Prazo"><InputText id="marco-prazo" type="date" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} /></FormField>
      <FormField id="marco-situacao" label="Situação"><Dropdown inputId="marco-situacao" value={f.situacao} options={situacoes} onChange={(e) => setF({ ...f, situacao: e.value })} /></FormField>
    </div>{erro && <Message severity="error" text={erro} />}
  </Dialog>;
}

function InformeForm({ projetoId, inicial, onClose, onSalvo }: { projetoId: string; inicial: InformeProjeto | null; onClose: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({ data: inicial?.data ?? hoje(), condicao: inicial?.condicao ?? 'sem_avaliacao', avanco: inicial?.avanco ?? 0,
    resumo: inicial?.resumo ?? '', entregas: inicial?.entregas ?? '', proximosPassos: inicial?.proximosPassos ?? '', impedimentos: inicial?.impedimentos ?? '' });
  const [erro, setErro] = useState(''); const [salvando, setSalvando] = useState(false);
  async function salvar() {
    const b = InformeProjetoInSchema.safeParse(f);
    if (!b.success) return setErro('Informe um resumo de pelo menos 3 caracteres e avanço de 0 a 100%.');
    setSalvando(true); setErro('');
    try { if (inicial) await editarInformeProjeto(projetoId, inicial.id, b.data); else await criarInformeProjeto(projetoId, b.data); onSalvo(); }
    catch (e) { setErro(mensagemErro(e)); } finally { setSalvando(false); }
  }
  return <Dialog header={inicial ? 'Editar informe' : 'Novo informe de andamento'} visible onHide={onClose} style={{ width: 'min(720px, 96vw)' }}
    footer={<><Button label="Cancelar" text onClick={onClose} /><Button label="Salvar informe" loading={salvando} onClick={salvar} /></>}>
    <div className="iv-form iv-form__grid">
      <FormField id="informe-data" label="Data" required><InputText id="informe-data" type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></FormField>
      <FormField id="informe-condicao" label="Condição"><Dropdown inputId="informe-condicao" value={f.condicao} options={condicoes} onChange={(e) => setF({ ...f, condicao: e.value })} /></FormField>
      <FormField id="informe-avanco" label="Avanço (%)"><InputText id="informe-avanco" type="number" min={0} max={100} value={String(f.avanco)} onChange={(e) => setF({ ...f, avanco: Number(e.target.value) })} /></FormField>
      <FormField id="informe-resumo" label="Resumo do andamento" required full><InputTextarea id="informe-resumo" value={f.resumo} maxLength={2000} rows={3} onChange={(e) => setF({ ...f, resumo: e.target.value })} /></FormField>
      <FormField id="informe-entregas" label="Entregas realizadas" full><InputTextarea id="informe-entregas" value={f.entregas} maxLength={2000} rows={2} onChange={(e) => setF({ ...f, entregas: e.target.value })} /></FormField>
      <FormField id="informe-passos" label="Próximos passos" full><InputTextarea id="informe-passos" value={f.proximosPassos} maxLength={2000} rows={2} onChange={(e) => setF({ ...f, proximosPassos: e.target.value })} /></FormField>
      <FormField id="informe-impedimentos" label="Riscos ou impedimentos" full><InputTextarea id="informe-impedimentos" value={f.impedimentos} maxLength={2000} rows={2} onChange={(e) => setF({ ...f, impedimentos: e.target.value })} /></FormField>
    </div>{erro && <Message severity="error" text={erro} />}
  </Dialog>;
}
