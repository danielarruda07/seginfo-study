import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Bar, Kpi, Pill, StatusStrip } from '@/components/InfraKit';
import { progressoPorTrilha } from '@/services/catalog';
import { progressTone } from '@/theme/status';
import { GLOSSARIO, PILARES, RECURSOS_AGENTES } from '@/data/agentesPilares';

export function AgentsAprender() {
  const p = progressoPorTrilha()['agentes'];

  return (
    <div>
      <PageHeader
        title="Aprender sobre agentes"
        subtitle="Os 8 pilares para construir um agente que entrega resultado, com o que checar em cada um e os erros mais comuns."
        actions={<Link to="/trilhas/$trilhaId" params={{ trilhaId: 'agentes' }}>Abrir a trilha de estudo</Link>}
      />

      <StatusStrip tone="ok" icon="pi-lightbulb">
        Na prática, autonomia precisa de limites, rastreabilidade e supervisão humana nas decisões críticas. Um agente útil resolve um problema real, com consistência.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Pilares" value={PILARES.length} />
        <Kpi label="Tópicos concluídos" value={p ? `${p.concluidos}/${p.total}` : '—'} hint="na trilha Agentes de IA" />
        <Kpi label="Progresso" value={p ? `${p.pct}%` : '—'} />
      </div>
      {p && <div className="iv-mt"><Bar pct={p.pct} tone={progressTone(p.pct)} /></div>}

      <div className="grid-cards iv-mt">
        {PILARES.map((pi) => (
          <div key={pi.numero} className="iv-card">
            <div className="iv-row" style={{ justifyContent: 'space-between' }}>
              <Pill label={`Pilar ${pi.numero}`} color="#7c3aed" />
              <i className={`pi ${pi.icone}`} aria-hidden="true" style={{ color: 'var(--alvoar-teal-600)', fontSize: '1.3rem' }} />
            </div>
            <h3 style={{ margin: '.6rem 0 .25rem', color: 'var(--alvoar-navy)' }}>{pi.titulo}</h3>
            <p style={{ margin: '0 0 .6rem', fontSize: '.9rem', fontWeight: 600 }}>{pi.pergunta}</p>
            <ul style={{ margin: '0 0 .6rem', paddingLeft: '1.1rem', fontSize: '.86rem' }}>
              {pi.checklist.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <p className="iv-muted" style={{ margin: 0, fontSize: '.82rem' }}><strong>Erro comum:</strong> {pi.erroComum}</p>
            <p className="iv-muted" style={{ margin: '.5rem 0 0', fontSize: '.8rem' }}>Preenchido na aba "{pi.aba}" do editor.</p>
          </div>
        ))}
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .6rem' }}>Glossário</h4>
        <dl style={{ margin: 0 }}>
          {GLOSSARIO.map((g) => (
            <div key={g.termo} style={{ marginBottom: '.5rem' }}>
              <dt style={{ fontWeight: 700 }}>{g.termo}</dt>
              <dd style={{ margin: 0 }} className="iv-muted">{g.definicao}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .6rem' }}>Para ler</h4>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {RECURSOS_AGENTES.map((r) => (
            <li key={r.url} style={{ marginBottom: '.35rem' }}>
              <a href={r.url} target="_blank" rel="noreferrer">{r.titulo}</a>
              <span className="iv-muted"> · {r.nota}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
