import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Bar, Pill } from '@/components/InfraKit';
import { listTrilhas, progressoPorTrilha } from '@/services/catalog';
import { progressTone } from '@/theme/status';

export function Trilhas() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['trilhas'],
    queryFn: () => ({ trilhas: listTrilhas(), progresso: progressoPorTrilha() }),
  });
  if (!data) return null;

  return (
    <div>
      <PageHeader title="Trilhas de Estudo" subtitle="Áreas da Segurança da Informação, com foco em referências de mercado." />
      <div className="grid-cards">
        {data.trilhas.map((t) => {
          const p = data.progresso[t.id];
          return (
            <div
              key={t.id}
              className="iv-card trilha-card"
              onClick={() => navigate({ to: '/trilhas/$trilhaId', params: { trilhaId: t.id } })}
            >
              <div className="iv-row" style={{ justifyContent: 'space-between' }}>
                <i className={`pi ${t.icone} trilha-card__icon`} style={{ color: 'var(--alvoar-teal-600)' }} />
                <Pill label={`${p.concluidos}/${p.total}`} />
              </div>
              <h3 style={{ margin: '.6rem 0 .25rem', color: 'var(--alvoar-navy)' }}>{t.titulo}</h3>
              <p className="iv-muted" style={{ margin: '0 0 .75rem', fontSize: '.88rem' }}>{t.descricao}</p>
              <Bar pct={p.pct} tone={progressTone(p.pct)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
