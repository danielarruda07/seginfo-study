import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Message } from 'primereact/message';
import { SelectButton } from 'primereact/selectbutton';
import { Skeleton } from 'primereact/skeleton';
import { agenteConfigVazio } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { EmptyState, Kpi, StatusStrip } from '@/components/InfraKit';
import { useDebounce } from '@/hooks/useDebounce';
import { listAgentes, createAgente, erroApi, getRuntime } from '@/services/agentes';
import type { ModeloAgente } from '@/data/agentesModelos';
import { AgenteCard } from './home/AgenteCard';
import { EM_BRANCO, ModelosGaleria } from './home/ModelosGaleria';
import { STATUS_LABEL, contarPorStatus, filtrarAgentes, ordenarAgentes, precisaDeVoce, type FiltroStatus } from './home/regras';

export { STATUS_LABEL } from './home/regras';

const ORDEM_STATUS: FiltroStatus[] = ['todos', 'ativo', 'teste', 'rascunho', 'arquivado'];
const ROTULO_FILTRO: Record<FiltroStatus, string> = { todos: 'Todos', ...STATUS_LABEL, ativo: 'Ativos', rascunho: 'Rascunhos', arquivado: 'Arquivados' };

const PASSOS_ONBOARDING = [
  { icon: 'pi-pencil', titulo: 'Projete', texto: 'Propósito, instruções, ferramentas e limites, pilar a pilar.' },
  { icon: 'pi-play', titulo: 'Execute', texto: 'Converse no playground e veja cada chamada de ferramenta.' },
  { icon: 'pi-check-square', titulo: 'Avalie', texto: 'Registre casos comuns, de borda e adversariais.' },
  { icon: 'pi-check-circle', titulo: 'Ative', texto: 'Só sem pendências graves; escrita sempre com aprovação.' },
];

function Carregando() {
  return (
    <div className="ag-grid" aria-busy="true" aria-label="Carregando agentes">
      {[0, 1, 2].map((i) => (
        <div key={i} className="iv-card ag-card">
          <Skeleton width="60%" height="1.1rem" />
          <Skeleton width="100%" height="2.4rem" className="iv-mt" />
          <Skeleton width="80%" height=".8rem" className="iv-mt" />
          <Skeleton width="100%" height="2.6rem" className="iv-mt" />
        </div>
      ))}
    </div>
  );
}

