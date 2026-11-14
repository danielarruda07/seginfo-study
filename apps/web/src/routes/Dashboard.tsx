import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { InputNumber } from 'primereact/inputnumber';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClickCard } from '@/components/ui/ClickCard';
import { Kpi, Bar, Pill } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { resumoGeral, progressoPorTrilha, listTrilhas, listTopicos, getRevisoes } from '@/services/catalog';
import { listMetas, listSessoes } from '@/services/sessoes';
import { getLastReadError, read, write, todayISO } from '@/services/store';
import { progressTone } from '@/theme/status';
import { TopicoDrawer } from './estudo/TopicoDrawer';
import { TrilhaDrawer } from './estudo/TrilhaDrawer';
import { MetaDrawer } from './estudo/MetaDrawer';
import { SemanaDrawer } from './estudo/SemanaDrawer';
import { GraficoSemanas, GraficoTrilhas } from './estudo/PainelGraficos';
import { contarMetas, estadoMeta, formatarData, horasPorSemana, listarMetas, MOTIVO_PROXIMO, proximoTopico, resumoSessoes, sessoesDaSemana } from './estudo/regras';
import '@/styles/telas/estudo.css';

/** Domínios do Security+ SY0-701 e o peso de cada um na prova (objetivos oficiais da CompTIA). */
const CERT = [['cert-sy0701-1', 12], ['cert-sy0701-2', 22], ['cert-sy0701-3', 18], ['cert-sy0701-4', 28], ['cert-sy0701-5', 20]] as const;
const PESO: Record<string, number> = Object.fromEntries(CERT);

function lerPainel() {
  const hoje = todayISO();
  const topicos = listTopicos({ rows: 10_000 }).items;
  const sessoes = listSessoes();
  const metas = listMetas();
  const trilhas = listTrilhas();
  return {
    hoje, trilhas, sessoes, metas,
    resumo: resumoGeral(),
    porTrilha: progressoPorTrilha(),
    proximo: proximoTopico(topicos, getRevisoes(), hoje),
    cert: CERT.map(([id]) => topicos.find((t) => t.id === id)).filter((t) => !!t),
    horasPorTrilha: trilhas.map((t) => ({ id: t.id, label: t.titulo, horas: Math.round(sessoes.filter((s) => s.trilhaId === t.id).reduce((a, s) => a + s.minutos, 0) / 6) / 10 })).filter((x) => x.horas > 0),
  };
}

