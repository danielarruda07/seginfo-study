import { useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { copyToClipboard } from '@/lib/clipboard';
import type { Avaliacao } from '@/services/agentes';
import { RESULTADO_META, duracao, truncar } from '../regras';
import { MetaPill, Secao, Vazio } from './comum';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Ficha de um caso de teste: entrada, critério, observação e o que fazer com ele. */
export function CasoFicha({ c, agenteNome, nav, onRemover }: { c: Avaliacao; agenteNome?: string; nav: Nav; onRemover: (c: Avaliacao) => void }) {
  const navigate = useNavigate();
  const rodar = () => {
    copyToClipboard(c.caso);
    navigate({ to: '/agents/agente/$agenteId/playground', params: { agenteId: c.agenteId }, search: {} });
  };

  return (
    <DetailDrawer {...nav} kind={{ icon: 'pi-check-square', label: 'Caso de teste' }} ariaLabel={`Caso de teste: ${truncar(c.caso, 60)}`}
      status={<MetaPill m={RESULTADO_META[c.resultado]} />}
      title={truncar(c.caso, 120)}
      subtitle={agenteNome ? `Agente ${agenteNome}` : undefined}
      actions={<>
        <Button label="Copiar e rodar de novo" icon="pi pi-play" size="small" onClick={rodar}
          tooltip="Copia a entrada e abre o playground; cole e execute" tooltipOptions={{ position: 'bottom' }} />
        <Button label="Remover" icon="pi pi-trash" size="small" severity="danger" outlined onClick={() => onRemover(c)} />
      </>}>

      <Secao titulo="Entrada do teste">
        <p className="agd-texto">{c.caso}</p>
      </Secao>
      <Secao titulo="Critério">
        {c.criterio.trim() ? <p className="agd-texto">{c.criterio}</p> : <Vazio>Sem critério escrito. Sem ele, o resultado depende de quem avalia.</Vazio>}
      </Secao>
      <Secao titulo="Observação">
        {c.observacao.trim() ? <p className="agd-texto">{c.observacao}</p> : <Vazio>—</Vazio>}
      </Secao>
      <Secao titulo="Registro">
        <DetailFields items={[
          ['Resultado', RESULTADO_META[c.resultado].rotulo],
          ['Latência', c.latenciaMs !== null ? duracao(c.latenciaMs) : ''],
          ['Registrado em', new Date(c.criadoEm).toLocaleString('pt-BR')],
        ]} />
      </Secao>
      {c.resultado !== 'ok' && (
        <Secao titulo="Próximo passo">
          <p className="agd-texto">Ajuste as instruções, as ferramentas ou o modelo no editor e rode este caso de novo. Registre o novo resultado; mantenha este como histórico.</p>
          <Button label="Abrir o editor" icon="pi pi-pencil" size="small" outlined className="iv-mt"
            onClick={() => navigate({ to: '/agents/agente/$agenteId', params: { agenteId: c.agenteId } })} />
        </Secao>
      )}
    </DetailDrawer>
  );
}
