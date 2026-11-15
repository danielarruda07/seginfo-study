import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Kpi, Pill, StatusStrip } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { useDebounce } from '@/hooks/useDebounce';
import { getRadarResumo } from '@/services/radar';
import { getPericiaTecnicas } from '@/services/pericia';
import { getTecnica } from '@/data/attack';
import { listPurpleExercises } from '@/services/exerciciosPurple';
import { TATICAS, calcularCobertura, resumoCobertura, camadaNavigator, pontuacao, type CoberturaTecnica } from '@/services/attack';
import { CAMADAS, proximoPassoTecnica, tecnicaVisivel, temCamada, type Camada } from './inteligencia/regras';
import { TecnicaDrawer } from './inteligencia/TecnicaDrawer';
import '@/styles/telas/inteligencia.css';

function baixarJson(nome: string, dados: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

const ORDEM_TATICA = new Map(TATICAS.map((t, i) => [t.id, i]));
const CAMADA_LABEL: Record<Camada, string> = Object.fromEntries(CAMADAS.map((c) => [c.id, c.label])) as Record<Camada, string>;
const NOME_TECNICA_PERICIA: Record<string, string> = {
  'T1053.003': 'Cron', 'T1543.002': 'Systemd Service', 'T1546.004': 'Unix Shell Configuration Modification',
  'T1098.004': 'SSH Authorized Keys', 'T1574.006': 'Dynamic Linker Hijacking', 'T1037.004': 'RC Scripts',
  'T1543.003': 'Windows Service', 'T1053.005': 'Scheduled Task', 'T1547.001': 'Registry Run Keys / Startup Folder',
  'T1546.003': 'WMI Event Subscription', 'T1136.001': 'Local Account', 'T1098.007': 'Additional Local or Domain Groups',
};

export function Attack() {
  // Radar só existe no modo servidor; sem ele a camada "observada" fica vazia.
  const radar = useQuery({ queryKey: ['radar', 'resumo', 30], queryFn: () => getRadarResumo(30), retry: false });
  const pericia = useQuery({ queryKey: ['pericia', 'tecnicas'], queryFn: getPericiaTecnicas, retry: false });
  const observadas = useMemo(() => Object.fromEntries((radar.data?.mitre ?? []).map((m) => [m.id, m.eventos])), [radar.data]);
  const [versao, setVersao] = useState(0); // força recálculo após marcar detecção
  const cobertura = useMemo(() => calcularCobertura(observadas), [observadas, versao]);
  const resumo = resumoCobertura(cobertura);
  const exercicios = listPurpleExercises().filter((e) => e.status !== 'planejado');
  const sinaisExercicio = exercicios.filter((e) => e.detection === 'detectado' || e.detection === 'parcial').length;
  const respostas = exercicios.filter((e) => e.blueResponse.trim()).length;
  const [filtro, setFiltro] = useState<Camada | null>(null);
  const [buscaRaw, setBuscaRaw] = useState('');
  const busca = useDebounce(buscaRaw, 300);

  // ordem da matriz (coluna por coluna) para o ↑/↓ da ficha seguir o que se vê
  const visiveis = useMemo(() => cobertura
    .filter((t) => tecnicaVisivel(t, filtro, busca))
    .sort((a, b) => (ORDEM_TATICA.get(a.tatica) ?? 99) - (ORDEM_TATICA.get(b.tatica) ?? 99)), [cobertura, filtro, busca]);
  const sel = useDrawerSelection(visiveis);

  /** Abre a ficha; se a técnica estiver escondida pelo filtro, limpa o filtro antes. */
  const abrir = (t: CoberturaTecnica) => {
    if (!tecnicaVisivel(t, filtro, busca)) { setFiltro(null); setBuscaRaw(''); }
    sel.open(t.id);
  };
  const alternar = (c: Camada) => setFiltro(filtro === c ? null : c);

  return (
    <div>
      <PageHeader
        title="Matriz ATT&CK"
        subtitle="Separe observações reais do Radar dos alertas de exercício, da validação de regras e das respostas registradas."
        actions={<Button label="Exportar para o Navigator" icon="pi pi-download" outlined
          onClick={() => baixarJson('seginfo-attack-layer.json', camadaNavigator(cobertura))} />}
      />

      {radar.isError && (
        <StatusStrip icon="pi-info-circle">Radar indisponível (modo local ou API fora): a camada "Vi no Radar" fica vazia.</StatusStrip>
      )}
      {pericia.isError && <StatusStrip icon="pi-info-circle">Não foi possível carregar agora as técnicas sugeridas pelos laudos periciais.</StatusStrip>}

      <div className="iv-kpis iv-mt">
        <Kpi label="Observação · Radar real" icon="pi-eye" value={radar.isLoading ? '…' : radar.isError ? '—' : radar.data?.total ?? 0} hint={`${resumo.observadas} técnicas · últimos 30 dias`}
          active={filtro === 'observada'} onClick={() => alternar('observada')} />
        <Kpi label="Alertas · exercícios" icon="pi-bell" value={sinaisExercicio} hint="sinais detectados/parciais nos testes; sem correlação automática com o Radar"
          active={filtro === 'alerta'} onClick={() => alternar('alerta')} />
        <Kpi label="Validação registrada" icon="pi-check-circle" value={resumo.detectadas} hint="técnicas com regra anotada após teste"
          active={filtro === 'validada'} onClick={() => alternar('validada')} />
        <Kpi label="Resposta documentada" icon="pi-shield" value={respostas} hint="exercícios com triagem/resposta anotada"
          active={filtro === 'respondida'} onClick={() => alternar('respondida')} />
      </div>
      {pericia.data && pericia.data.length > 0 && <section className="iv-card iv-mt" aria-label="Técnicas sugeridas por evidências dos laudos">
        <h2 className="iv-section-label">Evidência pericial · persistência (90 dias)</h2>
        <p className="iv-muted">Mapeamento baseado no tipo de persistência registrado pelo coletor. Esta camada é distinta de “Vi no Radar” e requer validação da evidência no dossiê.</p>
        <div className="iv-row iv-wrap">{pericia.data.map((x) => {
          const tecnica = getTecnica(x.id);
          return <Pill key={x.id} label={<><span className="mono">{x.id}</span> · {NOME_TECNICA_PERICIA[x.id] ?? tecnica?.nome ?? 'Técnica ATT&CK'} · {x.laudos} laudo(s)</>} />;
        })}</div>
        <p><Link to="/investigacoes">Abrir os laudos e revisar cada evidência</Link></p>
      </section>}
      <p className="iv-muted in-ciclo-nota">Estudo: {resumo.estudadas}/{resumo.total} técnicas · Prática: {resumo.praticadas}/{resumo.total} técnicas. Esses indicadores de aprendizagem não contam como evidência operacional.</p>
      <p className="iv-muted"><Link to="/investigacoes">Abrir dossiês para percorrer eventos, arquivos e persistência por janela de ataque</Link></p>

      {resumo.lacunas.length > 0 && (
        <StatusStrip tone="warn" icon="pi-exclamation-triangle">
          <strong>{resumo.lacunas.length} etapa(s) pendente(s) no ciclo operacional:</strong>{' '}
          {resumo.lacunas.map((t) => (
            <button key={t.id} type="button" className="attack-link" onClick={() => abrir(t)} aria-label={`Abrir ${t.id} ${t.nome}`}>{t.id} · {proximoPassoTecnica(t).texto}</button>
          ))}
        </StatusStrip>
      )}

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <SearchInput value={buscaRaw} onChange={setBuscaRaw} placeholder="Buscar técnica por ID ou nome…" />
          <span className="in-legenda" aria-label="Legenda das camadas">
            {CAMADAS.map((c) => (
              <span key={c.id} className={`in-camada in-camada--${c.id}`} data-on><span className="in-dot" aria-hidden="true" />{c.label}</span>
            ))}
          </span>
          <span className="iv-toolbar__count">{visiveis.length} de {cobertura.length} técnicas</span>
        </div>
        <ActiveFiltersBar filters={[
          filtro && { key: 'camada', label: CAMADA_LABEL[filtro], onRemove: () => setFiltro(null) },
          busca && { key: 'busca', label: `Busca: ${busca}`, onRemove: () => setBuscaRaw('') },
        ]} />

        <div className="attack-grid">
          {TATICAS.map((tatica) => {
            const tecnicas = cobertura.filter((t) => t.tatica === tatica.id);
            const cobertas = tecnicas.filter((t) => pontuacao(t) > 0).length;
            return (
              <section key={tatica.id} className="attack-col in-tatica" aria-labelledby={`tat-${tatica.id}`}>
                <h3 id={`tat-${tatica.id}`} className="attack-col__title">{tatica.nome}</h3>
                <span className="iv-muted attack-col__id"><span className="mono">{tatica.id}</span> · {cobertas}/{tecnicas.length} com cobertura</span>
                <div className="iv-col">
                  {tecnicas.map((t) => {
                    const camadas = CAMADAS.filter((c) => temCamada(t, c.id)).map((c) => c.label);
                    return (
                      <button key={t.id} type="button" className="attack-cell" data-score={pontuacao(t)}
                        data-dim={!tecnicaVisivel(t, filtro, busca) || undefined} data-sel={sel.isOpen(t.id) || undefined}
                        onClick={() => abrir(t)} aria-haspopup="dialog"
                        aria-label={`${t.id} ${t.nome}: ${camadas.join(', ') || 'sem cobertura'}. Abrir ficha.`}>
                        <span className="attack-cell__id">{t.id}</span>
                        <span className="attack-cell__nome">{t.nome}</span>
                        <span className="attack-cell__dots" aria-hidden="true">
                          {CAMADAS.map((c) => <span key={c.id} className={`in-camada--${c.id} in-dot`} data-on={temCamada(t, c.id) || undefined} />)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {sel.item && <TecnicaDrawer tecnica={sel.item} nav={sel.nav} onChange={() => setVersao((v) => v + 1)} />}
    </div>
  );
}
