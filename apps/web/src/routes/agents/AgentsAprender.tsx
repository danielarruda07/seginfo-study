import { Link } from '@tanstack/react-router';
import { MODULO_ESTUDO_ATIVO } from '@/config/modulos';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClickCard } from '@/components/ui/ClickCard';
import { Bar, Kpi, StatusStrip } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { progressoPorTrilha } from '@/services/catalog';
import { progressTone } from '@/theme/status';
import { GLOSSARIO, PILARES, RECURSOS_AGENTES, type Pilar } from '@/data/agentesPilares';
import { PilarFicha } from './ficha/PilarFicha';
import '@/styles/telas/agents.css';
import { GuiaDaTela } from './guia/GuiaDaTela';

const idPilar = (p: Pilar) => String(p.numero);

export function AgentsAprender() {
  const p = progressoPorTrilha()['agentes'];
  const sel = useDrawerSelection(PILARES, idPilar);

  return (
    <div>
      <PageHeader
        title="Aprender sobre agentes"
        subtitle="Os 8 pilares para construir um agente que entrega resultado. Clique num pilar para ver o que checar e como os seus agentes estão nele."
        actions={MODULO_ESTUDO_ATIVO ? <Link to="/trilhas/$trilhaId" params={{ trilhaId: 'agentes' }} className="ag-btn"><i className="pi pi-book" aria-hidden="true" /> Abrir a trilha</Link> : undefined}
      />
      <GuiaDaTela tela="aprender" />

      <StatusStrip tone="ok" icon="pi-lightbulb">
        Autonomia precisa de limites, rastreabilidade e supervisão humana nas decisões críticas. Um agente útil resolve um problema real, com consistência.
      </StatusStrip>

      {p && (
        <div className="iv-kpis iv-mt">
          <Kpi label="Tópicos concluídos" icon="pi-check" value={`${p.concluidos}/${p.total}`} hint="na trilha Agentes de IA" />
          <div className="iv-kpi ag-kpi-barra">
            <span className="iv-kpi__label"><i className="pi pi-chart-line" aria-hidden="true" />Progresso</span>
            <span className="iv-kpi__value">{p.pct}%</span>
            <Bar pct={p.pct} tone={progressTone(p.pct)} />
          </div>
        </div>
      )}

      <h2 className="iv-section-label iv-mt">Os 8 pilares</h2>
      <div className="ag-cards">
        {PILARES.map((pi) => (
          <ClickCard key={pi.numero} onOpen={() => sel.open(idPilar(pi))} label={`Abrir o pilar ${pi.numero}: ${pi.titulo}`} selected={sel.isOpen(idPilar(pi))}>
            <div className="ag-cardx__topo">
              <span className="ag-rotulo">Pilar {pi.numero}</span>
              <i className={`pi ${pi.icone} ag-cardx__icone`} aria-hidden="true" />
            </div>
            <h3 className="ag-cardx__titulo">{pi.titulo}</h3>
            <p className="ag-cardx__texto">{pi.pergunta}</p>
            <p className="ag-cardx__texto ag-cardx__pe"><span>{pi.checklist.length} itens para checar · aba "{pi.aba}"</span></p>
          </ClickCard>
        ))}
      </div>

      <div className="iv-card iv-mt ag-bloco">
        <h3>Glossário</h3>
        <dl className="ag-glossario">
          {GLOSSARIO.map((g) => (
            <div key={g.termo}>
              <dt>{g.termo}</dt>
              <dd>{g.definicao}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="iv-card iv-mt ag-bloco">
        <h3>Para ler</h3>
        <ul>
          {RECURSOS_AGENTES.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noreferrer">{r.titulo}<span className="agd-sr"> (abre em nova aba)</span></a>
              <span className="ag-dica"> · {r.nota}</span>
            </li>
          ))}
        </ul>
      </div>

      {sel.item && <PilarFicha p={sel.item} nav={sel.nav} />}
    </div>
  );
}
