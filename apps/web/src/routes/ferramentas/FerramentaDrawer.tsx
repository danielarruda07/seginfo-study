import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import type { FerramentaCatalogo } from '@seginfo/shared';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { Pill } from '@/components/InfraKit';
import { listExperiencias, listFerramentas } from '@/services/ferramentas';
import { getProgressoLab, listLabs } from '@/services/inventario';
import { listRangeAlvos } from '@/services/range';
import { getTopico } from '@/services/catalog';
import { CATEGORIA_RANGE_LABEL, FASE_FERRAMENTA_LABEL } from '@/theme/status';
import { DominioPill, ListaRelacionados, Secao } from '../pratica/Blocos';
import { alvosComFerramenta, labsDaFerramenta } from '../pratica/relacoes';
import { ESTADO_LAB_META } from '../labs/estado';
import { ExperienciaForm, ExperienciaLista } from './Experiencias';

interface Props {
  ferramenta: FerramentaCatalogo;
  nav: { index: number; total: number; onIndex: (i: number) => void; onClose: () => void };
  onChanged: (msg?: string) => void;
}

/** Ficha da ferramenta: onde praticar (Range e labs), estudo relacionado e o seu histórico de uso. */
export function FerramentaDrawer({ ferramenta: f, nav, onChanged }: Props) {
  // formulário aberto só para a ferramenta em que foi pedido (↑/↓ troca de item sem remontar a ficha)
  const [novoPara, setNovoPara] = useState<string | null>(null);
  const novo = novoPara === f.id;
  const registros = listExperiencias(f.id);
  const todosAlvos = listRangeAlvos();
  const alvos = alvosComFerramenta(f, todosAlvos);
  // ferramenta empacotada no Kali já está disponível na VM atacante do Range
  const kaliVm = f.kali ? todosAlvos.find((a) => a.categoria === 'vm_atacante' && /kali/i.test(a.nome)) : undefined;
  const ondePraticar = kaliVm && !alvos.includes(kaliVm) ? [...alvos, kaliVm] : alvos;
  const labs = labsDaFerramenta(f, listLabs());
  const topico = f.topicoId ? getTopico(f.topicoId) : undefined;
  const mesmaFase = listFerramentas().filter((x) => x.fase === f.fase && x.id !== f.id);

  return (
    <DetailDrawer {...nav} kind={{ icon: 'pi-wrench', label: 'Ferramenta' }} ariaLabel={`Ficha da ferramenta ${f.nome}`}
      status={<>
        <DominioPill dominio={f.dominio} />
        <Pill label={FASE_FERRAMENTA_LABEL[f.fase]} />
        {f.kali && <Pill label="Vem no Kali Linux" icon="pi-desktop" />}
      </>}
      title={f.nome}
      subtitle={f.descricao}
      actions={<>
        <Button label="Registrar experiência" icon="pi pi-plus" onClick={() => setNovoPara(f.id)} disabled={novo} />
        {f.url && (
          <a className="p-button p-component p-button-outlined" href={f.url} target="_blank" rel="noopener noreferrer">
            <span className="p-button-icon p-button-icon-left pi pi-external-link" aria-hidden="true" />
            <span className="p-button-label">Site oficial</span>
          </a>
        )}
      </>}>

      <Secao titulo={`Sua experiência (${registros.length})`}>
        {novo && <ExperienciaForm key={f.id} ferramentaId={f.id} onCancel={() => setNovoPara(null)}
          onSaved={(titulo) => { setNovoPara(null); onChanged(`Registro salvo: ${titulo}`); }} />}
        <ExperienciaLista registros={registros} onRemoved={() => onChanged()} />
      </Secao>

      <Secao titulo="Onde praticar no seu Range">
        <ListaRelacionados itens={ondePraticar} chave={(a) => a.id}
          vazio="Nenhum alvo do Range prevê esta ferramenta. Rode-a a partir da VM atacante, sempre dentro do segmento isolado."
          nome={(a) => a.nome} sub={(a) => [CATEGORIA_RANGE_LABEL[a.categoria], a.vlan].filter(Boolean).join(' · ')}
          aside={(a) => <DominioPill dominio={a.dominio} />} />
        <p className="pr-vazio iv-mt"><Link to="/range">Abrir o Range Vulnerável</Link> para conferir o isolamento antes de usar.</p>
      </Secao>

      <Secao titulo="Labs em que ela entra">
        <ListaRelacionados itens={labs} chave={(l) => l.id} vazio="Nenhum lab cita esta ferramenta ainda."
          nome={(l) => l.titulo}
          aside={(l) => { const e = ESTADO_LAB_META[getProgressoLab(l.id).status]; return <Pill label={e.label} tone={e.tone} icon={e.icon} />; }} />
        {labs.length > 0 && <p className="pr-vazio iv-mt">Passos e registro de cada um em <Link to="/labs">Labs Práticos</Link>.</p>}
      </Secao>

      <Secao titulo="Estudo relacionado">
        {topico
          ? <p className="pr-texto">Tópico: <Link to="/trilhas/$trilhaId" params={{ trilhaId: topico.trilhaId }}>{topico.titulo}</Link></p>
          : <p className="pr-vazio">Sem tópico de estudo ligado a esta ferramenta.</p>}
      </Secao>

      {mesmaFase.length > 0 && (
        <Secao titulo={`Alternativas na mesma fase (${mesmaFase.length})`}>
          <div className="pr-pills">{mesmaFase.map((x) => <Pill key={x.id} label={x.nome} icon={x.kali ? 'pi-desktop' : undefined} />)}</div>
        </Secao>
      )}
    </DetailDrawer>
  );
}
