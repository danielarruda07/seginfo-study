import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import type { AvaliacaoResultado } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Kpi, StatusStrip } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { deleteAvaliacao, erroApi, listAgentes, listAvaliacoes, type Avaliacao } from '@/services/agentes';
import { RESULTADO_META, duracao, placar, truncar } from './regras';
import { MetaPill } from './ficha/comum';
import { CasoFicha } from './ficha/CasoFicha';
import { RegistrarCaso } from './avaliacoes/RegistrarCaso';
import '@/styles/telas/agents.css';

const TIPOS_DE_CASO = [
  ['Comum', 'O pedido típico, o que o agente existe para fazer.'],
  ['De borda', 'Entrada vazia, enorme, em outro idioma, com dados faltando.'],
  ['Fora de escopo', 'Pedido que o agente deve recusar ou redirecionar.'],
  ['Adversarial', 'Tentativa de prompt injection, de extrair o prompt ou de forçar uma ferramenta de escrita.'],
  ['Ferramenta com falha', 'A fonte de dados cai ou devolve lixo: o agente deve avisar, não inventar.'],
];

export function AgentsAvaliacoes() {
  const qc = useQueryClient();
  const agentes = useQuery({ queryKey: ['agentes'], queryFn: listAgentes });
  const { agente: agenteDaUrl } = useSearch({ strict: false }) as { agente?: string };
  const [agenteId, setAgenteId] = useState<string | null>(agenteDaUrl ?? null);
  const [filtro, setFiltro] = useState<AvaliacaoResultado | null>(null);
  const [erro, setErro] = useState('');

  const lista = agentes.data ?? [];
  const atual = agenteId ?? lista.find((a) => a.status !== 'arquivado')?.id ?? null;
  const nomeAtual = lista.find((a) => a.id === atual)?.nome;
  const casos = useQuery({ queryKey: ['agente-avaliacoes', atual], queryFn: () => listAvaliacoes(atual as string), enabled: !!atual });

  const itens = useMemo(() => casos.data ?? [], [casos.data]);
  const visiveis = useMemo(() => (filtro ? itens.filter((i) => i.resultado === filtro) : itens), [itens, filtro]);
  const sel = useDrawerSelection(visiveis);
  const p = placar(itens);
  const alternar = (r: AvaliacaoResultado) => setFiltro(filtro === r ? null : r);

  function remover(c: Avaliacao) {
    confirmDialog({
      header: 'Remover caso de teste',
      message: `Remover "${truncar(c.caso, 80)}"? O placar do agente muda. Se o agente melhorou, prefira registrar um novo resultado e manter este como histórico.`,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Remover', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          await deleteAvaliacao(c.agenteId, c.id);
          sel.close();
          qc.invalidateQueries({ queryKey: ['agente-avaliacoes', c.agenteId] });
          qc.invalidateQueries({ queryKey: ['agentes'] });
        } catch (e) {
          setErro(erroApi(e, 'Falha ao remover o caso.'));
        }
      },
    });
  }

  return (
    <div>
      <ConfirmDialog />
      <PageHeader
        title="Testes e avaliações"
        subtitle="Rode o agente nos seus casos e registre o resultado. Repita depois de cada mudança de prompt, modelo ou ferramenta."
        actions={atual ? <Link to="/agents/agente/$agenteId" params={{ agenteId: atual }} className="ag-btn"><i className="pi pi-pencil" aria-hidden="true" /> Abrir o projeto</Link> : undefined}
      />

      {agentes.isError && <Message severity="warn" className="ag-largo" text="API ou banco indisponível. As avaliações ficam no servidor." />}
      {erro && <Message severity="error" className="ag-largo" text={erro} />}

      {lista.length === 0 && !agentes.isLoading && !agentes.isError ? (
        <StatusStrip tone="warn" icon="pi-info-circle">
          Você ainda não tem agentes. <Link to="/agents">Crie o primeiro</Link> para registrar avaliações.
        </StatusStrip>
      ) : (
        <>
          <div className="iv-toolbar">
            <label htmlFor="av-agente" className="ag-rotulo">Agente avaliado</label>
            <Dropdown inputId="av-agente" value={atual} options={lista.map((a) => ({ label: a.nome, value: a.id }))}
              onChange={(e) => { setAgenteId(e.value); setFiltro(null); }} placeholder="Escolha o agente" className="ag-dropdown" />
          </div>

          <div className="iv-kpis">
            <Kpi label="Casos registrados" icon="pi-list" value={p.total} />
            <Kpi label="Atendeu ao critério" icon="pi-check" value={p.pct !== null ? `${p.pct}%` : '—'} hint={p.total ? `${p.ok} de ${p.total}` : 'nenhum caso ainda'}
              active={filtro === 'ok'} onClick={p.ok ? () => alternar('ok') : undefined} />
            <Kpi label="Parciais" icon="pi-minus-circle" value={p.parcial} tone="warning" active={filtro === 'parcial'} onClick={() => alternar('parcial')} />
            <Kpi label="Falhas" icon="pi-times" value={p.falha} tone="danger" active={filtro === 'falha'} onClick={() => alternar('falha')} />
            <Kpi label="Latência média" icon="pi-stopwatch" value={p.latMedia !== null ? duracao(p.latMedia) : '—'}
              hint={p.comLatencia ? `em ${p.comLatencia} caso(s)` : 'informe a latência ao registrar'} />
          </div>

          <div className="iv-card iv-mt ag-bloco">
            <h3>Registrar um caso</h3>
            <RegistrarCaso agenteId={atual} />
          </div>

          <div className="iv-card iv-mt">
            <div className="iv-toolbar">
              <h3 className="ag-titulo-card">Histórico</h3>
              <span className="iv-toolbar__count">{visiveis.length} de {itens.length}</span>
            </div>
            <ActiveFiltersBar filters={[filtro && { key: 'res', label: RESULTADO_META[filtro].rotulo, onRemove: () => setFiltro(null) }]} />
            <DataTable className="ag-tabela" value={visiveis} dataKey="id" paginator={visiveis.length > 25} rows={25} rowHover loading={casos.isLoading}
              onRowClick={(e) => sel.open((e.data as Avaliacao).id)}
              rowClassName={(i: Avaliacao) => `${i.resultado === 'falha' ? 'iv-row-alert tone-danger' : ''}${sel.isOpen(i.id) ? ' ag-row-sel' : ''}`}
              emptyMessage={filtro ? 'Nenhum caso com este resultado.' : 'Nenhum caso registrado para este agente. Comece pelos tipos sugeridos abaixo.'}>
              <Column header="Resultado" style={{ width: '8.5rem' }} body={(i: Avaliacao) => <MetaPill m={RESULTADO_META[i.resultado]} />} />
              <Column header="Caso" body={(i: Avaliacao) => (
                <div>
                  <div className="iv-maincell__title">{truncar(i.caso, 140)}</div>
                  {(i.criterio || i.observacao) && <div className="iv-maincell__sub">{truncar(i.observacao || `Critério: ${i.criterio}`, 120)}</div>}
                </div>
              )} />
              <Column header="Latência" className="iv-hide-sm tabular" headerClassName="iv-hide-sm" body={(i: Avaliacao) => (i.latenciaMs !== null ? duracao(i.latenciaMs) : '—')} />
              <Column header="Quando" className="iv-hide-sm tabular" headerClassName="iv-hide-sm" body={(i: Avaliacao) => new Date(i.criadoEm).toLocaleDateString('pt-BR')} />
            </DataTable>
          </div>
        </>
      )}

      <div className="iv-card iv-mt ag-bloco">
        <h3>Que casos testar</h3>
        <ul>{TIPOS_DE_CASO.map(([titulo, texto]) => <li key={titulo}><strong>{titulo}:</strong> {texto}</li>)}</ul>
        <p className="ag-dica">Dica: comece com 20 casos que representem o uso real e acrescente um caso novo sempre que o agente errar.</p>
      </div>

      {sel.item && <CasoFicha c={sel.item} agenteNome={nomeAtual} nav={sel.nav} onRemover={remover} />}
    </div>
  );
}
