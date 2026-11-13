import { useState } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { MultiSelect } from 'primereact/multiselect';
import { Link } from '@tanstack/react-router';
import type { Lab } from '@seginfo/shared';
import { DetailSection } from '@/components/ui/Detail';
import { Pill, StatusStrip } from '@/components/InfraKit';
import { listAtivos } from '@/services/inventario';
import { listRangeAlvos } from '@/services/range';
import {
  deletePurpleExercise, EMPTY_PURPLE_EXERCISE, listPurpleExercises, savePurpleExercise,
  type PurpleExercise,
} from '@/services/exerciciosPurple';
import { todayISO } from '@/services/store';

const STATUS_OPTIONS = [
  { label: 'Planejado', value: 'planejado' }, { label: 'Executado', value: 'executado' },
  { label: 'Em remediação', value: 'remediacao' }, { label: 'Reteste aprovado', value: 'reteste_aprovado' },
  { label: 'Reteste falhou', value: 'reteste_falhou' },
];
const RESULT_OPTIONS = [
  { label: 'Confirmado', value: 'confirmado' }, { label: 'Não reproduzido', value: 'nao_reproduzido' },
  { label: 'Bloqueado pelo controle', value: 'bloqueado' }, { label: 'Inconclusivo', value: 'inconclusivo' },
];
const DETECTION_OPTIONS = [
  { label: 'Detectado', value: 'detectado' }, { label: 'Parcial', value: 'parcial' },
  { label: 'Não detectado', value: 'nao_detectado' }, { label: 'Ainda não testado', value: 'nao_testado' },
];
const RISK_OPTIONS = [
  { label: 'Sem achado', value: 'sem_achado' }, { label: 'Baixa', value: 'baixa' },
  { label: 'Média', value: 'media' }, { label: 'Alta', value: 'alta' }, { label: 'Crítica', value: 'critica' },
];
const RISK_LABEL: Record<PurpleExercise['severity'], string> = {
  sem_achado: 'Sem achado', baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica',
};

const INV = listAtivos({ rows: 10_000 }).items;
const RANGES = listRangeAlvos();
const ASSET_OPTIONS = INV.map((a) => ({ label: `${a.nome}${a.endereco ? ` · ${a.endereco}` : ''}`, value: a.id }));
const RANGE_OPTIONS = RANGES.map((a) => ({ label: `${a.nome}${a.vlan ? ` · ${a.vlan}` : ''}`, value: a.id }));

const LABEL_STATUS: Record<PurpleExercise['status'], string> = Object.fromEntries(STATUS_OPTIONS.map((x) => [x.value, x.label])) as Record<PurpleExercise['status'], string>;

