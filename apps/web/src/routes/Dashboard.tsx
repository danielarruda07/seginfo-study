import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Kpi, StatusStrip, Bar, Pill } from '@/components/InfraKit';
import { Message } from 'primereact/message';
import { resumoGeral, progressoPorTrilha, listTrilhas } from '@/services/catalog';
import { totalMinutos, listMetas } from '@/services/sessoes';
import { getLastReadError } from '@/services/store';
import { progressTone } from '@/theme/status';

export function Dashboard() {
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

      <div className="iv-card iv-mt">
        <h3 style={{ marginTop: 0 }}>Progresso por trilha</h3>
        <div className="iv-col iv-gap">
          {trilhas.map((t) => {
            const p = porTrilha[t.id];
            return (
              <div key={t.id} className="iv-row" style={{ gap: '1rem' }}>
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
