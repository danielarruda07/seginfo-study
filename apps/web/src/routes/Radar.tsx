import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Message } from 'primereact/message';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Sidebar } from 'primereact/sidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { DetailHeader, DetailLayout, DetailSection } from '@/components/ui/Detail';
import { Kpi, StatusStrip, Chip, Pill, Bar } from '@/components/InfraKit';
import { getRadarResumo, getRadarEventos, type RadarEscopo, type RadarEvento } from '@/services/radar';
import type { AtaqueFonte } from '@seginfo/shared';
import { useDebounce } from '@/hooks/useDebounce';
import { SessaoAtacante } from './radar/SessaoAtacante';

const ROWS = 15;
const DIAS_OPTS = [1, 7, 30];
/** Atualização automática (só com a aba visível: o React Query pausa em segundo plano). */
const ATUALIZAR_MS = 60_000;
const ESCOPO_OPTS: { value: RadarEscopo; label: string; dica: string }[] = [
  { value: 'internet', label: 'Internet', dica: 'Origem em IP público: o que chega de fora' },
  { value: 'interno', label: 'Range (interno)', dica: 'Origem em rede privada: exercícios da Kali, testes e eventos sem IP' },
  { value: 'todos', label: 'Tudo', dica: 'Internet e range juntos' },
];
const ESCOPO_LABEL: Record<RadarEscopo, string> = { internet: 'da internet', interno: 'do range (interno)', todos: 'no total' };
const hora = (ms: number) => (ms ? new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—');
const FONTE_OPTS = [
  { label: 'FortiGate', value: 'fortigate' }, { label: 'Windows', value: 'windows' },
  { label: 'Cowrie', value: 'cowrie' }, { label: 'Dionaea', value: 'dionaea' }, { label: 'Heralding', value: 'heralding' },
  { label: 'Iscas (Redis/ES/Docker)', value: 'isca' }, { label: 'OpenCanary', value: 'opencanary' },
  { label: 'Outro', value: 'outro' },
];
const ACAO_OPTS = ['login_falha', 'login_ok', 'lockout', 'scan', 'bloqueio', 'conexao', 'comando', 'download', 'tunel', 'reflexao', 'outro'].map((value) => ({ label: value.replace('_', ' '), value }));
const FONTE_LABEL: Record<string, string> = { fortigate: 'FortiGate', windows: 'Windows', cowrie: 'Cowrie', dionaea: 'Dionaea', heralding: 'Heralding', isca: 'Iscas', opencanary: 'OpenCanary', outro: 'Outro' };
const ACAO_COLOR: Record<string, string> = {
  login_falha: '#f59e0b', lockout: '#ef4444', login_ok: '#dc2626', scan: '#0ea5e9',
  bloqueio: '#64748b', conexao: '#64748b', comando: '#7c3aed', download: '#b91c1c', tunel: '#0f766e', reflexao: '#ea580c', outro: '#64748b',
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
        {itens.map((i) => {
          const conteudo = <>
            <div className="iv-row" style={{ justifyContent: 'space-between', fontSize: '.85rem' }}>
              <span style={{ fontFamily: 'monospace' }}>{i.rotulo}{i.extra ? ` · ${i.extra}` : ''}</span>
              <strong>{i.total}</strong>
            </div>
            <Bar pct={(i.total / max) * 100} />
          </>;
          return onPick
            ? <div key={i.rotulo} className="radar-top-item" role="button" tabIndex={0} onClick={() => onPick(i.rotulo)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(i.rotulo); } }}>{conteudo}</div>
            : <div key={i.rotulo}>{conteudo}</div>;
        })}
      </div>
    </div>
  );
}