export function Dashboard() {
  const [metaSemanal, setMetaSemanal] = useState(() => read('study:weekly-target', 0));
  const data = useQuery({ queryKey: ['dashboard'], queryFn: lerPainel, initialData: lerPainel }).data;
  const { resumo, porTrilha, trilhas, sessoes, metas, proximo, cert, hoje } = data;

  const metasAbertas = useMemo(() => listarMetas(metas, hoje, 'abertas'), [metas, hoje]);
  const proxLista = useMemo(() => (proximo ? [proximo.topico] : []), [proximo]);
  const selTrilha = useDrawerSelection(trilhas);
  const selCert = useDrawerSelection(cert);
  const selMeta = useDrawerSelection(metasAbertas);
  const selProx = useDrawerSelection(proxLista);
  const [semanaAberta, setSemanaAberta] = useState(false);
  const fecharTudo = () => { selTrilha.close(); selCert.close(); selMeta.close(); selProx.close(); setSemanaAberta(false); };
  const abrir = (fn: () => void) => () => { fecharTudo(); fn(); };

  const readError = getLastReadError();
  const semana = resumoSessoes(sessoesDaSemana(sessoes, hoje));
  const totalHoras = (resumoSessoes(sessoes).minutos / 60).toFixed(1);
  const cm = contarMetas(metas, hoje);
  const proximaMeta = metasAbertas[0];
  const certCobertura = cert.reduce((a, t) => a + (t.status === 'concluido' ? PESO[t.id] : 0), 0);

  return (
    <div>
      <PageHeader title="Painel de Estudos" subtitle="Daniel Arruda · Migração de carreira: Infraestrutura → Segurança da Informação" />

      {readError && (
        <Message severity="warn" className="es-mb" text={`Aviso: dados corrompidos na chave "${readError.key}" foram ignorados. Considere restaurar um backup no Cofre.`} />
      )}

      <div className="iv-kpis">
        <Kpi label="Progresso geral" icon="pi-chart-line" value={`${resumo.pct}%`} hint={`${resumo.concluidos} de ${resumo.total} tópicos`} />
        <Kpi label="Estudando agora" icon="pi-play-circle" value={resumo.estudando} hint="tópicos em andamento" />
        <Kpi label="Horas estudadas" icon="pi-clock" value={totalHoras} hint={`${sessoes.length} sessões registradas`} />
        <Kpi label="Metas abertas" icon="pi-flag" value={cm.abertas} tone={cm.atrasadas ? 'danger' : undefined} hint={cm.atrasadas ? `${cm.atrasadas} atrasada(s)` : `${cm.concluidas} concluída(s)`} />
      </div>

      <div className="es-next iv-mt">
        {proximo ? (
          <ClickCard className="es-next__main" onOpen={abrir(() => selProx.open(proximo.topico.id))} selected={selProx.isOpen(proximo.topico.id)}
            tone={proximo.motivo === 'revisao' ? 'warning' : undefined} label={`Abrir ficha do tópico ${proximo.topico.titulo}`}>
            <span className="es-eyebrow">{MOTIVO_PROXIMO[proximo.motivo]}</span>
            <h2 className="es-next__title">{proximo.topico.titulo}</h2>
            <p className="es-hint">{proximo.topico.resumo}</p>
            <span className="es-cardcta">Ver detalhes, revisão e histórico <i className="pi pi-arrow-right" aria-hidden="true" /></span>
          </ClickCard>
        ) : (
          <section className="iv-card es-next__main">
            <span className="es-eyebrow">Tudo em dia</span>
            <h2 className="es-next__title">Você concluiu todos os tópicos cadastrados</h2>
            <Link className="es-cardlink" to="/trilhas">Ver trilhas <i className="pi pi-arrow-right" aria-hidden="true" /></Link>
          </section>
        )}

        <ClickCard className="es-week" onOpen={abrir(() => setSemanaAberta(true))} selected={semanaAberta} label="Abrir ficha dos últimos 7 dias">
          <span className="es-eyebrow">Últimos 7 dias</span>
          <strong className="es-week__value tabular">{semana.dias}<span>/7 dias</span></strong>
          <p className="es-hint">{semana.quantidade ? `${formatarMinutos1(semana.minutos)} registradas` : 'Sem sessões na semana; retome quando fizer sentido.'}</p>
          <label className="es-week__target" htmlFor="meta-semanal">Meta semanal
            <InputNumber inputId="meta-semanal" value={metaSemanal} min={0} max={80} suffix=" h" size={4}
              onValueChange={(e) => { const v = e.value ?? 0; setMetaSemanal(v); write('study:weekly-target', v); }} />
          </label>
          {metaSemanal > 0 && <Bar pct={(semana.minutos / 60 / metaSemanal) * 100} tone={semana.minutos / 60 >= metaSemanal ? 'ok' : undefined} />}
        </ClickCard>
      </div>

      {proximaMeta && (() => {
        const e = estadoMeta(proximaMeta, hoje);
        return (
          <ClickCard className="es-goal iv-mt" onOpen={abrir(() => selMeta.open(proximaMeta.id))} selected={selMeta.isOpen(proximaMeta.id)}
            tone={e.tone === 'danger' || e.tone === 'warning' ? e.tone : undefined} label={`Abrir ficha da meta ${proximaMeta.titulo}`}>
            <div>
              <span className="es-eyebrow">Próxima meta</span>
              <h2 className="es-goal__title">{proximaMeta.titulo}</h2>
              <p className="es-hint tabular">Prazo {formatarData(proximaMeta.prazo)} · {e.texto}</p>
            </div>
            <Pill label={e.label} tone={e.tone} icon={e.icon} />
            <Link className="es-cardlink" to="/metas">Todas as metas <i className="pi pi-arrow-right" aria-hidden="true" /></Link>
          </ClickCard>
        );
      })()}

      <div className="es-charts iv-mt">
        <GraficoSemanas semanas={horasPorSemana(sessoes, hoje)} />
        <GraficoTrilhas dados={data.horasPorTrilha} onOpen={(id) => { fecharTudo(); selTrilha.open(id); }} />
      </div>

      <section className="iv-card iv-mt">
        <div className="es-sechead">
          <div>
            <h2 className="iv-section-label">Progresso por trilha</h2>
            <p className="es-hint">Clique numa trilha para ver próximo passo, metas e sessões.</p>
          </div>
          <Link className="es-cardlink" to="/trilhas">Todas as trilhas <i className="pi pi-arrow-right" aria-hidden="true" /></Link>
        </div>
        <ul className="es-rows">
          {trilhas.map((t) => {
            const p = porTrilha[t.id];
            return (
              <ClickCard key={t.id} as="li" className="es-rowcard" onOpen={abrir(() => selTrilha.open(t.id))} selected={selTrilha.isOpen(t.id)} label={`Abrir ficha da trilha ${t.titulo}`}>
                <span className="es-rowcard__name"><i className={`pi ${t.icone}`} aria-hidden="true" />{t.titulo}</span>
                <span className="es-rowcard__bar"><Bar pct={p.pct} tone={progressTone(p.pct)} /></span>
                <span className="es-rowcard__num tabular">{p.concluidos}/{p.total} · {p.pct}%</span>
              </ClickCard>
            );
          })}
        </ul>
      </section>

      {cert.length > 0 && (
        <section className="iv-card iv-mt">
          <div className="es-sechead">
            <div>
              <h2 className="iv-section-label">Security+ SY0-701 · cobertura de estudo</h2>
              <p className="es-hint">{certCobertura}% do peso dos domínios marcados como concluídos. Indicador de estudo, não previsão de aprovação.</p>
            </div>
            <a className="es-cardlink" href="https://assets.ctfassets.net/82ripq7fjls2/6TYWUym0Nudqa8nGEnegjG/0f9b974d3b1837fe85ab8e6553f4d623/CompTIA-Security-Plus-SY0-701-Exam-Objectives.pdf" target="_blank" rel="noreferrer">
              Objetivos oficiais <i className="pi pi-external-link" aria-hidden="true" />
            </a>
          </div>
          <ul className="es-rows">
            {cert.map((t) => {
              const feito = t.status === 'concluido';
              return (
                <ClickCard key={t.id} as="li" className="es-rowcard" onOpen={abrir(() => selCert.open(t.id))} selected={selCert.isOpen(t.id)} label={`Abrir ficha do domínio ${t.titulo}`}>
                  <span className="es-rowcard__name">{t.titulo.replace('Security+ SY0-701 — ', '')}</span>
                  <span className="es-rowcard__bar"><Bar pct={feito ? 100 : 0} tone={feito ? 'ok' : undefined} /></span>
                  <span className="es-rowcard__num">{t.status === 'estudando' && <Pill label="Estudando" tone="info" />}<Pill label={`peso ${PESO[t.id]}%`} /></span>
                </ClickCard>
              );
            })}
          </ul>
        </section>
      )}

      {selProx.item && <TopicoDrawer topico={selProx.item} nav={selProx.nav} />}
      {selCert.item && <TopicoDrawer topico={selCert.item} nav={selCert.nav} />}
      {selTrilha.item && <TrilhaDrawer trilha={selTrilha.item} nav={selTrilha.nav} />}
      {selMeta.item && <MetaDrawer meta={selMeta.item} nav={selMeta.nav} />}
      {semanaAberta && <SemanaDrawer metaHoras={metaSemanal} onClose={() => setSemanaAberta(false)} />}
    </div>
  );
}

/** 135 → "2,3 h"; abaixo de 1 h mostra minutos. */
function formatarMinutos1(min: number): string {
  return min < 60 ? `${min} min` : `${(min / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
}
