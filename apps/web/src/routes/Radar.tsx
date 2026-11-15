import { useCallback, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { AmbienteSelector } from '@/components/ui/AmbienteSelector';
import { useAmbiente } from '@/services/ambiente';
import { Kpi, StatusStrip, Chip, EmptyState } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { useDebounce } from '@/hooks/useDebounce';
import { getRadarResumo, getRadarEventos, type RadarEscopo, type RadarResumo, type RadarEventosFiltro } from '@/services/radar';
import { calcularCobertura } from '@/services/attack';
import { FONTE_LABEL, acaoMeta } from './inteligencia/regras';
import { TopList, type TopItem } from './inteligencia/radar/TopList';
import { EventosTabela, ROWS, type FiltrosUi } from './inteligencia/radar/EventosTabela';
import { EventoDrawer } from './inteligencia/radar/EventoDrawer';
import { IndicadorDrawer, type Dimensao } from './inteligencia/radar/IndicadorDrawer';
import { TecnicaDrawer } from './inteligencia/TecnicaDrawer';
import { Timeline } from './inteligencia/radar/Timeline';
import '@/styles/telas/inteligencia.css';

const DIAS_OPTS = [1, 7, 30];
/** Atualização automática (só com a aba visível: o React Query pausa em segundo plano). */
const ATUALIZAR_MS = 60_000;
const ESCOPO_OPTS: { value: RadarEscopo; label: string; dica: string }[] = [
  { value: 'internet', label: 'Internet', dica: 'Origem em IP público: o que chega de fora' },
  { value: 'interno', label: 'Rede privada / sem IP', dica: 'Origem privada ou não informada, em qualquer ambiente' },
  { value: 'todos', label: 'Todas as origens', dica: 'Origens públicas, privadas e não informadas' },
];
const hora = (ms: number) => (ms ? new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');
const periodoLabel = (d: number) => (d === 1 ? '24 h' : `${d} dias`);

function indicadores(r: RadarResumo | undefined, dim: Dimensao): TopItem[] {
  if (!r) return [];
  if (dim === 'ip') return r.topIps.map((i) => ({ id: `ip:${i.ip}`, rotulo: i.ip, extra: i.pais, total: i.total }));
  const src = dim === 'servico' ? r.topServicos : dim === 'usuario' ? r.topUsuarios : r.topPaises;
  return src.map((i) => ({ id: `${dim}:${i.nome}`, rotulo: i.nome, total: i.total }));
}

export function Radar() {
  const [ambiente, setAmbiente] = useAmbiente();
  const [dias, setDias] = useState(7);
  const [escopo, setEscopo] = useState<RadarEscopo>('todos');
  const [ip, setIp] = useState<string | undefined>();
  const [servico, setServico] = useState<string | undefined>();
  const [acao, setAcao] = useState<string | undefined>();
  const [fonte, setFonte] = useState<string | undefined>();
  const [pais, setPais] = useState<string | undefined>();
  const [qRaw, setQRaw] = useState('');
  const q = useDebounce(qRaw, 300);
  const [page, setPage] = useState(0);

  const resumo = useQuery({ queryKey: ['radar-resumo', dias, escopo, ambiente], queryFn: () => getRadarResumo(dias, escopo, ambiente), retry: false, refetchInterval: ATUALIZAR_MS });
  const filtros = useMemo(() => ({ ip, servico, acao, fonte: fonte as RadarEventosFiltro['fonte'], pais, escopo, ambiente, q: q || undefined, page, limit: ROWS }), [ip, servico, acao, fonte, pais, escopo, ambiente, q, page]);
  const eventos = useQuery({ queryKey: ['radar-eventos', filtros], queryFn: () => getRadarEventos(filtros), retry: false, refetchInterval: ATUALIZAR_MS });
  const r = resumo.data;

  // três fichas possíveis (evento, indicador, técnica); abrir uma fecha as outras
  const evSel = useDrawerSelection(eventos.data?.items ?? []);
  const [dim, setDim] = useState<Dimensao>('ip');
  const listaDim = useMemo(() => indicadores(r, dim), [r, dim]);
  const indSel = useDrawerSelection(listaDim);
  const [versao, setVersao] = useState(0); // recalcula após marcar detecção
  const cobertura = useMemo(() => {
    const obs = Object.fromEntries((r?.mitre ?? []).map((m) => [m.id, m.eventos]));
    const ordem = (r?.mitre ?? []).map((m) => m.id);
    return calcularCobertura(obs).filter((t) => ordem.includes(t.id)).sort((a, b) => ordem.indexOf(a.id) - ordem.indexOf(b.id));
  }, [r, versao]);
  const tecSel = useDrawerSelection(cobertura);
  const fecharTudo = () => { evSel.close(); indSel.close(); tecSel.close(); };
  const abrirIndicador = (d: Dimensao) => (id: string) => { fecharTudo(); setDim(d); indSel.open(id); };

  const reset = <T,>(set: (v: T | undefined) => void) => (v: T | undefined) => { set(v); setPage(0); };
  const limpar = useCallback(() => { setIp(undefined); setServico(undefined); setAcao(undefined); setFonte(undefined); setPais(undefined); setQRaw(''); setPage(0); }, []);
  const filtrarPor = (d: Dimensao, valor: string) => {
    fecharTudo(); limpar();
    if (d === 'ip') setIp(valor); else if (d === 'servico') setServico(valor); else if (d === 'pais') setPais(valor); else setQRaw(valor);
    document.getElementById('radar-eventos-titulo')?.scrollIntoView({ behavior: 'smooth' });
  };
  const alternarAcao = (a: string) => reset(setAcao)(acao === a ? undefined : a);

  const f: FiltrosUi = {
    busca: qRaw, setBusca: (v) => { setQRaw(v); setPage(0); },
    fonte, setFonte: reset(setFonte), acao, setAcao: reset(setAcao), pais, setPais: reset(setPais),
    paises: r?.topPaises ?? [], limpar,
    chips: [
      ip && { key: 'ip', label: `IP: ${ip}`, onRemove: () => reset(setIp)(undefined) },
      servico && { key: 'srv', label: `Serviço: ${servico}`, onRemove: () => reset(setServico)(undefined) },
      acao && { key: 'acao', label: `Ação: ${acaoMeta(acao).label}`, onRemove: () => reset(setAcao)(undefined) },
      fonte && { key: 'fonte', label: `Fonte: ${FONTE_LABEL[fonte] ?? fonte}`, onRemove: () => reset(setFonte)(undefined) },
      pais && { key: 'pais', label: `País: ${pais}`, onRemove: () => reset(setPais)(undefined) },
      q && { key: 'q', label: `Busca: ${q}`, onRemove: () => f.setBusca('') },
    ].filter((c): c is { key: string; label: string; onRemove: () => void } => Boolean(c)),
  };

  const loginsOk = r?.porAcao.find((a) => a.nome === 'login_ok')?.total ?? 0;
  const periodo = periodoLabel(dias);
  const v = (n: number | undefined) => (resumo.isLoading ? '…' : n ?? 0);

  return (
    <div>
      <PageHeader title={ambiente === 'producao' ? 'Radar de produção' : 'Radar de segurança'} subtitle="Eventos de segurança por ambiente; um evento recebido não significa, sozinho, um ataque."
        actions={<>
          <span className="in-periodo" role="group" aria-label="Origem dos eventos">
            {ESCOPO_OPTS.map((o) => <span key={o.value} title={o.dica}><Chip label={o.label} active={escopo === o.value} onClick={() => { setEscopo(o.value); setPage(0); fecharTudo(); }} /></span>)}
          </span>
          <span className="in-periodo" role="group" aria-label="Período">
            {DIAS_OPTS.map((d) => <Chip key={d} label={periodoLabel(d)} active={dias === d} onClick={() => { setDias(d); fecharTudo(); }} />)}
          </span>
        </>} />
      <AmbienteSelector value={ambiente} onChange={(v) => { setAmbiente(v); limpar(); setEscopo('todos'); fecharTudo(); }} />
      {!resumo.isError && (
        <p className="in-atualizado" aria-live="polite">{resumo.isFetching ? 'atualizando…' : `atualizado às ${hora(resumo.dataUpdatedAt)} · a cada 1 min`}</p>
      )}

      {resumo.isError ? (
        <div className="iv-card">
          <EmptyState icon="pi-server" title="O Radar precisa do servidor"
            text="Ele lê os eventos que os coletores gravam no PostgreSQL (apps/api). No modo só local, sem API, não há o que mostrar."
            action={<Button label="Tentar de novo" icon="pi pi-refresh" outlined onClick={() => { void resumo.refetch(); void eventos.refetch(); }} />} />
        </div>
      ) : (<>
        {loginsOk > 0 && (
          <StatusStrip tone="warn" icon="pi-unlock">
            <strong>{loginsOk} login(s) aceito(s)</strong> em {periodo}. Em honeypot (isca) é esperado; fora dele, confirme se foi você.{' '}
            <button type="button" className="iv-linkbtn" onClick={() => alternarAcao('login_ok')}>Ver eventos</button>
          </StatusStrip>
        )}
        {r?.truncado && <StatusStrip icon="pi-info-circle">A janela tem mais eventos que o limite de análise; o resumo cobre os mais recentes.</StatusStrip>}

        <div className="iv-summary iv-mt">
          <div className="iv-kpis in-kpis-5">
            <Kpi label="Eventos" icon="pi-bolt" value={v(r?.total)} hint={`em ${periodo}`} />
            <Kpi label="IPs únicos" icon="pi-globe" value={v(r?.ipsUnicos)} />
            <Kpi label="Falhas de login" icon="pi-user-minus" tone="warning" value={v(r?.falhasLogin)} active={acao === 'login_falha'} onClick={() => alternarAcao('login_falha')} />
            <Kpi label="Contas bloqueadas" icon="pi-lock" tone="serious" value={v(r?.lockouts)} active={acao === 'lockout'} onClick={() => alternarAcao('lockout')} />
            <Kpi label="Logins aceitos" icon="pi-unlock" tone="danger" value={v(loginsOk)} active={acao === 'login_ok'} onClick={() => alternarAcao('login_ok')} />
          </div>
          <Timeline pontos={r?.timeline ?? []} porHora={r?.granularidade === 'hora'} />
        </div>

        <div className="in-tops iv-mt">
          <TopList titulo="IPs mais ativos" itens={indicadores(r, 'ip')} onOpen={abrirIndicador('ip')} selId={indSel.selId} />
          <TopList titulo="Serviços visados" itens={indicadores(r, 'servico')} onOpen={abrirIndicador('servico')} selId={indSel.selId} />
          <TopList titulo="Usuários tentados" itens={indicadores(r, 'usuario')} onOpen={abrirIndicador('usuario')} selId={indSel.selId} />
          {escopo !== 'interno' && <TopList titulo="Países de origem" itens={indicadores(r, 'pais')} onOpen={abrirIndicador('pais')} selId={indSel.selId} />}
          {r?.senhasHabilitadas && (
            <TopList titulo="Senhas mais tentadas" aviso="Dado sensível: não publique nem compartilhe."
              itens={r.topSenhas.map((i) => ({ id: i.nome, rotulo: i.nome, total: i.total }))} />
          )}
        </div>

        <section className="iv-card iv-mt" aria-labelledby="radar-mitre">
          <h3 id="radar-mitre" className="iv-section-label">Técnicas MITRE ATT&amp;CK observadas</h3>
          {(r?.mitre.length ?? 0) === 0
            ? <p className="in-muted-p">Nenhuma técnica mapeada no período.</p>
            : <div className="iv-row iv-wrap">{r!.mitre.map((m) => (
                <button key={m.id} type="button" className="in-tag" data-sel={tecSel.isOpen(m.id) || undefined} aria-haspopup="dialog"
                  onClick={() => { fecharTudo(); tecSel.open(m.id); }}>
                  <span className="mono">{m.id}</span> {m.nome} <strong className="tabular">{m.eventos}</strong>
                </button>
              ))}</div>}
        </section>

        <EventosTabela itens={eventos.data?.items ?? []} total={eventos.data?.total ?? 0} loading={eventos.isLoading} page={page} onPage={setPage}
          onOpen={(id) => { fecharTudo(); evSel.open(id); }} selId={evSel.selId} f={f} />

        <p className="in-rodape">Este painel resume eventos reais recebidos pelos coletores. Simulações ficam em <Link to="/labs">Labs</Link> e a cobertura em <Link to="/attack">ATT&amp;CK</Link>. Países: <a href="https://db-ip.com" target="_blank" rel="noopener noreferrer">IP Geolocation by DB-IP</a>.</p>
      </>)}

      {evSel.item && <EventoDrawer ev={evSel.item} nav={evSel.nav} onFiltrarIp={(x) => filtrarPor('ip', x)} />}
      {indSel.item && <IndicadorDrawer dim={dim} item={indSel.item} totalPeriodo={r?.total ?? 0} periodo={periodo} nav={indSel.nav} onFiltrar={filtrarPor} />}
      {tecSel.item && <TecnicaDrawer tecnica={tecSel.item} nav={tecSel.nav} periodo={periodo} onChange={() => setVersao((n) => n + 1)} />}
    </div>
  );
}
