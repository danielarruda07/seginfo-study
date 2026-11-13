import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Sidebar } from 'primereact/sidebar';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { DetailHeader, DetailLayout, DetailSection } from '@/components/ui/Detail';
import { Kpi, StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { getRadarResumo } from '@/services/radar';
import { getTopico } from '@/services/catalog';
import { getLab } from '@/services/inventario';
import {
  TATICAS, calcularCobertura, resumoCobertura, camadaNavigator, marcarDeteccao, removerDeteccao, pontuacao,
  type CoberturaTecnica,
} from '@/services/attack';

type Camada = 'estudada' | 'praticada' | 'detectada' | 'observada';
const CAMADAS: { id: Camada; label: string; cor: string }[] = [
  { id: 'estudada', label: 'Estudei', cor: '#0ea5e9' },
  { id: 'praticada', label: 'Pratiquei', cor: '#7c3aed' },
  { id: 'detectada', label: 'Detecto', cor: '#22c55e' },
  { id: 'observada', label: 'Vi no Radar', cor: '#ef4444' },
];

const temCamada = (t: CoberturaTecnica, c: Camada) =>
  c === 'detectada' ? !!t.detectada : c === 'observada' ? t.observada > 0 : t[c];

function baixarJson(nome: string, dados: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export function Attack() {
  // Radar só existe no modo servidor; sem ele a camada "observada" fica vazia.
  const radar = useQuery({ queryKey: ['radar', 'resumo', 30], queryFn: () => getRadarResumo(30), retry: false });
  const observadas = useMemo(
    () => Object.fromEntries((radar.data?.mitre ?? []).map((m) => [m.id, m.eventos])),
    [radar.data],
  );
  const [versao, setVersao] = useState(0); // força recálculo após marcar detecção
  const cobertura = useMemo(() => calcularCobertura(observadas), [observadas, versao]);
  const resumo = resumoCobertura(cobertura);
  const [filtro, setFiltro] = useState<Camada | null>(null);
  const [sel, setSel] = useState<CoberturaTecnica | null>(null);

  const atualizar = (id: string) => {
    setVersao((v) => v + 1);
    setSel(calcularCobertura(observadas).find((t) => t.id === id) ?? null);
  };

  return (
    <div>
      <PageHeader
        title="Matriz ATT&CK"
        subtitle="Onde você estudou, praticou, detecta e já viu ataques reais. As lacunas mostram o que treinar em seguida."
        actions={<Button label="Exportar para o Navigator" icon="pi pi-download" outlined
          onClick={() => baixarJson('seginfo-attack-layer.json', camadaNavigator(cobertura))} />}
      />

      {radar.isError && (
        <StatusStrip tone="warn" icon="pi-info-circle">
          Radar indisponível (modo local ou API fora). A camada "Vi no Radar" fica vazia.
        </StatusStrip>
      )}

      <div className="iv-kpis iv-mt">
        <Kpi label="Estudadas" value={`${resumo.pctEstudadas}%`} hint={`${resumo.estudadas}/${resumo.total} técnicas`}
          active={filtro === 'estudada'} onClick={() => setFiltro(filtro === 'estudada' ? null : 'estudada')} />
        <Kpi label="Praticadas" value={`${resumo.pctPraticadas}%`} hint={`${resumo.praticadas} em labs concluídos`}
          active={filtro === 'praticada'} onClick={() => setFiltro(filtro === 'praticada' ? null : 'praticada')} />
        <Kpi label="Detectadas" value={`${resumo.pctDetectadas}%`} hint={`${resumo.detectadas} com regra testada`}
          active={filtro === 'detectada'} onClick={() => setFiltro(filtro === 'detectada' ? null : 'detectada')} />
        <Kpi label="Vistas no Radar" value={resumo.observadas} hint="últimos 30 dias"
          active={filtro === 'observada'} onClick={() => setFiltro(filtro === 'observada' ? null : 'observada')} />
      </div>

      {resumo.lacunas.length > 0 && (
        <StatusStrip tone="warn" icon="pi-exclamation-triangle">
          <strong>Lacunas de detecção:</strong> técnicas praticadas ou vistas no Radar que você ainda não detecta.{' '}
          {resumo.lacunas.map((t) => (
            <button key={t.id} type="button" className="attack-link" onClick={() => setSel(t)}>{t.id}</button>
          ))}
        </StatusStrip>
      )}

      <div className="iv-row iv-wrap iv-mt" aria-label="Legenda">
        {CAMADAS.map((c) => (
          <span key={c.id} className="attack-legend"><span className="attack-dot" style={{ background: c.cor }} />{c.label}</span>
        ))}
        {filtro && <Chip label="Limpar filtro" icon="pi-times" onClick={() => setFiltro(null)} />}
      </div>

      <div className="attack-grid iv-mt">
        {TATICAS.map((tatica) => {
          const tecnicas = cobertura.filter((t) => t.tatica === tatica.id);
          return (
            <section key={tatica.id} className="iv-card attack-col">
              <h3 className="attack-col__title">{tatica.nome}</h3>
              <span className="iv-muted attack-col__id">{tatica.id}</span>
              <div className="iv-col">
                {tecnicas.map((t) => {
                  const apagada = filtro && !temCamada(t, filtro);
                  return (
                    <button key={t.id} type="button" className="attack-cell" data-score={pontuacao(t)}
                      data-dim={apagada || undefined} onClick={() => setSel(t)}
                      aria-label={`${t.id} ${t.nome}: ${CAMADAS.filter((c) => temCamada(t, c.id)).map((c) => c.label).join(', ') || 'sem cobertura'}`}>
                      <span className="attack-cell__id">{t.id}</span>
                      <span className="attack-cell__nome">{t.nome}</span>
                      <span className="attack-cell__dots" aria-hidden="true">
                        {CAMADAS.map((c) => (
                          <span key={c.id} className="attack-dot" style={{ background: temCamada(t, c.id) ? c.cor : 'transparent', borderColor: c.cor }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 480 }}>
        {sel && <TecnicaDetalhe tecnica={sel} onChange={() => atualizar(sel.id)} />}
      </Sidebar>
    </div>
  );
}

function TecnicaDetalhe({ tecnica, onChange }: { tecnica: CoberturaTecnica; onChange: () => void }) {
  const [regra, setRegra] = useState(tecnica.detectada?.regra ?? '');
  return (
    <DetailLayout>
      <DetailHeader title={`${tecnica.id} · ${tecnica.nome}`}>
        <Pill label={TATICAS.find((x) => x.id === tecnica.tatica)?.nome ?? tecnica.tatica} />
      </DetailHeader>
      <p><a href={`https://attack.mitre.org/techniques/${tecnica.id}/`} target="_blank" rel="noreferrer noopener">
        Ficha oficial no MITRE ATT&CK <i className="pi pi-external-link" aria-hidden="true" /></a></p>

      <div className="iv-row iv-wrap">
        {CAMADAS.map((c) => <Pill key={c.id} label={`${c.label}: ${temCamada(tecnica, c.id) ? 'sim' : 'não'}`} color={temCamada(tecnica, c.id) ? c.cor : undefined} />)}
      </div>
      {tecnica.observada > 0 && <p className="iv-muted">{tecnica.observada} eventos no Radar nos últimos 30 dias.</p>}

      <DetailSection title="Tópicos que cobrem">
        {tecnica.topicos.length === 0 && <p className="iv-muted">Nenhum tópico mapeado ainda.</p>}
        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
          {tecnica.topicos.map((id) => {
            const t = getTopico(id);
            return t ? <li key={id}><Link to="/trilhas/$trilhaId" params={{ trilhaId: t.trilhaId }}>{t.titulo}</Link></li> : null;
          })}
        </ul>
      </DetailSection>

      <DetailSection title="Labs que praticam">
        {tecnica.labs.length === 0 && <p className="iv-muted">Nenhum lab mapeado ainda. Anote a técnica no campo MITRE de um lab.</p>}
        <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
          {tecnica.labs.map((id) => <li key={id}><Link to="/labs">{getLab(id)?.titulo ?? id}</Link></li>)}
        </ul>
      </DetailSection>

      <DetailSection title="Detecção">
        <p className="iv-muted" style={{ marginTop: 0 }}>
          Marque só depois de testar: execute a técnica num lab isolado e confirme que o alerta disparou.
        </p>
        <DetailSection title="Exercícios Red × Blue registrados">
          {tecnica.exercicios.length === 0
            ? <p className="iv-muted">Nenhuma execução registrada para esta técnica.</p>
            : <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{tecnica.exercicios.map((e) => (
              <li key={e.id}><Link to="/labs">{getLab(e.labId)?.titulo ?? e.title}</Link>{' · '}{e.status.replaceAll('_', ' ')}{' · '}
                Detecção: {e.detection === 'detectado' ? 'detectado' : e.detection === 'parcial' ? 'parcial' : e.detection === 'nao_detectado' ? 'não detectado' : 'não testado'}</li>
            ))}</ul>}
        </DetailSection>
        <label className="iv-col">Regra ou consulta que detecta
          <InputText value={regra} maxLength={300} onChange={(e) => setRegra(e.target.value)} placeholder="Ex.: Wazuh rule 100210 (tarefa agendada nova)" />
        </label>
        {tecnica.detectada && <p className="iv-muted">{tecnica.detectada.automatico ? 'Confirmada pelo registro Red x Blue' : 'Confirmacao manual'} em {tecnica.detectada.testadoEm}.</p>}
        <div className="iv-row iv-wrap iv-mt">
          <Button label={tecnica.detectada?.automatico ? 'Confirmar manualmente' : tecnica.detectada ? 'Atualizar teste' : 'Marcar como detectada'} icon="pi pi-check"
            onClick={() => { marcarDeteccao(tecnica.id, regra); onChange(); }} />
          {tecnica.detectada && !tecnica.detectada.automatico && <Button label="Remover" icon="pi pi-trash" severity="secondary" outlined
            onClick={() => { removerDeteccao(tecnica.id); setRegra(''); onChange(); }} />}
        </div>
      </DetailSection>
    </DetailLayout>
  );
}
