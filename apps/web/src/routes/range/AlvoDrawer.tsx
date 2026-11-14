import { Link } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import type { RangeAlvo } from '@seginfo/shared';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { listFerramentas } from '@/services/ferramentas';
import { getLab, getProgressoLab } from '@/services/inventario';
import { listPurpleExercises } from '@/services/exerciciosPurple';
import { CATEGORIA_RANGE_LABEL, DOMINIO_LAB, FASE_FERRAMENTA_LABEL } from '@/theme/status';
import { DominioPill, ListaRelacionados, Secao, TecnicasAttack } from '../pratica/Blocos';
import { exerciciosDoAlvo, ferramentasCitadas } from '../pratica/relacoes';
import { ESTADO_LAB_META } from '../labs/estado';
import { CATEGORIA_ICON } from './meta';

interface Props {
  alvo: RangeAlvo;
  nav: { index: number; total: number; onIndex: (i: number) => void; onClose: () => void };
  prepPct: number;
  onVerChecklist: () => void;
}

const DETECCAO: Record<string, string> = { detectado: 'Detectado', parcial: 'Detecção parcial', nao_detectado: 'Não detectado', nao_testado: 'Detecção não testada' };

/** Ficha do alvo do Range: o que está exposto, o que roda nele, lab e exercícios ligados, e o lembrete de isolamento. */
export function AlvoDrawer({ alvo, nav, prepPct, onVerChecklist }: Props) {
  const catalogo = listFerramentas();
  const ferramentas = alvo.ferramentas.map((nome) => ({ nome, noArsenal: ferramentasCitadas([nome], catalogo)[0] }));
  const lab = alvo.labId ? getLab(alvo.labId) : undefined;
  const exercicios = exerciciosDoAlvo(alvo.id, listPurpleExercises());
  const ofensivo = alvo.categoria === 'vm_vitima' || alvo.categoria === 'vm_atacante' || alvo.categoria === 'servico_exposto';

  return (
    <DetailDrawer {...nav} kind={{ icon: CATEGORIA_ICON[alvo.categoria], label: CATEGORIA_RANGE_LABEL[alvo.categoria] }}
      ariaLabel={`Ficha do alvo ${alvo.nome}`}
      status={<DominioPill dominio={alvo.dominio} />}
      title={alvo.nome}
      subtitle={alvo.descricao}
      actions={prepPct < 100 ? <Button label="Ver checklist de preparação" icon="pi pi-list-check" outlined onClick={onVerChecklist} /> : undefined}>

      {ofensivo && (
        <section>
          <div className={`pr-destaque ${prepPct < 100 ? 'tone-warning' : 'tone-ok'}`}>
            <i className={`pi ${prepPct < 100 ? 'pi-exclamation-triangle' : 'pi-check-circle'}`} aria-hidden="true" />
            <span>{prepPct < 100
              ? <>Preparação do Range em {prepPct}%. Só use este alvo depois do isolamento, snapshots e credenciais exclusivas estarem prontos.</>
              : <>Preparação do Range concluída. Mesmo assim, tire um snapshot limpo antes de cada exercício.</>}</span>
          </div>
        </section>
      )}

      <Secao titulo="Identificação">
        <DetailFields items={[
          ['Categoria', CATEGORIA_RANGE_LABEL[alvo.categoria]],
          ['Domínio', DOMINIO_LAB[alvo.dominio].label],
          ['Segmento', alvo.vlan ? <span className="mono">{alvo.vlan}</span> : ''],
        ]} />
      </Secao>

      <Secao titulo={`Portas e serviços abertos de propósito (${alvo.portas.length})`}>
        {alvo.portas.length === 0 ? <p className="pr-vazio">Nenhuma porta exposta: este item é de rede ou análise.</p> : (
          <ul className="pr-rel">{alvo.portas.map((p) => <li key={p}><span className="mono">{p}</span></li>)}</ul>
        )}
      </Secao>

      <Secao titulo="Ferramentas e agentes">
        <ListaRelacionados itens={ferramentas} chave={(f) => f.nome} vazio="Nenhuma ferramenta prevista."
          nome={(f) => f.nome} sub={(f) => f.noArsenal ? FASE_FERRAMENTA_LABEL[f.noArsenal.fase] : undefined}
          aside={(f) => f.noArsenal ? <Link to="/ferramentas" className="iv-pill" title="Ver no Arsenal de Ferramentas"><i className="pi pi-wrench" aria-hidden="true" />No Arsenal</Link> : null} />
      </Secao>

      <Secao titulo="Técnicas ATT&CK">
        <TecnicasAttack ids={alvo.mitre ?? []} vazio="Nenhuma técnica mapeada para este alvo." />
      </Secao>

      <Secao titulo="Lab relacionado">
        {lab ? (
          <ListaRelacionados itens={[lab]} chave={(l) => l.id} vazio=""
            nome={(l) => <Link to="/labs">{l.titulo}</Link>}
            aside={(l) => { const e = ESTADO_LAB_META[getProgressoLab(l.id).status]; return <Pill label={e.label} tone={e.tone} icon={e.icon} />; }} />
        ) : <p className="pr-vazio">Nenhum lab aponta para este alvo.</p>}
      </Secao>

      <Secao titulo={`Exercícios Red × Blue neste alvo (${exercicios.length})`}>
        <ListaRelacionados itens={exercicios} chave={(e) => e.id}
          vazio="Nenhum exercício registrado com este alvo. Planeje um na ficha do lab, em Labs Práticos."
          nome={(e) => e.title} sub={(e) => DETECCAO[e.detection]}
          aside={(e) => <Pill label={e.retestResult === 'aprovado' ? 'Reteste ok' : e.status === 'planejado' ? 'Planejado' : 'Executado'}
            tone={e.retestResult === 'aprovado' ? 'ok' : (e.detection === 'parcial' || e.detection === 'nao_detectado') ? 'warning' : undefined} />} />
      </Secao>
    </DetailDrawer>
  );
}
