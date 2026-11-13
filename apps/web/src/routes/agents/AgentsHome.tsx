import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { agenteConfigVazio, type AgenteStatus } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { Kpi, StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { listAgentes, createAgente, erroApi } from '@/services/agentes';
import { MODELOS_AGENTE, type ModeloAgente } from '@/data/agentesModelos';

export const STATUS_LABEL: Record<AgenteStatus, string> = {
  rascunho: 'Rascunho', teste: 'Em teste', ativo: 'Ativo', arquivado: 'Arquivado',
};
export const STATUS_COR: Record<AgenteStatus, string> = {
  rascunho: '#64748b', teste: '#f59e0b', ativo: '#16a34a', arquivado: '#94a3b8',
};

export function AgentsHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lista = useQuery({ queryKey: ['agentes'], queryFn: listAgentes });
  const [filtro, setFiltro] = useState<AgenteStatus | undefined>();
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');

  const agentes = lista.data ?? [];
  const visiveis = useMemo(
    () => agentes.filter((a) => (filtro ? a.status === filtro : a.status !== 'arquivado')),
    [agentes, filtro],
  );
  const contar = (s: AgenteStatus) => agentes.filter((a) => a.status === s).length;

  async function criar(modelo?: ModeloAgente) {
    setCriando(true); setErro('');
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
    } finally {
      setCriando(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Projete seus agentes de IA pelos 8 pilares: propósito, instruções, modelo, ferramentas, memória, orquestração, interface e avaliação."
        actions={<Button label="Novo agente" icon="pi pi-plus" onClick={() => criar()} disabled={criando} loading={criando} />}
      />

      {lista.isError && (
        <Message severity="warn" style={{ width: '100%', marginBottom: '1rem' }}
          text="API ou banco indisponível. Os agentes ficam no servidor (apps/api + PostgreSQL)." />
      )}
      {erro && <Message severity="error" style={{ width: '100%', marginBottom: '1rem' }} text={erro} />}

      <StatusStrip tone="ok" icon="pi-sparkles">
        Aqui você projeta, executa e avalia agentes. No playground de cada agente dá para conversar com ele e ver cada passo do laço; por enquanto só ferramentas de leitura são executadas.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Agentes" value={agentes.filter((a) => a.status !== 'arquivado').length} />
        <Kpi label="Ativos" value={contar('ativo')} active={filtro === 'ativo'} onClick={() => setFiltro(filtro === 'ativo' ? undefined : 'ativo')} />
        <Kpi label="Em teste" value={contar('teste')} active={filtro === 'teste'} onClick={() => setFiltro(filtro === 'teste' ? undefined : 'teste')} />
        <Kpi label="Rascunhos" value={contar('rascunho')} active={filtro === 'rascunho'} onClick={() => setFiltro(filtro === 'rascunho' ? undefined : 'rascunho')} />
      </div>

      <div className="iv-row iv-wrap iv-mt">
        <Chip label="Arquivados" active={filtro === 'arquivado'} onClick={() => setFiltro(filtro === 'arquivado' ? undefined : 'arquivado')} />
      </div>

      <div className="grid-cards iv-mt">
        {visiveis.map((a) => (
          <div key={a.id} className="iv-card">
            <div className="iv-row" style={{ justifyContent: 'space-between' }}>
              <Pill label={STATUS_LABEL[a.status]} color={STATUS_COR[a.status]} />
              {a.revisao && a.revisao.erros > 0 && <Pill label={`${a.revisao.erros} pendência(s) grave(s)`} color="#ef4444" />}
              {a.revisao && a.revisao.erros === 0 && a.revisao.avisos > 0 && <Pill label={`${a.revisao.avisos} aviso(s)`} color="#f59e0b" />}
            </div>
            <h3 style={{ margin: '.6rem 0 .25rem', color: 'var(--alvoar-navy)' }}>
              <Link to="/agents/agente/$agenteId" params={{ agenteId: a.id }}>{a.nome}</Link>
            </h3>
            <p className="iv-muted" style={{ margin: 0, fontSize: '.86rem' }}>{a.resumo || 'Sem descrição.'}</p>
            <div className="iv-row iv-wrap iv-mt">
              <Pill label={`${a.ferramentas} ferramenta(s)`} color="#64748b" />
              {a.ferramentasEscrita > 0 && <Pill label={`${a.ferramentasEscrita} com escrita`} color="#ef4444" />}
              <Pill label={a.avaliacoes.total ? `${Math.round((a.avaliacoes.ok / a.avaliacoes.total) * 100)}% ok em ${a.avaliacoes.total} teste(s)` : 'sem testes'} color="#0ea5e9" />
            </div>
            {a.status !== 'arquivado' && (
              <div className="iv-mt">
                <Link to="/agents/agente/$agenteId/playground" params={{ agenteId: a.id }}><i className="pi pi-play" aria-hidden="true" /> Executar</Link>
              </div>
            )}
          </div>
        ))}
        {visiveis.length === 0 && !lista.isLoading && (
          <p className="iv-muted">Nenhum agente nesta visão. Crie um do zero ou comece por um modelo abaixo.</p>
        )}
      </div>

      <h3 style={{ marginBottom: '.4rem' }}>Comece por um modelo</h3>
      <p className="iv-muted" style={{ marginTop: 0, fontSize: '.88rem' }}>
        Todos nascem em modo leitura e com limites de segurança já escritos. Edite à vontade.
      </p>
      <div className="grid-cards">
        {MODELOS_AGENTE.map((m) => (
          <div key={m.id} className="iv-card">
            <h4 style={{ margin: '0 0 .3rem', color: 'var(--alvoar-navy)' }}>{m.nome}</h4>
            <p className="iv-muted" style={{ margin: '0 0 .75rem', fontSize: '.86rem' }}>{m.resumo}</p>
            <Button label="Usar este modelo" icon="pi pi-copy" size="small" outlined onClick={() => criar(m)} disabled={criando} />
          </div>
        ))}
      </div>
    </div>
  );
}