export function AgentsHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: ['agentes'], queryFn: listAgentes });
  const runtime = useQuery({ queryKey: ['agentes-runtime'], queryFn: getRuntime, staleTime: 60_000 });

  const [status, setStatus] = useState<FiltroStatus>('todos');
  const [busca, setBusca] = useState('');
  const [soPendentes, setSoPendentes] = useState(false);
  const buscaDebounced = useDebounce(busca, 300);
  const [dialogo, setDialogo] = useState(false);
  const [criando, setCriando] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const agentes = useMemo(() => lista.data ?? [], [lista.data]);
  const contagem = useMemo(() => contarPorStatus(agentes), [agentes]);
  const visiveis = useMemo(
    () => ordenarAgentes(filtrarAgentes(agentes, { status, busca: buscaDebounced, soPendentes })),
    [agentes, status, buscaDebounced, soPendentes],
  );

  const emUso = agentes.filter((a) => a.status !== 'arquivado');
  const pendentes = emUso.filter(precisaDeVoce).length;
  const placar = emUso.reduce((s, a) => ({ ok: s.ok + a.avaliacoes.ok, total: s.total + a.avaliacoes.total }), { ok: 0, total: 0 });
  const rt = runtime.data;

  const limpar = () => { setStatus('todos'); setBusca(''); setSoPendentes(false); };
  const vazioTotal = !lista.isLoading && !lista.isError && agentes.length === 0;

  async function criar(modelo?: ModeloAgente) {
    setCriando(modelo?.id ?? EM_BRANCO); setErro('');
    try {
      const novo = await createAgente({
        nome: modelo?.nome ?? 'Novo agente',
        resumo: modelo?.resumo ?? '',
        status: 'rascunho',
        config: modelo?.config ?? agenteConfigVazio(),
      });
      await qc.invalidateQueries({ queryKey: ['agentes'] });
      navigate({ to: '/agents/agente/$agenteId', params: { agenteId: novo.id } });
    } catch (e) {
      setErro(erroApi(e, 'Não foi possível criar o agente.'));
      setDialogo(false);
    } finally {
      setCriando(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Projete, execute e avalie seus agentes de IA. Cada cartão mostra a etapa em que o agente está e o próximo passo."
        actions={<>
          <Link to="/agents/aprender" className="ag-btn"><i className="pi pi-graduation-cap" aria-hidden="true" /> Os 8 pilares</Link>
          {!vazioTotal && <Button label="Novo agente" icon="pi pi-plus" onClick={() => setDialogo(true)} disabled={!!criando} />}
        </>}
      />

      {lista.isError && (
        <Message severity="warn" className="iv-mt" style={{ width: '100%' }}
          text="API ou banco indisponível. Os agentes ficam no servidor (apps/api + PostgreSQL)." />
      )}
      {erro && <Message severity="error" className="iv-mt" style={{ width: '100%' }} text={erro} />}

      {rt && !rt.configurada && (
        <div className="iv-mt">
          <StatusStrip tone="warn" icon="pi-exclamation-triangle">
            O servidor ainda não tem a chave do modelo: dá para projetar e avaliar, mas o playground não executa.{' '}
            <Link to="/agents/ferramentas">Ver o que falta configurar</Link>
          </StatusStrip>
        </div>
      )}

      {lista.isLoading && <div className="iv-mt"><Carregando /></div>}

      {vazioTotal && (
        <section className="ag-onboarding iv-mt" aria-labelledby="ag-onb-titulo">
          <h2 id="ag-onb-titulo">Crie seu primeiro agente</h2>
          <p className="iv-muted">Um agente bom nasce com limites claros e é testado antes de ganhar autonomia. O caminho aqui é este:</p>
          <ol className="ag-onboarding__passos">
            {PASSOS_ONBOARDING.map((p, i) => (
              <li key={p.titulo}>
                <span className="ag-onboarding__n" aria-hidden="true">{i + 1}</span>
                <i className={`pi ${p.icon}`} aria-hidden="true" />
                <strong>{p.titulo}</strong>
                <span>{p.texto}</span>
              </li>
            ))}
          </ol>
          <p className="iv-section-label iv-mt">Comece por um modelo ou em branco</p>
          <p className="iv-muted ag-nota">Os modelos já vêm com instruções, limites de segurança e ferramentas. Os que agem no ambiente pedem a sua aprovação a cada ação.</p>
          <ModelosGaleria criando={criando} onEscolher={criar} comEmBranco />
        </section>
      )}

      {agentes.length > 0 && (
        <>
          <div className="iv-kpis iv-mt">
            <Kpi label="Precisam de você" icon="pi-bell" value={pendentes} tone="danger"
              hint={pendentes ? 'aprovações ou pendências graves' : 'nada bloqueado'}
              active={soPendentes} onClick={() => setSoPendentes(!soPendentes)} />
            <Kpi label="Taxa de acerto" icon="pi-check-square"
              value={placar.total ? `${Math.round((placar.ok / placar.total) * 100)}%` : '—'}
              hint={placar.total ? `em ${placar.total} caso(s) de teste` : 'nenhum caso registrado'} />
            <Kpi label="Execuções hoje" icon="pi-bolt"
              value={rt ? `${rt.custoHoje.execucoes}/${rt.limites.execucoesPorDia}` : '—'} hint="teto diário do servidor" />
            <Kpi label="Ações aprovadas hoje" icon="pi-lock"
              value={rt ? `${rt.custoHoje.escritasAprovadas}/${rt.limites.escritasAprovadasPorDia}` : '—'} hint="escritas no ambiente" />
          </div>

          <div className="iv-toolbar iv-mt">
            <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome, descrição ou tag da base" />
            <SelectButton value={status} allowEmpty={false} aria-label="Filtrar por status"
              options={ORDEM_STATUS.map((s) => ({ value: s, label: `${ROTULO_FILTRO[s]} ${contagem[s]}` }))}
              onChange={(e) => e.value && setStatus(e.value)} />
            <span className="iv-toolbar__count">{visiveis.length} de {status === 'todos' ? contagem.todos : contagem[status]}</span>
          </div>
          <ActiveFiltersBar onClearAll={limpar} filters={[
            status !== 'todos' && { key: 'status', label: ROTULO_FILTRO[status], onRemove: () => setStatus('todos') },
            soPendentes && { key: 'pend', label: 'Precisam de você', onRemove: () => setSoPendentes(false) },
            buscaDebounced.trim() && { key: 'busca', label: `"${buscaDebounced.trim()}"`, onRemove: () => setBusca('') },
          ]} />

          {visiveis.length > 0
            ? <div className="ag-grid">{visiveis.map((a) => <AgenteCard key={a.id} a={a} />)}</div>
            : (
              <EmptyState icon="pi-filter-slash" title="Nenhum agente nesta visão"
                text={soPendentes ? 'Nada esperando por você. Bom sinal.' : 'Mude o filtro ou a busca.'}
                action={<Button label="Limpar filtros" text size="small" onClick={limpar} />} />
            )}
        </>
      )}

      <Dialog header="Novo agente" visible={dialogo} onHide={() => !criando && setDialogo(false)}
        style={{ width: 'min(96vw, 980px)' }} dismissableMask={!criando} closable={!criando}>
        <p className="iv-muted ag-nota" style={{ marginTop: 0 }}>
          Escolha um ponto de partida. Tudo continua editável; os modelos com ações pedem a sua aprovação a cada ação.
        </p>
        <ModelosGaleria criando={criando} onEscolher={criar} comEmBranco />
      </Dialog>
    </div>
  );
}
