/** Linha do tempo de eventos em barras verticais (CSS puro, sem Chart.js para poucos pontos). */
export function Timeline({ pontos, porHora }: { pontos: { bucket: string; total: number }[]; porHora: boolean }) {
  const max = Math.max(1, ...pontos.map((t) => t.total));
  const pico = pontos.reduce<{ bucket: string; total: number } | null>((m, p) => (!m || p.total > m.total ? p : m), null);
  const fmt = (b: string) => (porHora ? `${b.slice(0, 10)} ${b.slice(11, 13)}h` : b);
  return (
    <section className="iv-card in-timeline-card" aria-labelledby="radar-tl">
      <h3 id="radar-tl" className="iv-section-label">Linha do tempo ({porHora ? 'por hora' : 'por dia'}, UTC)</h3>
      {pontos.length === 0
        ? <p className="in-muted-p">Sem eventos no período.</p>
        : <>
          <div className="in-timeline" role="img"
            aria-label={`${pontos.length} intervalos; pico de ${pico?.total} eventos em ${pico ? fmt(pico.bucket) : ''}.`}>
            {pontos.map((t) => (
              <span key={t.bucket} className="in-timeline__bar" title={`${fmt(t.bucket)}: ${t.total}`}
                style={{ ['--h' as string]: `${Math.max(4, (t.total / max) * 100)}%` }} />
            ))}
          </div>
          <div className="in-timeline__eixo"><span>{fmt(pontos[0].bucket)}</span>{pico && <span>pico: {pico.total} em {fmt(pico.bucket)}</span>}<span>{fmt(pontos[pontos.length - 1].bucket)}</span></div>
        </>}
    </section>
  );
}
