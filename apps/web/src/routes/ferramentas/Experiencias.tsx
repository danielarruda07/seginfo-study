import { useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { confirmDialog } from 'primereact/confirmdialog';
import { Pill } from '@/components/InfraKit';
import { addExperiencia, removeExperiencia, todayISO, type ExperienciaFerramenta } from '@/services/ferramentas';
import type { Tone } from '@/theme/status';
import { dataBR } from '../pratica/relacoes';

const TIPO: Record<ExperienciaFerramenta['tipo'], { label: string; tone?: Tone; icon: string }> = {
  teste: { label: 'Teste realizado', tone: 'info', icon: 'pi-play' },
  observacao: { label: 'Observação', icon: 'pi-eye' },
  pendencia: { label: 'Pendência', tone: 'warning', icon: 'pi-exclamation-circle' },
};
const TIPO_OPTS = (Object.keys(TIPO) as ExperienciaFerramenta['tipo'][]).map((value) => ({ value, label: TIPO[value].label }));
const RESULTADO: Record<ExperienciaFerramenta['resultado'], { label: string; tone?: Tone }> = {
  positivo: { label: 'Funcionou como esperado', tone: 'ok' },
  parcial: { label: 'Resultado parcial', tone: 'warning' },
  negativo: { label: 'Não funcionou', tone: 'danger' },
  nao_aplicavel: { label: 'Não se aplica' },
};
const RESULTADO_OPTS = (Object.keys(RESULTADO) as ExperienciaFerramenta['resultado'][]).map((value) => ({ value, label: RESULTADO[value].label }));

/** Formulário de novo registro de experiência com a ferramenta. */
export function ExperienciaForm({ ferramentaId, onSaved, onCancel }: { ferramentaId: string; onSaved: (titulo: string) => void; onCancel: () => void }) {
  const [tipo, setTipo] = useState<ExperienciaFerramenta['tipo']>('teste');
  const [data, setData] = useState(todayISO());
  const [titulo, setTitulo] = useState('');
  const [ambiente, setAmbiente] = useState('');
  const [resultado, setResultado] = useState<ExperienciaFerramenta['resultado']>('positivo');
  const [relato, setRelato] = useState('');
  const [proximoPasso, setProximoPasso] = useState('');
  const [erro, setErro] = useState('');

  function salvar() {
    if (!titulo.trim() || !relato.trim()) { setErro('Preencha o título e o relato para salvar.'); return; }
    addExperiencia({ ferramentaId, tipo, data, titulo: titulo.trim(), ambiente: ambiente.trim(), resultado: tipo === 'teste' ? resultado : 'nao_aplicavel', relato: relato.trim(), proximoPasso: proximoPasso.trim() });
    onSaved(titulo.trim());
  }

  return (
    <div className="pr-form pr-form--novo">
      <div className="pr-form__linha">
        <label>Tipo<Dropdown value={tipo} options={TIPO_OPTS} onChange={(e) => setTipo(e.value)} /></label>
        <label>Título *<InputText value={titulo} maxLength={120} autoFocus onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Primeira varredura no Range" /></label>
      </div>
      <div className="pr-form__linha">
        <label>Data<InputText type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
        <label>Ambiente<InputText value={ambiente} onChange={(e) => setAmbiente(e.target.value)} placeholder="Ex.: Kali na VLAN do Range" /></label>
      </div>
      {tipo === 'teste' && <label>Resultado<Dropdown value={resultado} options={RESULTADO_OPTS} onChange={(e) => setResultado(e.value)} /></label>}
      <label>Relato *<InputTextarea value={relato} maxLength={5000} rows={4} autoResize onChange={(e) => setRelato(e.target.value)} placeholder="O que você testou, observou e qual evidência sustenta a conclusão? Sem credenciais." /></label>
      <label>Próximo passo ou pendência<InputTextarea value={proximoPasso} maxLength={2000} rows={2} autoResize onChange={(e) => setProximoPasso(e.target.value)} placeholder="O que falta validar ou fazer depois?" /></label>
      {erro && <small className="p-error" role="alert">{erro}</small>}
      <div className="iv-form__footer">
        <small>* obrigatório</small>
        <Button label="Cancelar" text onClick={onCancel} />
        <Button label="Salvar registro" icon="pi pi-save" onClick={salvar} />
      </div>
    </div>
  );
}

/** Histórico de registros, do mais recente ao mais antigo. */
export function ExperienciaLista({ registros, onRemoved }: { registros: ExperienciaFerramenta[]; onRemoved: () => void }) {
  if (registros.length === 0) return <p className="pr-vazio">Nenhum registro ainda. Testes, observações e pendências que você anotar aparecem aqui e no cartão.</p>;
  const excluir = (r: ExperienciaFerramenta) => confirmDialog({
    header: 'Excluir registro', icon: 'pi pi-exclamation-triangle',
    message: <span>Excluir o registro <strong>{r.titulo}</strong>?</span>,
    acceptLabel: 'Excluir', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
    accept: () => { removeExperiencia(r.id); onRemoved(); },
  });
  return (
    <ul className="pr-registros">
      {registros.map((r) => (
        <li key={r.id} className="pr-registro">
          <div className="pr-registro__top">
            <div>
              <span className="iv-row iv-wrap">
                <Pill label={TIPO[r.tipo].label} tone={TIPO[r.tipo].tone} icon={TIPO[r.tipo].icon} />
                {r.tipo === 'teste' && <Pill label={RESULTADO[r.resultado].label} tone={RESULTADO[r.resultado].tone} />}
              </span>
              <h4>{r.titulo}</h4>
            </div>
            <Button icon="pi pi-trash" text rounded severity="danger" size="small" aria-label={`Excluir registro ${r.titulo}`} tooltip="Excluir" onClick={() => excluir(r)} />
          </div>
          <small className="tabular">{dataBR(r.data)}{r.ambiente && ` · ${r.ambiente}`}</small>
          <p className="pr-texto">{r.relato}</p>
          {r.proximoPasso && <div className="pr-registro__prox"><strong>Próximo passo / pendência</strong><p>{r.proximoPasso}</p></div>}
        </li>
      ))}
    </ul>
  );
}