export function PurpleExerciseJournal({ lab }: { lab: Lab }) {
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState<(Omit<PurpleExercise, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) | null>(null);
  const [techniqueText, setTechniqueText] = useState('');
  const [error, setError] = useState('');
  const records = listPurpleExercises(lab.id);
  const update = (patch: Partial<typeof draft>) => setDraft((current) => current ? { ...current, ...patch } : current);

  function novo() {
    setDraft({ ...EMPTY_PURPLE_EXERCISE(lab.id), title: `Exercício: ${lab.titulo}` });
    setTechniqueText((lab.mitre ?? []).join(', '));
    setError('');
  }

  function editar(record: PurpleExercise) {
    const { id, createdAt: _created, updatedAt: _updated, ...rest } = record;
    setDraft({ ...rest, id });
    setTechniqueText(record.techniques.join(', '));
    setError('');
  }

  function salvar() {
    if (!draft) return;
    const techniques = [...new Set(techniqueText.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter((x) => /^T\d{4}(\.\d{3})?$/.test(x)))];
    if (!draft.title.trim() || !draft.scope.trim()) { setError('Informe o nome do exercício e o escopo autorizado.'); return; }
    if (draft.status !== 'planejado' && !draft.authorized) { setError('Confirme a autorização antes de registrar execução.'); return; }
    if (draft.status !== 'planejado' && !draft.window.trim()) { setError('Informe a janela de execução.'); return; }
    if (draft.status !== 'planejado' && !draft.stopCondition.trim()) { setError('Defina uma condição para interromper o teste.'); return; }
    if (draft.status !== 'planejado' && !draft.rollback.trim()) { setError('Descreva como restaurar o alvo após o teste.'); return; }
    if (draft.status !== 'planejado' && !draft.exclusions.trim()) { setError('Liste os alvos excluídos ou escreva explicitamente “Nenhuma exclusão”.'); return; }
    if (draft.status !== 'planejado' && !draft.assetIds.length && !draft.rangeTargetIds.length) { setError('Selecione ao menos um ativo do ambiente ou alvo do Range.'); return; }
    if (draft.status !== 'planejado' && (!draft.redAction.trim() || !draft.expectedDetection.trim() || !draft.logSources.trim())) {
      setError('Registre a ação Red, a detecção esperada e as fontes de log antes de marcar o exercício como executado.'); return;
    }
    savePurpleExercise({ ...draft, title: draft.title.trim(), techniques });
    setDraft(null); setError(''); setRevision((n) => n + 1);
  }

  return (
    <DetailSection title="Registro de exercício Red × Blue">
      <p className="iv-muted" style={{ marginTop: 0 }}>Planeje o escopo e registre a execução do lado ofensivo, a telemetria defensiva, a correção e o reteste em um único lugar.</p>
      <div className="iv-row iv-wrap">
        <Button label="Planejar exercício" icon="pi pi-plus" onClick={novo} />
        <Link to="/attack" className="iv-row"><i className="pi pi-table" /> Matriz ATT&amp;CK</Link>
        <Link to="/radar" className="iv-row"><i className="pi pi-eye" /> Eventos reais no Radar</Link>
      </div>

      {draft && <div className="purple-exercise-form iv-card iv-mt" key={draft.id ?? 'new'}>
        <div className="iv-row" style={{ justifyContent: 'space-between' }}><h4>{draft.id ? 'Editar exercício' : 'Novo plano'}</h4><Button icon="pi pi-times" text rounded aria-label="Fechar formulário" onClick={() => setDraft(null)} /></div>
        <label>Nome do exercício<InputText value={draft.title} maxLength={160} onChange={(e) => update({ title: e.target.value })} /></label>
        <label>Referência do achado/CVE (opcional)<InputText value={draft.findingReference} maxLength={100} onChange={(e) => update({ findingReference: e.target.value.toUpperCase() })} placeholder="Ex.: CVE-2026-12345" /></label>
        <label>Ativos do homelab<MultiSelect value={draft.assetIds} options={ASSET_OPTIONS} onChange={(e) => update({ assetIds: e.value })} display="chip" filter placeholder="Selecione ativos autorizados" /></label>
        <label>Alvos isolados do Range<MultiSelect value={draft.rangeTargetIds} options={RANGE_OPTIONS} onChange={(e) => update({ rangeTargetIds: e.value })} display="chip" filter placeholder="Selecione alvos do Range" /></label>
        <label>Técnicas ATT&amp;CK (IDs separados por vírgula)<InputText value={techniqueText} onChange={(e) => setTechniqueText(e.target.value)} placeholder="T1059, T1053.005" /></label>
        <label>Status<Dropdown value={draft.status} options={STATUS_OPTIONS} onChange={(e) => update({ status: e.value })} /></label>
        <label>Escopo permitido<InputTextarea value={draft.scope} rows={2} autoResize maxLength={3000} onChange={(e) => update({ scope: e.target.value })} placeholder="Sistemas, contas e ações autorizadas para este exercício." /></label>
        <label>Exclusões explícitas<InputTextarea value={draft.exclusions} rows={2} autoResize maxLength={2000} onChange={(e) => update({ exclusions: e.target.value })} placeholder="Alvos e ações fora do escopo. Inclua produção e redes de terceiros." /></label>
        <div className="purple-exercise-form__grid">
          <label>Janela de teste<InputText value={draft.window} maxLength={300} onChange={(e) => update({ window: e.target.value })} placeholder="Data e horário local" /></label>
          <label>Condição de interrupção<InputText value={draft.stopCondition} maxLength={1000} onChange={(e) => update({ stopCondition: e.target.value })} placeholder="Ex.: impacto fora da VM de teste" /></label>
        </div>
        <label>Plano de rollback<InputTextarea value={draft.rollback} rows={2} autoResize maxLength={1000} onChange={(e) => update({ rollback: e.target.value })} placeholder="Snapshot, limpeza e validação de retorno ao estado limpo." /></label>
        {draft.status !== 'planejado' && <label className="purple-exercise-consent"><Checkbox checked={draft.authorized} onChange={(e) => update({ authorized: !!e.checked })} /> Confirmo que controlo estes alvos ou tenho autorização explícita para testá-los.</label>}

        <fieldset><legend>Red Team · execução</legend>
          <label>Ação e resultado observado<InputTextarea value={draft.redAction} rows={3} autoResize maxLength={3000} onChange={(e) => update({ redAction: e.target.value })} placeholder="Descreva o teste autorizado, sem incluir payloads destrutivos ou segredos." /></label>
          <label>Resultado<Dropdown value={draft.redResult} options={RESULT_OPTIONS} onChange={(e) => update({ redResult: e.value })} /></label>
        </fieldset>
        <fieldset><legend>Blue Team · detecção e resposta</legend>
          <label>Detecção esperada<InputTextarea value={draft.expectedDetection} rows={2} autoResize maxLength={1500} onChange={(e) => update({ expectedDetection: e.target.value })} placeholder="Alerta, regra ou comportamento que deveria aparecer." /></label>
          <label>Fontes de log<InputText value={draft.logSources} maxLength={500} onChange={(e) => update({ logSources: e.target.value })} placeholder="Ex.: Wazuh, Sysmon, FortiGate" /></label>
          <label>Resultado da detecção<Dropdown value={draft.detection} options={DETECTION_OPTIONS} onChange={(e) => update({ detection: e.value })} /></label>
          <div className="purple-exercise-form__grid">
            <label>Tempo até detectar (segundos)<InputNumber value={draft.detectionTimeSeconds ?? null} min={0} max={604800} onChange={(e) => update({ detectionTimeSeconds: e.value ?? undefined })} /></label>
            <label>Tempo até responder/conter (segundos)<InputNumber value={draft.responseTimeSeconds ?? null} min={0} max={604800} onChange={(e) => update({ responseTimeSeconds: e.value ?? undefined })} /></label>
          </div>
          <label>Triagem e resposta<InputTextarea value={draft.blueResponse} rows={2} autoResize maxLength={2000} onChange={(e) => update({ blueResponse: e.target.value })} placeholder="O que o Blue Team viu e como conteve/respondeu?" /></label>
        </fieldset>
        <fieldset><legend>Achado, correção e reteste</legend>
          <div className="purple-exercise-form__grid">
            <label>Impacto<Dropdown value={draft.severity} options={RISK_OPTIONS} onChange={(e) => update({ severity: e.value })} /></label>
            <label>Responsável<InputText value={draft.owner} maxLength={120} onChange={(e) => update({ owner: e.target.value })} /></label>
            <label>Prazo<InputText type="date" value={draft.dueDate} min={todayISO()} onChange={(e) => update({ dueDate: e.target.value })} /></label>
            <label>Reteste<Dropdown value={draft.retestResult} options={[{ label: 'Pendente', value: 'pendente' }, { label: 'Aprovado', value: 'aprovado' }, { label: 'Falhou', value: 'falhou' }]} onChange={(e) => update({ retestResult: e.value })} /></label>
          </div>
          <label>Remediação e próximo passo<InputTextarea value={draft.remediation} rows={2} autoResize maxLength={2000} onChange={(e) => update({ remediation: e.target.value })} placeholder="Correção aplicada ou ação que continua pendente." /></label>
          <label>Referência de evidência não sensível<InputText value={draft.evidence} maxLength={1500} onChange={(e) => update({ evidence: e.target.value })} placeholder="ID do alerta, caminho local ou hash; não cole logs com segredos." /></label>
        </fieldset>
        {error && <small className="p-error" role="alert">{error}</small>}
        <div className="iv-row iv-wrap"><Button label="Salvar exercício" icon="pi pi-save" onClick={salvar} /><Button label="Cancelar" text onClick={() => setDraft(null)} /></div>
      </div>}

      <div className="purple-exercise-list iv-mt" key={revision}>
        {records.length === 0 ? <p className="iv-muted">Nenhum exercício registrado para este lab.</p> : records.map((record) => (
          <article className="iv-card purple-exercise-record" key={record.id}>
            <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
              <strong>{record.title}</strong><Pill label={LABEL_STATUS[record.status]} />
            </div>
            <div className="iv-row iv-wrap">
              {record.findingReference && <Pill label={record.findingReference} />}
              {record.techniques.map((id) => <Link key={id} to="/attack" className="mono">{id}</Link>)}
              <Pill label={`Detecção: ${DETECTION_OPTIONS.find((x) => x.value === record.detection)?.label}`} />
              <Pill label={`Impacto: ${RISK_LABEL[record.severity]}`} />
            </div>
            <p className="iv-muted">Escopo: {record.scope}</p>
            <p><strong>Red:</strong> {record.redAction || 'Execução ainda não registrada.'}</p>
            <p><strong>Blue:</strong> {record.blueResponse || 'Resposta ainda não registrada.'}</p>
            {(record.detectionTimeSeconds !== undefined || record.responseTimeSeconds !== undefined) && <small>
              {record.detectionTimeSeconds !== undefined && `Detecção ${record.detectionTimeSeconds}s`}
              {record.detectionTimeSeconds !== undefined && record.responseTimeSeconds !== undefined && ' · '}
              {record.responseTimeSeconds !== undefined && `Resposta ${record.responseTimeSeconds}s`}
            </small>}
            {record.remediation && <p><strong>Correção:</strong> {record.remediation}</p>}
            {record.dueDate && <small>Prazo: {new Date(`${record.dueDate}T12:00:00`).toLocaleDateString('pt-BR')}</small>}
            <div className="iv-row iv-wrap">
              <Button label="Editar" icon="pi pi-pencil" text size="small" onClick={() => editar(record)} />
              <Button label="Excluir" icon="pi pi-trash" text severity="danger" size="small" onClick={() => { deletePurpleExercise(record.id); setRevision((n) => n + 1); }} />
            </div>
          </article>
        ))}
      </div>
    </DetailSection>
  );
}
