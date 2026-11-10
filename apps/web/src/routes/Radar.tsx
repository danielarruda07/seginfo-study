import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Kpi, StatusStrip, Chip, Pill, Bar } from '@/components/InfraKit';
import { getRadarResumo, getRadarEventos, type RadarEvento } from '@/services/radar';

const ROWS = 15;
const DIAS_OPTS = [1, 7, 30];
const ACAO_COLOR: Record<string, string> = {
  login_falha: '#f59e0b', lockout: '#ef4444', login_ok: '#dc2626', scan: '#0ea5e9',
  bloqueio: '#64748b', conexao: '#64748b', comando: '#7c3aed', outro: '#64748b',
};

/** Lista de "top N" com barras proporcionais ao maior valor. */
function TopList({ titulo, itens, onPick }: {
  titulo: string;
  itens: { rotulo: string; extra?: string | null; total: number }[];
  onPick?: (rotulo: string) => void;
}) {
  const max = Math.max(1, ...itens.map((i) => i.total));
  return (
    <div className="iv-card">
      <h4 style={{ margin: '0 0 .6rem' }}>{titulo}</h4>
      {itens.length === 0 && <p className="iv-muted" style={{ margin: 0, fontSize: '.85rem' }}>Sem dados no período.</p>}
      <div className="iv-col">
        {itens.map((i) => (
          <div key={i.rotulo}
            style={{ cursor: onPick ? 'pointer' : 'default' }}
            onClick={onPick ? () => onPick(i.rotulo) : undefined}>
            <div className="iv-row" style={{ justifyContent: 'space-between', fontSize: '.85rem' }}>
              <span style={{ fontFamily: 'monospace' }}>{i.rotulo}{i.extra ? ` · ${i.extra}` : ''}</span>
              <strong>{i.total}</strong>
            </div>
            <Bar pct={(i.total / max) * 100} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Radar() {
  const [dias, setDias] = useState(7);
  const [ip, setIp] = useState<string | undefined>();
  const [servico, setServico] = useState<string | undefined>();
  const [acao, setAcao] = useState<string | undefined>();
  const [page, setPage] = useState(0);

  const resumo = useQuery({ queryKey: ['radar-resumo', dias], queryFn: () => getRadarResumo(dias) });

  const filtros = useMemo(() => ({ ip, servico, acao, page, limit: ROWS }), [ip, servico, acao, page]);
  const eventos = useQuery({ queryKey: ['radar-eventos', filtros], queryFn: () => getRadarEventos(filtros) });

  // qualquer mudança de filtro volta para a página 1
  const setF = <T,>(set: (v: T | undefined) => void) => (v: T | undefined) => { set(v); setPage(0); };
  const pickIp = setF(setIp);
  const pickServico = setF(setServico);
  const pickAcao = setF(setAcao);

  const r = resumo.data;
  const tone = !r ? 'ok' : r.lockouts > 0 ? 'crit' : r.total > 0 ? 'warn' : 'ok';

  const activeFilters = [
    ip && { key: 'ip', label: `IP: ${ip}`, onRemove: () => pickIp(undefined) },
    servico && { key: 'srv', label: `Serviço: ${servico}`, onRemove: () => pickServico(undefined) },
    acao && { key: 'acao', label: `Ação: ${acao}`, onRemove: () => pickAcao(undefined) },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  const maxTl = Math.max(1, ...(r?.timeline.map((t) => t.total) ?? [1]));

  return (
    <div>
      <PageHeader
        title="Radar de Ataques"
        subtitle="Tentativas de invasão contra o seu ambiente: o que chega, de onde e o que tentam."
      />

      {(resumo.isError || eventos.isError) && (
        <Message severity="warn" style={{ width: '100%', marginBottom: '1rem' }}
          text="API ou banco indisponível. O Radar precisa do servidor (apps/api + PostgreSQL) e não funciona só com dados locais." />
      )}

      <StatusStrip tone={tone} icon="pi-eye">
        {r
          ? <>Últimos {r.dias} dia(s): <strong>{r.total}</strong> eventos de <strong>{r.ipsUnicos}</strong> IPs, {r.falhasLogin} falhas de login e <strong>{r.lockouts}</strong> bloqueios de conta.</>
          : 'Carregando…'}
        {r?.truncado && ' A janela tem mais eventos que o limite de análise; o resumo cobre os mais recentes.'}
      </StatusStrip>

      <div className="iv-row iv-wrap iv-mt">
        <span className="iv-muted" style={{ fontSize: '.8rem' }}>Período:</span>
        {DIAS_OPTS.map((d) => (
          <Chip key={d} label={d === 1 ? '24 h' : `${d} dias`} active={dias === d} onClick={() => { setDias(d); }} />
        ))}
      </div>

      <div className="iv-kpis iv-mt">
        <Kpi label="Eventos" value={r?.total ?? 0} />
        <Kpi label="IPs únicos" value={r?.ipsUnicos ?? 0} />
        <Kpi label="Falhas de login" value={r?.falhasLogin ?? 0} active={acao === 'login_falha'}
          onClick={() => pickAcao(acao === 'login_falha' ? undefined : 'login_falha')} />
        <Kpi label="Contas bloqueadas" value={r?.lockouts ?? 0} active={acao === 'lockout'}
          onClick={() => pickAcao(acao === 'lockout' ? undefined : 'lockout')} />
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .6rem' }}>Linha do tempo ({r?.granularidade === 'hora' ? 'por hora, UTC' : 'por dia, UTC'})</h4>
        {(r?.timeline.length ?? 0) === 0
          ? <p className="iv-muted" style={{ margin: 0, fontSize: '.85rem' }}>Sem eventos no período.</p>
          : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }}>
              {r!.timeline.map((t) => (
                <div key={t.bucket} title={`${t.bucket}: ${t.total}`}
                  style={{ flex: 1, minWidth: 2, height: `${Math.max(4, (t.total / maxTl) * 100)}%`, background: 'var(--alvoar-teal)', borderRadius: 2 }} />
              ))}
            </div>
          )}
      </div>

      <div className="grid-cards iv-mt">
        <TopList titulo="IPs mais ativos (clique para filtrar)"
          itens={(r?.topIps ?? []).map((i) => ({ rotulo: i.ip, extra: i.pais, total: i.total }))} onPick={(v) => pickIp(v)} />
        <TopList titulo="Serviços visados (clique para filtrar)"
          itens={(r?.topServicos ?? []).map((i) => ({ rotulo: i.nome, total: i.total }))} onPick={(v) => pickServico(v)} />
        <TopList titulo="Usuários tentados"
          itens={(r?.topUsuarios ?? []).map((i) => ({ rotulo: i.nome, total: i.total }))} />
        <TopList titulo="Países de origem"
          itens={(r?.topPaises ?? []).map((i) => ({ rotulo: i.nome, total: i.total }))} />
        {r?.senhasHabilitadas && (
          <TopList titulo="Senhas mais tentadas (dado sensível, não publique)"
            itens={(r.topSenhas).map((i) => ({ rotulo: i.nome, total: i.total }))} />
        )}
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .6rem' }}>Técnicas MITRE ATT&amp;CK observadas</h4>
        {(r?.mitre.length ?? 0) === 0
          ? <p className="iv-muted" style={{ margin: 0, fontSize: '.85rem' }}>Nenhuma técnica mapeada no período.</p>
          : (
            <div className="iv-row iv-wrap">
              {r!.mitre.map((m) => (
                <Pill key={m.id} label={`${m.id} · ${m.nome} (${m.eventos})`} color="#7c3aed" />
              ))}
            </div>
          )}
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .6rem' }}>Eventos recentes</h4>
        <ActiveFiltersBar filters={activeFilters} />
        <DataTable
          value={eventos.data?.items ?? []}
          lazy paginator first={page * ROWS} rows={ROWS} totalRecords={eventos.data?.total ?? 0}
          onPage={(e) => setPage(e.page ?? 0)}
          emptyMessage="Nenhum evento para os filtros."
          dataKey="id"
        >
          <Column header="Quando (UTC)" style={{ width: 170 }}
            body={(e: RadarEvento) => e.ocorridoEm.replace('T', ' ').slice(0, 19)} />
          <Column header="IP" body={(e: RadarEvento) => (
            <span style={{ fontFamily: 'monospace' }}>{e.ipOrigem ?? '—'}{e.paisOrigem ? ` · ${e.paisOrigem}` : ''}</span>
          )} />
          <Column header="Serviço" body={(e: RadarEvento) => e.servico ? `${e.servico}${e.portaDestino ? `:${e.portaDestino}` : ''}` : (e.portaDestino ?? '—')} />
          <Column header="Ação" body={(e: RadarEvento) => <Pill label={e.acao} color={ACAO_COLOR[e.acao]} />} />
          <Column header="Usuário tentado" field="usuarioTentado" />
          <Column header="Fonte" field="fonte" style={{ width: 110 }} />
        </DataTable>
      </div>
    </div>
  );
}