/** Data/hora no fuso do navegador (ex.: Fortaleza, UTC-3). */
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
/** Honeypots são iscas: login "aceito" ali não dá acesso a nada real. */
const ISCAS = new Set(['cowrie', 'dionaea', 'opencanary', 'heralding', 'isca']);
const rotuloAcao = (e: RadarEvento) => (e.acao === 'login_ok' && ISCAS.has(e.fonte) ? 'login aceito (isca)' : e.acao.replace('_', ' '));
/** Resumo curto do que o atacante fez (comando, arquivo ou credencial). */
function resumoDetalhe(e: RadarEvento): string {
  const d = e.detalhes ?? {};
  const s = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : '');
  const txt = s('comando') || s('url') || s('ips');
  return txt.length > 70 ? `${txt.slice(0, 70)}…` : txt;
}

export function Radar() {
  const [dias, setDias] = useState(7);
  const [escopo, setEscopo] = useState<RadarEscopo>('internet');
  const [ip, setIp] = useState<string | undefined>();
  const [servico, setServico] = useState<string | undefined>();
  const [acao, setAcao] = useState<string | undefined>();
  const [fonte, setFonte] = useState<AtaqueFonte | undefined>();
  const [pais, setPais] = useState<string | undefined>();
  const [qRaw, setQRaw] = useState('');
  const q = useDebounce(qRaw, 300);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<RadarEvento | null>(null);

  const resumo = useQuery({ queryKey: ['radar-resumo', dias, escopo], queryFn: () => getRadarResumo(dias, escopo), refetchInterval: ATUALIZAR_MS });

  const filtros = useMemo(() => ({ ip, servico, acao, fonte, pais, escopo, q: q || undefined, page, limit: ROWS }), [ip, servico, acao, fonte, pais, escopo, q, page]);
  const eventos = useQuery({ queryKey: ['radar-eventos', filtros], queryFn: () => getRadarEventos(filtros), refetchInterval: ATUALIZAR_MS, placeholderData: (anterior) => anterior });

  // qualquer mudança de filtro volta para a página 1
  const setF = <T,>(set: (v: T | undefined) => void) => (v: T | undefined) => { set(v); setPage(0); };
  const pickIp = setF(setIp);
  const pickServico = setF(setServico);
  const pickAcao = setF(setAcao);
  const pickFonte = setF(setFonte);
  const pickPais = setF(setPais);
  const pickBusca = (value: string) => { setQRaw(value); setPage(0); };
  const pickEscopo = (v: RadarEscopo) => { setEscopo(v); setPage(0); };

  const r = resumo.data;
  const tone = !r ? 'ok' : r.lockouts > 0 ? 'crit' : r.total > 0 ? 'warn' : 'ok';

  const activeFilters = [
    ip && { key: 'ip', label: `IP: ${ip}`, onRemove: () => pickIp(undefined) },
    servico && { key: 'srv', label: `Serviço: ${servico}`, onRemove: () => pickServico(undefined) },
    acao && { key: 'acao', label: `Ação: ${acao}`, onRemove: () => pickAcao(undefined) },
    fonte && { key: 'fonte', label: `Fonte: ${FONTE_LABEL[fonte]}`, onRemove: () => pickFonte(undefined) },
    pais && { key: 'pais', label: `País: ${pais}`, onRemove: () => pickPais(undefined) },
    q && { key: 'q', label: `Busca: ${q}`, onRemove: () => pickBusca('') },
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
          ? <>Últimos {r.dias} dia(s), {ESCOPO_LABEL[escopo]}: <strong>{r.total.toLocaleString('pt-BR')}</strong> eventos de <strong>{r.ipsUnicos.toLocaleString('pt-BR')}</strong> IPs, {r.falhasLogin.toLocaleString('pt-BR')} falhas de login e <strong>{r.lockouts}</strong> bloqueios de conta.</>
          : 'Carregando…'}
        <span className="iv-muted" style={{ display: 'block', fontSize: '.78rem' }}>
          {resumo.isFetching ? 'atualizando…' : `atualizado às ${hora(resumo.dataUpdatedAt)} · a cada 1 min`}
        </span>
      </StatusStrip>

      <StatusStrip tone="ok" icon="pi-shield">
        Este painel resume eventos reais recebidos pelos coletores. Simulações de laboratório ficam em <Link to="/labs">Labs</Link> e sua cobertura em <Link to="/attack">ATT&amp;CK</Link>.
        {' '}<span className="iv-muted" style={{ fontSize: '.78rem' }}>Países: <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer">IP Geolocation by DB-IP</a>.</span>
      </StatusStrip>

      <div className="iv-row iv-wrap iv-mt">
        <span className="iv-muted" style={{ fontSize: '.8rem' }}>Período:</span>
        {DIAS_OPTS.map((d) => (
          <Chip key={d} label={d === 1 ? '24 h' : `${d} dias`} active={dias === d} onClick={() => { setDias(d); }} />
        ))}
        <span className="iv-muted" style={{ fontSize: '.8rem', marginLeft: '1rem' }}>Origem:</span>
        {ESCOPO_OPTS.map((o) => (
          <span key={o.value} title={o.dica}><Chip label={o.label} active={escopo === o.value} onClick={() => pickEscopo(o.value)} /></span>
        ))}
      </div>

      <div className="iv-card iv-row iv-wrap iv-mt radar-filters" aria-label="Filtros dos eventos">
        <InputText value={qRaw} onChange={(e) => pickBusca(e.target.value)} placeholder="Buscar IP, serviço, usuário ou alvo…" aria-label="Buscar eventos do Radar" />
        <Dropdown value={fonte} options={FONTE_OPTS} onChange={(e) => pickFonte(e.value)} placeholder="Todas as fontes" showClear />
        <Dropdown value={pais} options={(r?.topPaises ?? []).map((p) => ({ label: `${p.nome} (${p.total})`, value: p.nome }))} onChange={(e) => pickPais(e.value)} placeholder="Todos os países" showClear />
        <Dropdown value={acao} options={ACAO_OPTS} onChange={(e) => pickAcao(e.value)} placeholder="Todas as ações" showClear />
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
        <h4 style={{ margin: '0 0 .6rem' }}>Linha do tempo ({r?.granularidade === 'hora' ? 'por hora' : 'por dia'}, horário local)</h4>
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
        {escopo !== 'interno' && (
          <TopList titulo="Países de origem (clique para filtrar)"
            itens={(r?.topPaises ?? []).map((i) => ({ rotulo: i.nome, total: i.total }))} onPick={(v) => pickPais(v)} />
        )}
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
        <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between', marginBottom: '.6rem' }}>
          <h4 style={{ margin: 0 }}>Eventos recentes</h4>
          <span className="iv-muted" style={{ fontSize: '.82rem' }}>{eventos.data?.total ?? 0} resultados · selecione uma linha para detalhes</span>
        </div>
        <ActiveFiltersBar filters={activeFilters} />
        <DataTable
          value={eventos.data?.items ?? []}
          lazy paginator first={page * ROWS} rows={ROWS} totalRecords={eventos.data?.total ?? 0}
          onPage={(e) => setPage(e.page ?? 0)}
          emptyMessage="Nenhum evento para os filtros."
          dataKey="id"
          selectionMode="single"
          onSelectionChange={(e) => setSelected(e.value as RadarEvento)}
          rowHover
        >
          <Column header="Quando" style={{ width: 170 }} body={(e: RadarEvento) => quando(e.ocorridoEm)} />
          <Column header="IP" body={(e: RadarEvento) => (
            <span style={{ fontFamily: 'monospace' }}>{e.ipOrigem ?? '—'}{e.paisOrigem ? ` · ${e.paisOrigem}` : ''}</span>
          )} />
          <Column header="Serviço" body={(e: RadarEvento) => e.servico ? `${e.servico}${e.portaDestino ? `:${e.portaDestino}` : ''}` : (e.portaDestino ?? '—')} />
          <Column header="Protocolo" field="protocolo" />
          <Column header="Ação" body={(e: RadarEvento) => <Pill label={rotuloAcao(e)} color={ACAO_COLOR[e.acao]} />} />
          <Column header="Usuário tentado" field="usuarioTentado" />
          <Column header="Detalhe" body={(e: RadarEvento) => <span style={{ fontFamily: 'monospace', fontSize: '.8rem' }}>{resumoDetalhe(e)}</span>} />
          <Column header="Fonte" field="fonte" style={{ width: 110 }} />
        </DataTable>
      </div>

      <Sidebar visible={!!selected} position="right" onHide={() => setSelected(null)} style={{ width: 'min(620px, 100vw)' }}>
        {selected && <DetailLayout>
          <DetailHeader title="Detalhes do evento"><Pill label={rotuloAcao(selected)} color={ACAO_COLOR[selected.acao]} /><Pill label={FONTE_LABEL[selected.fonte] ?? selected.fonte} /></DetailHeader>
          <DetailSection title="Quando"><p>{quando(selected.ocorridoEm)} <span className="iv-muted">({selected.ocorridoEm.replace('T', ' ').slice(0, 19)} UTC)</span></p></DetailSection>
          {selected.acao === 'reflexao' && (
            <StatusStrip tone="warn" icon="pi-exclamation-triangle">
              Tentativa de usar o seu IP como <strong>refletor</strong> de DDoS. O endereço de origem é falsificado:
              é a <strong>vítima</strong> que o atacante queria atingir. O firewall registrou e descartou; nada respondeu.
            </StatusStrip>
          )}
          {ISCAS.has(selected.fonte) && selected.acao === 'login_ok' && (
            <StatusStrip icon="pi-info-circle">
              Isca: o honeypot aceita a senha de propósito. No SSH, a sessão é repassada a um <strong>Linux real descartável</strong>,
              sem saída para a internet e restaurado periodicamente. O que vale aqui é ver o que o atacante faz depois de entrar.
            </StatusStrip>
          )}
          <DetailSection title="Origem"><p style={{ fontFamily: 'monospace' }}>{selected.ipOrigem ?? 'IP não informado'}{selected.paisOrigem ? ` · ${selected.paisOrigem}` : ''}{selected.escopo === 'interno' ? ' · rede interna (range)' : ''}</p></DetailSection>
          <DetailSection title="Alvo"><p>{selected.alvo ?? '—'}</p></DetailSection>
          <DetailSection title="Serviço"><p>{selected.servico ?? '—'}{selected.portaDestino ? `:${selected.portaDestino}` : ''}{selected.protocolo ? ` · ${selected.protocolo}` : ''}</p></DetailSection>
          <DetailSection title="Usuário tentado"><p>{selected.usuarioTentado ?? '—'}</p></DetailSection>
          {(() => {
            const d = selected.detalhes ?? {};
            const mitre = Array.isArray(d.mitre) ? (d.mitre as { id?: unknown; nome?: unknown }[]).filter((m) => typeof m?.id === 'string') : [];
            const txt = (k: string) => (typeof d[k] === 'string' || typeof d[k] === 'number' ? String(d[k]) : null);
            return <>
              {mitre.length > 0 && <DetailSection title="Técnicas MITRE ATT&CK">
                <p>{mitre.map((m) => <Link key={String(m.id)} to="/attack" style={{ marginRight: 8 }}><Chip label={`${String(m.id)} ${typeof m.nome === 'string' ? m.nome : ''}`} /></Link>)}</p>
              </DetailSection>}
              {txt('comando') && <DetailSection title="Comando"><p style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{txt('comando')}</p></DetailSection>}
              {txt('url') && <DetailSection title="URL / arquivo"><p style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{txt('url')}</p></DetailSection>}
              {txt('regra') && <DetailSection title="Regra do Wazuh"><p>{txt('regra')}{txt('nivel') ? ` · nível ${txt('nivel')}` : ''}{txt('descricao') ? ` · ${txt('descricao')}` : ''}</p></DetailSection>}
            </>;
          })()}
          {selected.ipOrigem && typeof selected.detalhes?.sessao === 'string' && (
            <SessaoAtacante sessao={selected.detalhes.sessao} ip={selected.ipOrigem} />
          )}
          <p className="iv-muted" style={{ fontSize: '.8rem' }}>O Radar não mostra senhas tentadas nesta tela.</p>
        </DetailLayout>}
      </Sidebar>
    </div>
  );
}
