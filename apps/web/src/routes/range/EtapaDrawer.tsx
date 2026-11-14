import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import type { RangeChecklistItem, RangeProgressoItem } from '@seginfo/shared';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { GRUPO_CHECKLIST_LABEL } from '@/theme/status';
import { preencher, type LabVars } from '@/services/rangePrompt';
import { TIPO_RECURSO_LABEL } from '@/data/rangeLab';
import { DominioPill, Secao } from '../pratica/Blocos';
import { CRITICIDADE_META, dataBR } from '../pratica/relacoes';
import { PromptEtapa } from './PromptEtapa';

interface Props {
  item: RangeChecklistItem;
  progresso: RangeProgressoItem;
  vars: LabVars;
  nav: { index: number; total: number; onIndex: (i: number) => void; onClose: () => void };
  onSave: (p: RangeProgressoItem) => void;
  onAbrirLab: () => void;
}

/** Ficha da etapa do Range: passos verificáveis, recursos que serão criados, prompt pronto e suas notas. */
export function EtapaDrawer({ item, progresso, vars, nav, onSave, onAbrirLab }: Props) {
  const crit = CRITICIDADE_META[item.criticidade];
  const exercicio = item.grupo === 'exercicio';
  const recursos = item.recursos ?? [];

  return (
    <DetailDrawer {...nav} wide ariaLabel={`Ficha da etapa ${item.titulo}`}
      kind={exercicio ? { icon: 'pi-bolt', label: 'Exercício do Range' } : { icon: 'pi-list-check', label: 'Etapa de preparação' }}
      status={<>
        {progresso.concluido ? <Pill label="Concluída" tone="ok" icon="pi-check" /> : <Pill label="Pendente" icon="pi-circle" />}
        <DominioPill dominio={item.dominio} />
        <Pill label={crit.label} tone={progresso.concluido ? undefined : crit.tone} />
      </>}
      title={item.titulo}
      subtitle={item.descricao}
      actions={progresso.concluido
        ? <Button label="Reabrir etapa" icon="pi pi-replay" outlined onClick={() => onSave({ ...progresso, concluido: false })} />
        : <Button label="Marcar como concluída" icon="pi pi-check" onClick={() => onSave({ ...progresso, concluido: true })} />}>

      <Secao titulo="Resumo">
        <DetailFields items={[
          ['Grupo', GRUPO_CHECKLIST_LABEL[item.grupo]],
          ['Criticidade', { alta: 'Alta', media: 'Média', baixa: 'Baixa' }[item.criticidade]],
          ['Referência', item.referencia ?? ''],
          ['Concluída em', dataBR(progresso.concluidoEm)],
        ]} />
      </Secao>

      <Secao titulo={`Passos para executar e dar check (${item.passos.length})`}>
        <ol className="pr-passos">{item.passos.map((p, i) => <li key={i}>{preencher(p, vars)}</li>)}</ol>
      </Secao>

      {recursos.length > 0 && (
        <Secao titulo={`O que você vai criar no ambiente (${recursos.length})`}>
          <ul className="pr-rel">
            {recursos.map((r, i) => (
              <li key={i}>
                <span className="pr-rel__nome">
                  <strong className="mono">{preencher(r.nome, vars)}</strong>
                  <small>{preencher(r.onde, vars)} · {preencher(r.detalhe, vars)}</small>
                </span>
                <Pill label={TIPO_RECURSO_LABEL[r.tipo]} />
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <Secao titulo="Prompt pronto para a IA">
        <PromptEtapa key={item.id} item={item} vars={vars} onAbrirLab={onAbrirLab} />
      </Secao>

      <Secao titulo="Suas notas">
        <div className="pr-form">
          <label>Notas (sem credenciais ou dados sensíveis)
            <InputTextarea value={progresso.notas} rows={4} autoResize onChange={(e) => onSave({ ...progresso, notas: e.target.value })}
              placeholder="Ex.: regra criada no firewall com ID 42, testada e funcionando." />
          </label>
          <small className="iv-muted">Salvo automaticamente neste navegador.</small>
        </div>
      </Secao>
    </DetailDrawer>
  );
}
