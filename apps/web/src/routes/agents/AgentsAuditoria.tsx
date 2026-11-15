import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Kpi, Pill, StatusStrip } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { Button } from 'primereact/button';
import { baixarExecucoes, erroApi, listAgentes, listAuditoria } from '@/services/agentes';
import { DECISAO_META, comIds, duracao, type AcaoComId } from './regras';
import { MetaPill } from './ficha/comum';
import { AcaoFicha } from './ficha/AcaoFicha';
import '@/styles/telas/agents.css';

/**
 * Painel de auditoria dos agentes: toda ação de ferramenta (leitura e escrita), de todas as
 * execuções, numa lista única. Serve dois públicos:
 *  - você, enquanto não há SIEM central para isto (Wazuh não recebe estes eventos hoje);
 *  - outra IA/agente, que pode ler GET /api/agentes/auditoria (mesmo formato desta tela) para
 *    decidir o que fazer com pendências — ver docs/AGENTS.md.
 */
export function AgentsAuditoria() {
  const agentes = useQuery({ queryKey: ['agentes'], queryFn: listAgentes });
  const [agenteId, setAgenteId] = useState<string | undefined>();
  const [somenteEscrita, setSomenteEscrita] = useState(false);
  const [somenteErro, setSomenteErro] = useState(false);

  const filtro = useMemo(() => ({ agenteId, somenteEscrita: somenteEscrita || undefined, somenteErro: somenteErro || undefined, limite: 300 }), [agenteId, somenteEscrita, somenteErro]);
  const auditoria = useQuery({ queryKey: ['agentes-auditoria', filtro], queryFn: () => listAuditoria(filtro) });

  const acoes = useMemo(() => comIds(auditoria.data?.acoes ?? []), [auditoria.data]);
  const sel = useDrawerSelection(acoes);
  const aprovadas = acoes.filter((a) => a.decisao === 'aprovada').length;
  const negadas = acoes.filter((a) => a.decisao === 'negada').length;
  const erros = acoes.filter((a) => a.erro).length;
  const nomeAgente = (agentes.data ?? []).find((a) => a.id === agenteId)?.nome;
  const limpar = () => { setAgenteId(undefined); setSomenteEscrita(false); setSomenteErro(false); };
  const [baixando, setBaixando] = useState(false);
  const [erroDownload, setErroDownload] = useState('');
  const baixar = async () => {
    setBaixando(true);
    setErroDownload('');
    try { await baixarExecucoes(); } catch (e) { setErroDownload(erroApi(e, 'Não foi possível baixar as execuções.')); } finally { setBaixando(false); }
  };

  return (
    <div>
      <PageHeader
        title="Auditoria dos agentes"
        subtitle="Toda ação que um agente executou de verdade: o que pediu, o que o servidor devolveu e se foi aprovada por você."
        actions={<Button label="Baixar execuções (JSON)" icon="pi pi-download" outlined loading={baixando} onClick={baixar}
          tooltip="Cópia completa de todas as execuções (passos, conversa e aprovações). O backup cifrado no OneDrive também as inclui." />}
      />
      {erroDownload && <Message severity="error" className="ag-largo" text={erroDownload} />}

      {auditoria.isError && <Message severity="warn" className="ag-largo" text="API indisponível: a auditoria fica no servidor." />}

      <StatusStrip tone="warn" icon="pi-exclamation-triangle">
        Estes eventos ainda não chegam a um SIEM central. Esta tela e o endpoint <code>GET /api/agentes/auditoria</code> (documentado
        em <code>docs/AGENTS.md</code>, para outra IA também consultar) são a visão de auditoria por enquanto.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Ações no período" icon="pi-history" value={auditoria.data?.total ?? '—'} hint={acoes.length < (auditoria.data?.total ?? 0) ? `mostrando as ${acoes.length} mais recentes` : undefined} />
        <Kpi label="Escritas aprovadas" icon="pi-check" value={aprovadas} />
        <Kpi label="Escritas negadas" icon="pi-ban" value={negadas} />
        <Kpi label="Com erro" icon="pi-times-circle" value={erros} tone="danger" active={somenteErro} onClick={() => setSomenteErro(!somenteErro)} />
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <Dropdown value={agenteId} options={(agentes.data ?? []).map((a) => ({ label: a.nome, value: a.id }))} className="ag-dropdown"
            onChange={(e) => setAgenteId(e.value ?? undefined)} placeholder="Todos os agentes" showClear aria-label="Filtrar por agente" />
          <label className="ag-toolbar-check">
            <Checkbox inputId="aud-escrita" checked={somenteEscrita} onChange={(e) => setSomenteEscrita(!!e.checked)} /> Só escrita
          </label>
          <span className="iv-toolbar__count">{acoes.length} {acoes.length === 1 ? 'ação' : 'ações'}</span>
        </div>
        <ActiveFiltersBar onClearAll={limpar} filters={[
          agenteId && { key: 'ag', label: nomeAgente ?? 'Agente', onRemove: () => setAgenteId(undefined) },
          somenteEscrita && { key: 'esc', label: 'Só escrita', onRemove: () => setSomenteEscrita(false) },
          somenteErro && { key: 'erro', label: 'Com erro', onRemove: () => setSomenteErro(false) },
        ]} />

        <DataTable className="ag-tabela" value={acoes} dataKey="id" paginator={acoes.length > 25} rows={25} rowHover loading={auditoria.isLoading}
          onRowClick={(e) => sel.open((e.data as AcaoComId).id)}
          rowClassName={(a: AcaoComId) => `${a.erro ? "iv-row-alert tone-danger" : ""}${sel.isOpen(a.id) ? " ag-row-sel" : ""}`}
          emptyMessage="Nenhuma ação registrada. Quando um agente usar uma ferramenta no playground, ela aparece aqui.">
          <Column header="Decisão" body={(a: AcaoComId) => <MetaPill m={DECISAO_META[a.decisao]} />} style={{ width: '13rem' }} />
          <Column header="Ferramenta" body={(a: AcaoComId) => (
            <div className="iv-maincell">
              <span className="iv-maincell__icon"><i className="pi pi-wrench" aria-hidden="true" /></span>
              <div><div className="iv-maincell__title mono">{a.ferramenta}</div><div className="iv-maincell__sub">{a.agenteNome}</div></div>
            </div>
          )} />
          <Column header="Resultado" body={(a: AcaoComId) => (a.erro && a.decisao !== 'negada' ? <Pill label="Erro" tone="danger" icon="pi-times-circle" /> : <span className="ag-dica">ok</span>)} />
          <Column header="Duração" className="iv-hide-sm tabular" headerClassName="iv-hide-sm" body={(a: AcaoComId) => duracao(a.ms)} />
          <Column header="Decidido em" className="iv-hide-sm tabular" headerClassName="iv-hide-sm"
            body={(a: AcaoComId) => (a.decididoEm ? new Date(a.decididoEm).toLocaleString('pt-BR') : <span className="ag-dica">—</span>)} />
        </DataTable>
      </div>

      {sel.item && <AcaoFicha a={sel.item} nav={sel.nav} />}
    </div>
  );
}
