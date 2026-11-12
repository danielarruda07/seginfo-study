import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, type ChartOptions } from 'chart.js';
import type { TipoAtivo } from '@seginfo/shared';
import { TIPO_ATIVO_LABEL } from '@/theme/status';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

/** Lê um token do tema (Chart.js não entende var()). */
const cssVar = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** Versão esmaecida de uma cor hex (#rrggbb); outros formatos voltam como estão. */
const esmaecer = (cor: string) => (/^#[0-9a-f]{6}$/i.test(cor) ? `${cor}40` : cor);

interface Props {
  dados: { tipo: TipoAtivo; total: number; nomes: string[] }[];
  ativo?: TipoAtivo;
  onSelect: (tipo: TipoAtivo) => void;
}

/** "Ativos por tipo": barra única navy, um eixo, sem legenda; clique filtra a lista. */
export function TipoChart({ dados, ativo, onSelect }: Props) {
  const navy = cssVar('--primary-color', '#0d0c55');
  const sec = cssVar('--text-color-secondary', '#475569');
  const grade = cssVar('--surface-border', '#e2e8f0');
  const descricao = dados.map((d) => `${TIPO_ATIVO_LABEL[d.tipo]}: ${d.total}`).join(', ');

  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (c) => `${c.parsed.x} ativo(s)`,
          afterLabel: (c) => {
            const nomes = dados[c.dataIndex].nomes;
            return nomes.slice(0, 5).join('\n') + (nomes.length > 5 ? `\n+${nomes.length - 5}` : '');
          },
        },
      },
    },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0, color: sec, font: { size: 11 } }, grid: { color: grade } },
      y: { ticks: { color: sec, font: { size: 11 } }, grid: { display: false } },
    },
    onClick: (_e, els) => { if (els[0]) onSelect(dados[els[0].index].tipo); },
    onHover: (e, els) => { const t = e.native?.target as HTMLElement | undefined; if (t) t.style.cursor = els.length ? 'pointer' : 'default'; },
  };

  return (
    <div className="iv-card" style={{ margin: 0 }}>
      <div className="iv-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="iv-section-label" style={{ margin: 0 }}>Ativos por tipo</h2>
        <small className="iv-muted" style={{ fontSize: '.75rem' }}>clique na barra para filtrar</small>
      </div>
      {dados.length < 2 ? (
        <p className="iv-muted" style={{ fontSize: '.875rem' }}>Ainda sem dados suficientes para comparar tipos.</p>
      ) : (
        <div role="img" aria-label={`Ativos por tipo: ${descricao}`} style={{ height: Math.max(140, dados.length * 26 + 30), marginTop: '.5rem' }}>
          <Bar options={options} data={{
            labels: dados.map((d) => TIPO_ATIVO_LABEL[d.tipo]),
            datasets: [{
              data: dados.map((d) => d.total),
              backgroundColor: dados.map((d) => (!ativo || ativo === d.tipo ? navy : esmaecer(navy))),
              borderRadius: 4, maxBarThickness: 26,
            }],
          }} />
        </div>
      )}
    </div>
  );
}
