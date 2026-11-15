import { Button } from 'primereact/button';
import type { IdeiaLinkedin } from '@seginfo/shared';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { ORIGEM_IDEIA_LABEL, dataHoraCurta, fusoDoNavegador } from './pipelineRegras';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;
const dataBr = (d: string) => d.split('-').reverse().join('/');

/** Ficha da ideia: briefing completo, de onde veio e os próximos passos (escrever, editar, descartar). */
export function IdeiaDrawer({ ideia: i, nav, projeto, ocupado, onEscrever, onEditar, onStatus, onExcluir }: {
  ideia: IdeiaLinkedin; nav: Nav; projeto: string | null; ocupado: boolean;
  onEscrever: () => void; onEditar: () => void;
  onStatus: (status: 'nova' | 'descartada') => void;
  onExcluir: () => void;
}) {
  return (
    <DetailDrawer {...nav} kind={{ icon: 'pi-lightbulb', label: 'Ideia de post' }} ariaLabel={`Ficha da ideia ${i.titulo}`}
      status={<>
        {i.status === 'nova' && <Pill label="Nova" tone="info" />}
        {i.status === 'em_rascunho' && <Pill label="Em rascunho" tone="ok" icon="pi-file-edit" />}
        {i.status === 'descartada' && <Pill label="Descartada" tone="muted" />}
        {projeto && <Pill label={projeto} icon="pi-folder" />}
        {i.pilar && <Pill label={i.pilar} />}
      </>}
      title={i.titulo}
      subtitle={ORIGEM_IDEIA_LABEL[i.origem]}
      actions={<>
        {i.status !== 'descartada' && <Button label={i.status === 'em_rascunho' ? 'Escrever outro post' : 'Escrever no Estúdio'} icon="pi pi-pencil" size="small" onClick={onEscrever} />}
        <Button label="Editar" icon="pi pi-pen-to-square" size="small" outlined onClick={onEditar} />
        {i.status === 'descartada'
          ? <Button label="Reativar" icon="pi pi-replay" size="small" outlined disabled={ocupado} onClick={() => onStatus('nova')} />
          : <Button label="Descartar" icon="pi pi-times" size="small" text disabled={ocupado} onClick={() => onStatus('descartada')} />}
        <Button label="Excluir" icon="pi pi-trash" size="small" text severity="danger" onClick={onExcluir} />
      </>}>
      <section>
        <h3 className="iv-section-label">Briefing</h3>
        {i.briefing ? <div className="ca-texto">{i.briefing}</div>
          : <p className="iv-muted ca-small">Sem briefing. Ao escrever, o título vira o pedido para a IA; vale detalhar antes.</p>}
      </section>
      {i.status === 'em_rascunho' && (
        <p className="ca-aviso" role="status"><i className="pi pi-info-circle" aria-hidden="true" /> Esta ideia já virou rascunho: acompanhe na aba Pipeline.</p>
      )}
      <section>
        <h3 className="iv-section-label">Dados</h3>
        <DetailFields items={[
          ['Origem', ORIGEM_IDEIA_LABEL[i.origem]],
          ['Projeto', projeto ?? ''],
          ['Pilar', i.pilar ?? ''],
          ['Formato', i.formato ?? ''],
          ['Sugerida para', i.sugeridaPara ? dataBr(i.sugeridaPara) : ''],
          ['Anotada em', dataHoraCurta(i.criadoEm, fusoDoNavegador())],
        ]} />
      </section>
    </DetailDrawer>
  );
}
