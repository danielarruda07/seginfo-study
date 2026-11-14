import { useMemo } from 'react';
import { Bar as ChartBar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

/** Cor primária lida do token (guia: gráficos usam a cor primária, nunca hex fixo). */
function useCorPrimaria() {
  return useMemo(() => getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || 'currentColor', []);
}

const opcoes = (horizontal: boolean, onClick?: (i: number) => void) => ({
  indexAxis: horizontal ? ('y' as const) : ('x' as const),
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: { parsed: { x: number | null; y: number | null } }) => ` ${(horizontal ? c.parsed.x : c.parsed.y) ?? 0} h` } } },
  scales: horizontal ? { x: { beginAtZero: true }, y: { grid: { display: false } } } : { y: { beginAtZero: true }, x: { grid: { display: false } } },
  onClick: onClick ? (_e: unknown, els: { index: number }[]) => { if (els[0]) onClick(els[0].index); } : undefined,
  onHover: onClick ? (e: { native?: Event | null }, els: unknown[]) => { const t = e.native?.target as HTMLElement | undefined; if (t) t.style.cursor = els.length ? 'pointer' : 'default'; } : undefined,
});

export function GraficoSemanas({ semanas }: { semanas: { label: string; horas: number }[] }) {
  const cor = useCorPrimaria();
  const total = semanas.reduce((a, s) => a + s.horas, 0);
  return (
    <section className="iv-card es-chart">
      <h2 className="iv-section-label">Horas por semana</h2>
      <p className="es-hint">Últimas {semanas.length} semanas, de domingo a sábado</p>
      {total === 0 ? <p className="es-empty-line">Nenhuma sessão nas últimas semanas. Registre o que estudar para ver seu ritmo aqui.</p> : (
        <div className="es-chart__box" role="img" aria-label={`Horas por semana: ${semanas.map((s) => `${s.label}, ${s.horas} h`).join('; ')}`}>
          <ChartBar data={{ labels: semanas.map((s) => s.label), datasets: [{ label: 'Horas', data: semanas.map((s) => s.horas), backgroundColor: cor, borderRadius: 4, maxBarThickness: 26 }] }} options={opcoes(false)} />
        </div>
      )}
    </section>
  );
}

export function GraficoTrilhas({ dados, onOpen }: { dados: { id: string; label: string; horas: number }[]; onOpen: (id: string) => void }) {
  const cor = useCorPrimaria();
  return (
    <section className="iv-card es-chart">
      <h2 className="iv-section-label">Horas por trilha</h2>
      <p className="es-hint">Tempo registrado · clique numa barra para abrir a trilha</p>
      {dados.length === 0 ? <p className="es-empty-line">Associe sessões a trilhas para ver a distribuição.</p> : (
        <div className="es-chart__box" style={{ height: Math.max(140, dados.length * 34) }} role="img" aria-label={`Horas por trilha: ${dados.map((d) => `${d.label}, ${d.horas} h`).join('; ')}`}>
          <ChartBar data={{ labels: dados.map((d) => d.label), datasets: [{ label: 'Horas', data: dados.map((d) => d.horas), backgroundColor: cor, borderRadius: 4, maxBarThickness: 26 }] }}
            options={opcoes(true, (i) => onOpen(dados[i].id))} />
        </div>
      )}
    </section>
  );
}
