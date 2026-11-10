import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { InputNumber } from 'primereact/inputnumber';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Kpi, StatusStrip, Bar, Pill } from '@/components/InfraKit';
import { Message } from 'primereact/message';
import { resumoGeral, progressoPorTrilha, listTrilhas, listTopicos, getRevisoes } from '@/services/catalog';
import { totalMinutos, listMetas, listSessoes } from '@/services/sessoes';
import { getLastReadError, read, write, registerSchema, todayISO } from '@/services/store';
import { z } from 'zod';
import { progressTone } from '@/theme/status';
import { Bar as ChartBar, Line as ChartLine } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);
registerSchema('study:weekly-target', { safeParse: (v) => z.number().int().min(0).max(80).safeParse(v) });

export function Dashboard() {
  const [metaSemanal, setMetaSemanal] = useState(() => read('study:weekly-target', 0));
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => ({
      resumo: resumoGeral(),
      porTrilha: progressoPorTrilha(),
      trilhas: listTrilhas(),
      minutos: totalMinutos(),
      metas: listMetas(),
    }),
  });

  if (!data) return null;
  const { resumo, porTrilha, trilhas, minutos, metas } = data;
  const horas = (minutos / 60).toFixed(1);
  const metasAbertas = metas.filter((m) => !m.concluida).length;
  const tone = progressTone(resumo.pct);
  const readError = getLastReadError();
  const sessoes = listSessoes();
  const hojeISO = todayISO();
  const topicos = listTopicos({ rows: 500 }).items;
  const revisoes = getRevisoes();
  const revisaoPendente = topicos.find((t) => { const due = revisoes[t.id]?.revisarEm; return due && due <= hojeISO; });
  const proximoTopico = revisaoPendente ?? topicos.find((t) => t.status !== 'concluido');
  const desde = new Date();
  desde.setDate(desde.getDate() - 6);
  const sessoesSemana = sessoes.filter((s) => { const d = new Date(`${s.data}T00:00:00`); return d.getTime() >= new Date(desde.toDateString()).getTime() && s.data <= hojeISO; });
  const diasAtivos = new Set(sessoesSemana.map((s) => s.data)).size;
  const horasSemana = sessoesSemana.reduce((sum, s) => sum + s.minutos, 0) / 60;
  const semanas = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - start.getDay() - (7 - i) * 7);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    const mins = sessoes.filter((s) => { const d = new Date(`${s.data}T00:00:00`); return d >= start && d < end; }).reduce((sum, s) => sum + s.minutos, 0);
    return { label: start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), horas: Math.round(mins / 6) / 10 };
  });
  const horasPorTrilha = trilhas.map((t) => ({ label: t.titulo, horas: Math.round(sessoes.filter((s) => s.trilhaId === t.id).reduce((sum, s) => sum + s.minutos, 0) / 6) / 10 })).filter((x) => x.horas > 0);
  const proximaMeta = metas.find((m) => !m.concluida);
  const pesos = [12, 22, 18, 28, 20];
  const certIds = ['cert-sy0701-1', 'cert-sy0701-2', 'cert-sy0701-3', 'cert-sy0701-4', 'cert-sy0701-5'];
  const certTopics = listTopicos({ trilhaId: 'certs', rows: 100 }).items;
  const certCoverage = Math.round(certIds.reduce((sum, id, i) => sum + (certTopics.find((t) => t.id === id)?.status === 'concluido' ? pesos[i] : 0), 0));

  return (
    <div>
      <PageHeader
        title="Painel de Estudos"
        subtitle="Daniel Arruda · Migração de carreira: Infraestrutura → Segurança da Informação"
      />

      {readError && (
        <Message
          severity="warn"
          style={{ width: '100%', marginBottom: '1rem' }}
          text={`Aviso: dados corrompidos na chave "${readError.key}" foram ignorados. Considere restaurar um backup no Cofre.`}
        />
      )}

      <StatusStrip tone={tone} icon="pi-chart-line">
        Progresso geral: <strong>{resumo.pct}%</strong> — {resumo.concluidos} de {resumo.total} tópicos concluídos,
        {' '}{resumo.estudando} em andamento.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Progresso geral" value={`${resumo.pct}%`} hint={`${resumo.concluidos}/${resumo.total} tópicos`} />
        <Kpi label="Em andamento" value={resumo.estudando} hint="tópicos estudando" />
        <Kpi label="Horas estudadas" value={horas} hint="total registrado" />
        <Kpi label="Metas abertas" value={metasAbertas} hint={`${metas.length} no total`} />
      </div>

      <div className="dashboard-next iv-mt">
        <section className="iv-card dashboard-next__primary">
          <span className="dashboard-eyebrow">{revisaoPendente ? 'REVISÃO RECOMENDADA' : 'PRÓXIMO PASSO'}</span>
          <h2>{proximoTopico ? proximoTopico.titulo : 'Você concluiu todos os tópicos cadastrados'}</h2>
          <p className="iv-muted">{proximoTopico ? 'Continue de onde sua trilha precisa avançar.' : 'Você pode revisar anotações ou adicionar novos tópicos.'}</p>
          {proximoTopico
            ? <Link className="dashboard-action" to="/trilhas/$trilhaId" params={{ trilhaId: proximoTopico.trilhaId }}>{revisaoPendente ? 'Abrir tópico para revisar' : 'Abrir próximo tópico'} <i className="pi pi-arrow-right" aria-hidden="true" /></Link>
            : <Link className="dashboard-action" to="/trilhas">Ver trilhas <i className="pi pi-arrow-right" aria-hidden="true" /></Link>}
        </section>
        <section className="iv-card dashboard-next__secondary">
          <span className="dashboard-eyebrow">ESTA SEMANA</span>
          <strong className="dashboard-week-value">{diasAtivos}<span>/7</span></strong>
          <p className="iv-muted">dias com estudo registrado · {diasAtivos ? 'bom registro do seu ritmo' : 'sem sessões nos últimos 7 dias; retome quando fizer sentido'}</p>
          <label className="weekly-target">Meta semanal (horas)<InputNumber value={metaSemanal} min={0} max={80} suffix=" h" onValueChange={(e) => { const value = e.value ?? 0; setMetaSemanal(value); write('study:weekly-target', value); }} /></label>
          {metaSemanal > 0 && <p className="iv-muted">{horasSemana.toFixed(1)} / {metaSemanal} h nesta semana</p>}
          <Link className="dashboard-action" to="/sessoes">Registrar sessão <i className="pi pi-arrow-right" aria-hidden="true" /></Link>
        </section>
      </div>

      <div className="dashboard-charts iv-mt">
        <section className="iv-card"><h3 style={{ marginTop: 0 }}>Horas por semana</h3><p className="iv-muted">Últimas 8 semanas</p>
          <ChartLine data={{ labels: semanas.map((x) => x.label), datasets: [{ label: 'Horas', data: semanas.map((x) => x.horas), borderColor: '#0f766e', backgroundColor: 'rgba(15,118,110,.12)', fill: true, tension: .3 }] }} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
        </section>
        <section className="iv-card"><h3 style={{ marginTop: 0 }}>Horas por trilha</h3><p className="iv-muted">Distribuição do tempo registrado</p>
          {horasPorTrilha.length ? <ChartBar data={{ labels: horasPorTrilha.map((x) => x.label), datasets: [{ label: 'Horas', data: horasPorTrilha.map((x) => x.horas), backgroundColor: '#0f766e' }] }} options={{ indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }} /> : <p className="iv-muted">Associe sessões a trilhas para ver a distribuição.</p>}
        </section>
      </div>
      {proximaMeta && <section className="iv-card iv-mt dashboard-goal"><div><span className="dashboard-eyebrow">PRÓXIMA META</span><h3>{proximaMeta.titulo}</h3><p className="iv-muted">Prazo: {proximaMeta.prazo}</p></div><Link className="dashboard-action" to="/metas">Abrir metas <i className="pi pi-arrow-right" aria-hidden="true"/></Link></section>}

      <section className="iv-card iv-mt">
        <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}><div><h3 style={{ margin: 0 }}>Security+ SY0-701 — cobertura de estudo</h3><p className="iv-muted">{certCoverage}% do peso dos domínios marcados como concluídos. Indicador de estudo, não previsão de aprovação.</p></div><Link className="dashboard-action" to="/trilhas/$trilhaId" params={{ trilhaId: 'certs' }}>Abrir trilha <i className="pi pi-arrow-right" aria-hidden="true"/></Link></div>
        <div className="iv-col iv-gap iv-mt">{certIds.map((id, i) => { const topic = certTopics.find((t) => t.id === id); const done = topic?.status === 'concluido'; return <div key={id} className="iv-row dashboard-trail"><span style={{ minWidth: 300 }}>{topic?.titulo.replace('Security+ SY0-701 — ', '')}</span><div style={{ flex: 1 }}><Bar pct={done ? 100 : 0} tone={done ? 'ok' : undefined} /></div><Pill label={`${pesos[i]}%`} /></div>; })}</div>
        <a className="iv-muted" href="https://assets.ctfassets.net/82ripq7fjls2/6TYWUym0Nudqa8nGEnegjG/0f9b974d3b1837fe85ab8e6553f4d623/CompTIA-Security-Plus-SY0-701-Exam-Objectives.pdf" target="_blank" rel="noreferrer">Ver objetivos oficiais da CompTIA ↗</a>
      </section>

      <div className="iv-card iv-mt">
        <h3 style={{ marginTop: 0 }}>Progresso por trilha</h3>
        <div className="iv-col iv-gap">
          {trilhas.map((t) => {
            const p = porTrilha[t.id];
            return (
              <div key={t.id} className="iv-row dashboard-trail" style={{ gap: '1rem' }}>
                <Link to="/trilhas/$trilhaId" params={{ trilhaId: t.id }} style={{ minWidth: 220, fontWeight: 600 }}>
                  <i className={`pi ${t.icone}`} style={{ marginRight: 6 }} />
                  {t.titulo}
                </Link>
                <div style={{ flex: 1 }}>
                  <Bar pct={p.pct} tone={progressTone(p.pct)} />
                </div>
                <Pill label={`${p.concluidos}/${p.total}`} />
                <span className="iv-muted" style={{ minWidth: 44, textAlign: 'right' }}>{p.pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
