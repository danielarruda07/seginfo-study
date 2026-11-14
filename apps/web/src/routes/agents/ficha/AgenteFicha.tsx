import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { Pill } from '@/components/InfraKit';
import { getAgente, type AgenteResumo } from '@/services/agentes';
import { LinkPasso } from '../home/AgenteCard';
import { STATUS_LABEL, STATUS_PILL, etapas, proximoPasso, tempoRelativo } from '../home/regras';
import { Secao, Vazio } from './comum';
import { Avaliacoes, Execucoes, Pilares, Revisao } from './AgenteSecoes';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/**
 * Ficha do agente na home: ciclo de vida, próximo passo, pendências da revisão, os 8 pilares,
 * últimas execuções e placar. O projeto completo só é buscado quando a ficha abre.
 */
export function AgenteFicha({ a, nav }: { a: AgenteResumo; nav: Nav }) {
  const navigate = useNavigate();
  const projeto = useQuery({ queryKey: ['agente', a.id], queryFn: () => getAgente(a.id) });
  const passo = proximoPasso(a);
  const st = STATUS_PILL[a.status];
  const arquivado = a.status === 'arquivado';
  const params = { agenteId: a.id };

  return (
    <DetailDrawer {...nav} wide kind={{ icon: 'pi-sparkles', label: 'Agente' }} ariaLabel={`Ficha de ${a.nome}`}
      status={<>
        <Pill label={STATUS_LABEL[a.status]} tone={st.tone} icon={st.icon} />
        <span className="agd-mudo">Editado {tempoRelativo(a.atualizadoEm)}</span>
      </>}
      title={a.nome}
      subtitle={a.resumo || 'Sem descrição.'}
      actions={<>
        {!arquivado && <Button label="Executar" icon="pi pi-play" size="small" onClick={() => navigate({ to: '/agents/agente/$agenteId/playground', params, search: {} })} />}
        <Button label="Editar" icon="pi pi-pencil" size="small" outlined onClick={() => navigate({ to: '/agents/agente/$agenteId', params })} />
        <Button label="Avaliar" icon="pi pi-check-square" size="small" outlined onClick={() => navigate({ to: '/agents/avaliacoes', search: { agente: a.id } })} />
      </>}>

      <Secao titulo="Ciclo de vida">
        {arquivado ? <Vazio>Arquivado: fora do ciclo. Mude o status no editor para voltar a usar.</Vazio> : (
          <>
            <ul className="agd-lista agd-etapas">
              {etapas(a).map((e) => (
                <li key={e.rotulo} className="agd-item" data-falta={!e.feita || undefined}>
                  <i className={`pi ${e.feita ? 'pi-check-circle' : 'pi-circle'} agd-item__icone`} aria-hidden="true" />
                  <span><strong>{e.rotulo}</strong> <span className="agd-mudo">· {e.dica}{e.feita ? '' : ' (pendente)'}</span></span>
                </li>
              ))}
            </ul>
          </>
        )}
        {passo ? <div className="iv-mt"><LinkPasso a={a} p={passo} /></div>
          : !arquivado && <Vazio>Ativo e em dia: nada a fazer agora.</Vazio>}
      </Secao>

      {projeto.isError ? (
        <Secao titulo="Projeto"><Vazio>Não foi possível carregar o projeto completo.</Vazio></Secao>
      ) : (
        <>
          <Revisao agente={projeto.data} carregando={projeto.isLoading} />
          <Pilares agente={projeto.data} carregando={projeto.isLoading} />
        </>
      )}

      <Execucoes a={a} />
      <Avaliacoes a={a} />
    </DetailDrawer>
  );
}
