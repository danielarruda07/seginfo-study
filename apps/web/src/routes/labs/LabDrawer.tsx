import { Link } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import type { Lab } from '@seginfo/shared';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { Pill } from '@/components/InfraKit';
import { getAtivo, type ProgressoLab } from '@/services/inventario';
import { listFerramentas } from '@/services/ferramentas';
import { listRangeAlvos } from '@/services/range';
import { getTopico } from '@/services/catalog';
import { CATEGORIA_RANGE_LABEL, FASE_FERRAMENTA_LABEL } from '@/theme/status';
import { ESTADO_META } from '../inventario/regras';
import { DominioPill, ListaRelacionados, Secao, TecnicasAttack } from '../pratica/Blocos';
import { NIVEL_LABEL, alvosDoLab, dataBR, ferramentasDoLab } from '../pratica/relacoes';
import { ESTADO_LAB_META, proximoEstado } from './estado';
import { LabProgressoForm } from './LabProgressoForm';
import { PurpleExerciseJournal } from './PurpleExerciseJournal';

interface Props {
  lab: Lab;
  progresso: ProgressoLab;
  nav: { index: number; total: number; onIndex: (i: number) => void; onClose: () => void };
  onSave: (p: ProgressoLab) => void;
  onDraft: () => void;
  onExerciciosChange: () => void;
}

/** Ficha do lab: o que fazer, onde (ativos e alvos do Range), com quê (ferramentas), progresso e registro Red × Blue. */
export function LabDrawer({ lab, progresso, nav, onSave, onDraft, onExerciciosChange }: Props) {
  const estado = ESTADO_LAB_META[progresso.status];
  const proximo = proximoEstado(progresso.status);
  const topico = lab.topicoId ? getTopico(lab.topicoId) : undefined;
  const ferramentas = ferramentasDoLab(lab, listFerramentas());
  const alvos = alvosDoLab(lab.id, listRangeAlvos());
  const ativos = lab.ativosAlvo.map((id) => ({ id, ativo: getAtivo(id) }));
  const tecnicas = [...new Set([...(lab.mitre ?? []), ...progresso.mitre])];

  return (
    <DetailDrawer {...nav} wide kind={{ icon: 'pi-play-circle', label: 'Lab prático' }} ariaLabel={`Ficha do lab ${lab.titulo}`}
      status={<>
        <Pill label={estado.label} tone={estado.tone} icon={estado.icon} />
        <DominioPill dominio={lab.dominio} />
        <Pill label={NIVEL_LABEL[lab.nivel]} />
      </>}
      title={lab.titulo}
      subtitle={lab.objetivo}
      actions={<>
        {proximo && <Button label={proximo.rotulo} icon={proximo.icon} onClick={() => onSave({ ...progresso, status: proximo.para })} />}
        {progresso.status === 'concluido' && <Button label="Criar ideia de post" icon="pi pi-linkedin" onClick={onDraft} />}
        {progresso.status === 'concluido' && <Button label="Reabrir" icon="pi pi-replay" outlined onClick={() => onSave({ ...progresso, status: 'em_andamento' })} />}
      </>}>

      <Secao titulo="Resultado esperado">
        <div className="pr-destaque tone-ok"><i className="pi pi-flag" aria-hidden="true" /><span>{lab.resultadoEsperado}</span></div>
        {progresso.concluidoEm && <p className="pr-vazio iv-mt">Você concluiu este lab em {dataBR(progresso.concluidoEm)}.</p>}
      </Secao>

      <Secao titulo={`Passos (${lab.passos.length})`}>
        <ol className="pr-passos">{lab.passos.map((p, i) => <li key={i}>{p}</li>)}</ol>
      </Secao>

      <Secao titulo="Ativos-alvo do seu ambiente">
        <ListaRelacionados itens={ativos} chave={(x) => x.id} vazio="Este lab não aponta ativos do inventário."
          nome={(x) => x.ativo?.nome ?? <span className="mono">{x.id}</span>}
          sub={(x) => x.ativo ? <span className="mono">{x.ativo.endereco || 'sem endereço'}</span> : 'Não cadastrado em Meu Ambiente'}
          aside={(x) => x.ativo
            ? <Pill label={ESTADO_META[x.ativo.estado].label} tone={ESTADO_META[x.ativo.estado].tone} icon={ESTADO_META[x.ativo.estado].icon} />
            : <Pill label="Faltando" tone="muted" icon="pi-question-circle" />} />
        <p className="pr-vazio iv-mt"><Link to="/ambiente">Abrir Meu Ambiente</Link> para conferir endereços e estado antes de praticar.</p>
      </Secao>

      {alvos.length > 0 && (
        <Secao titulo="Alvos do Range para este lab">
          <ListaRelacionados itens={alvos} chave={(a) => a.id} vazio=""
            nome={(a) => a.nome} sub={(a) => [CATEGORIA_RANGE_LABEL[a.categoria], a.vlan].filter(Boolean).join(' · ')}
            aside={(a) => <DominioPill dominio={a.dominio} />} />
          <p className="pr-vazio iv-mt">Prepare o segmento isolado no <Link to="/range">Range Vulnerável</Link> antes de executar.</p>
        </Secao>
      )}

      <Secao titulo="Ferramentas que entram neste lab">
        <ListaRelacionados itens={ferramentas} chave={(f) => f.id} vazio="Nenhuma ferramenta do Arsenal ligada a este lab."
          nome={(f) => f.nome} sub={(f) => FASE_FERRAMENTA_LABEL[f.fase]}
          aside={(f) => f.kali ? <Pill label="Kali" icon="pi-desktop" /> : null} />
        {ferramentas.length > 0 && <p className="pr-vazio iv-mt">Comandos e anotações de cada uma no <Link to="/ferramentas">Arsenal de Ferramentas</Link>.</p>}
      </Secao>

      <Secao titulo="Estudo e técnicas ATT&CK">
        {topico
          ? <p className="pr-texto">Tópico: <Link to="/trilhas/$trilhaId" params={{ trilhaId: topico.trilhaId }}>{topico.titulo}</Link></p>
          : <p className="pr-vazio">Sem tópico de estudo ligado.</p>}
        <div className="iv-mt"><TecnicasAttack ids={tecnicas} /></div>
      </Secao>

      <Secao titulo="Seu progresso">
        <LabProgressoForm key={lab.id} progresso={progresso} onSave={onSave} />
      </Secao>

      <section>
        <PurpleExerciseJournal lab={lab} onChange={onExerciciosChange} />
      </section>
    </DetailDrawer>
  );
}
