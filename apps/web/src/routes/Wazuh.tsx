import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { AmbienteSelector } from '@/components/ui/AmbienteSelector';
import { useAmbiente, rotuloAmbiente } from '@/services/ambiente';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Kpi, Pill, StatusStrip } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { getWazuhAlerts, getWazuhStatus, type WazuhAlert } from '@/services/wazuh';
import { useDebounce } from '@/hooks/useDebounce';
import '@/styles/telas/inteligencia.css';

const PAGE_SIZE = 20;
const DIAS = [1, 7, 30].map((value) => ({ value, label: value === 1 ? '24 horas' : `${value} dias` }));
const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
const campo = (v: unknown) => typeof v === 'string' || typeof v === 'number' ? String(v) : '—';

export function Wazuh() {
  const [ambiente, setAmbiente] = useAmbiente();
  const [dias, setDias] = useState(7);
  const [buscaRaw, setBuscaRaw] = useState('');
  const [page, setPage] = useState(0);
  const busca = useDebounce(buscaRaw, 300);
  const status = useQuery({ queryKey: ['wazuh', 'status', ambiente], queryFn: () => getWazuhStatus(ambiente), refetchInterval: 60_000, retry: false });
  const alertas = useQuery({
    queryKey: ['wazuh', 'alertas', dias, busca, page, ambiente],
    queryFn: () => getWazuhAlerts({ dias, q: busca || undefined, page, limit: PAGE_SIZE, ambiente }),
    refetchInterval: 60_000, retry: false,
  });
  const sel = useDrawerSelection(alertas.data?.items ?? []);
  const s = status.data;

  return (
    <div>
      <PageHeader title="Wazuh" subtitle="Saúde do manager e agentes, mais os alertas selecionados que chegam ao Radar." />
      <AmbienteSelector value={ambiente} onChange={(v) => { setAmbiente(v); setPage(0); setBuscaRaw(''); sel.close(); }} />

      {status.isError && <Message severity="warn" text="Não foi possível consultar o estado do Wazuh." />}
      {!s?.configurado && !status.isLoading && (
        <StatusStrip tone="warn" icon="pi-info-circle">
          A API do Wazuh ainda não está configurada no servidor. Defina {s?.faltando.join(', ') || 'as variáveis WAZUH_API_*'} no Coolify.
          O painel de alertas abaixo continua mostrando o recorte que o forwarder já enviou ao Radar.
        </StatusStrip>
      )}
      {s?.erro && <StatusStrip tone="crit" icon="pi-exclamation-triangle">Integração configurada, mas sem consulta: {s.erro}</StatusStrip>}
      {s?.configurado && !s.erro && (
        <StatusStrip tone="ok" icon="pi-shield">
          Consulta somente leitura · manager {s.manager?.hostname ?? 'Wazuh'} · API {s.manager?.versao ?? 'versão indisponível'}
          {s.consultadoEm && <span className="iv-muted"> · atualizado {hora(s.consultadoEm)}</span>}
        </StatusStrip>
      )}

      {s?.manager?.daemons && s.manager.daemons.length > 0 && (
        <section className="iv-card iv-mt" aria-labelledby="wazuh-manager">
          <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
            <h3 id="wazuh-manager" style={{ margin: 0 }}>Serviços do manager</h3>
            <span className="iv-muted">Estado informado pela API do Wazuh</span>
          </div>
          <div className="wazuh-daemons iv-mt">
            {s.manager.daemons.map((d) => (
              <div className="wazuh-daemon" key={d.nome ?? 'serviço'}>
                <span>{d.nome ?? 'Serviço sem nome'}</span>
                <Pill label={d.estado ?? 'desconhecido'} tone={d.estado === 'running' ? 'ok' : 'warning'} />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="iv-kpis iv-mt">
        <Kpi label="Agentes cadastrados" value={s?.agentes?.total ?? '—'} icon="pi-server" />
        <Kpi label="Ativos" value={s?.agentes?.contagens.active ?? '—'} icon="pi-check-circle" />
        <Kpi label="Desconectados" value={s?.agentes?.contagens.disconnected ?? '—'} icon="pi-times-circle" />
        <Kpi label="Alertas encaminhados" value={alertas.data?.total ?? '—'} icon="pi-bell" hint={`últimos ${dias} dia(s)`} />
      </div>

      {s?.agentes?.items && s.agentes.items.length > 0 && (
        <section className="iv-card iv-mt" aria-labelledby="wazuh-agentes">
          <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
            <h3 id="wazuh-agentes" style={{ margin: 0 }}>Agentes monitorados</h3>
            <span className="iv-muted">Visão de saúde consultada diretamente no manager</span>
          </div>
          <div className="wazuh-agent-list iv-mt">
            {s.agentes.items.map((a) => (
              <article className="wazuh-agent" key={a.id ?? a.name}>
                <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
                  <strong>{a.name ?? `Agente ${a.id ?? 'sem ID'}`}</strong>
                  <Pill label={rotuloAmbiente(a.ambiente)} />
                  <Pill label={a.status} tone={a.status === 'active' ? 'ok' : a.status === 'disconnected' ? 'danger' : 'warning'} />
                </div>
                <small className="iv-muted">ID {a.id ?? '—'} · {a.ip ?? 'IP não informado'} · {a.os ?? 'SO não informado'}</small>
                <small className="iv-muted">Versão {a.version ?? '—'} · último contato {a.lastKeepAlive ? hora(a.lastKeepAlive) : '—'}</small>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="iv-card iv-mt" aria-labelledby="wazuh-alertas">
        <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between', marginBottom: '.75rem' }}>
          <div><h3 id="wazuh-alertas" style={{ margin: 0 }}>Alertas encaminhados</h3>
            <p className="iv-muted" style={{ margin: '.25rem 0 0' }}>Recorte normalizado pelo forwarder a partir de regras do Wazuh; não é o arquivo bruto nem todos os eventos do SIEM.</p></div>
          <div className="iv-row iv-wrap">
            <Dropdown value={dias} options={DIAS} onChange={(e) => { setDias(e.value); setPage(0); }} aria-label="Período dos alertas" />
            <InputText value={buscaRaw} onChange={(e) => { setBuscaRaw(e.target.value); setPage(0); }} placeholder="Buscar regra, agente ou alvo" aria-label="Buscar alertas Wazuh" />
          </div>
        </div>
        {alertas.isError && <Message severity="warn" text="Não foi possível carregar os alertas encaminhados." />}
        <DataTable value={alertas.data?.items ?? []} dataKey="id" lazy paginator rows={PAGE_SIZE}
          first={page * PAGE_SIZE} totalRecords={alertas.data?.total ?? 0} onPage={(e) => setPage(e.page ?? 0)}
          selectionMode="single" onSelectionChange={(e) => sel.open((e.value as WazuhAlert).id)}
          emptyMessage="Nenhum alerta encaminhado nesse período." rowHover>
          <Column field="ocorridoEm" header="Quando" body={(a: WazuhAlert) => hora(a.ocorridoEm)} />
          <Column header="Nível" body={(a: WazuhAlert) => <Pill label={campo(a.detalhes.nivel)} tone={Number(a.detalhes.nivel) >= 10 ? 'danger' : Number(a.detalhes.nivel) >= 7 ? 'warning' : undefined} />} />
          <Column header="Regra" body={(a: WazuhAlert) => <span className="mono">{campo(a.detalhes.regra)}</span>} />
          <Column header="Agente / ambiente" body={(a: WazuhAlert) => <>{campo(a.detalhes.sensor)}<div className="iv-muted">{rotuloAmbiente(a.ambiente)}</div></>} />
          <Column header="Alvo / fonte" body={(a: WazuhAlert) => `${a.alvo ?? '—'} · ${a.fonte}`} />
          <Column header="Técnicas" body={(a: WazuhAlert) => {
            const mitre = Array.isArray(a.detalhes.mitre) ? a.detalhes.mitre.map((x) => campo((x as Record<string, unknown>).id)).join(', ') : '—';
            return <span className="mono">{mitre}</span>;
          }} />
        </DataTable>
      </section>

      {sel.item && (
        <DetailDrawer {...sel.nav} wide ariaLabel="Detalhe do alerta Wazuh"
          kind={{ icon: 'pi-bell', label: 'Alerta encaminhado' }}
          status={<Pill label={`Nível ${campo(sel.item.detalhes.nivel)}`} tone={Number(sel.item.detalhes.nivel) >= 10 ? 'danger' : 'warning'} />}
          title={`${campo(sel.item.detalhes.regra)} · ${campo(sel.item.detalhes.sensor)}`}
          subtitle={`${hora(sel.item.ocorridoEm)} · ${sel.item.fonte} · ${sel.item.alvo ?? 'alvo não informado'}`}>
          <DetailFields items={[
            ['Descrição da regra', campo(sel.item.detalhes.descricao)],
            ['Ação normalizada', sel.item.acao], ['Origem', sel.item.ipOrigem ?? '—'],
            ['Serviço', sel.item.servico ?? '—'], ['MITRE', Array.isArray(sel.item.detalhes.mitre) ? sel.item.detalhes.mitre.map((x) => campo((x as Record<string, unknown>).id)).join(', ') : '—'],
          ]} />
          <details className="iv-mt"><summary>Detalhes encaminhados (JSON)</summary><pre className="wazuh-json">{JSON.stringify(sel.item.detalhes, null, 2)}</pre></details>
        </DetailDrawer>
      )}
    </div>
  );
}
