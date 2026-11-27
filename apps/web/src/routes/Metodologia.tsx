import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { Chip, Kpi, Pill, StatusStrip } from '@/components/InfraKit';
import { FASES_PENTEST, NATUREZA_FASE, type FasePentest } from '@/data/metodologiaPentest';
import { getFerramenta } from '@/services/ferramentas';
import { getTecnica } from '@/data/attack';
import { TATICAS } from '@/data/attack';
import { ComoUsar } from '@/components/ComoUsar';

const TATICA_NOME = new Map(TATICAS.map((t) => [t.id, t.nome]));

function FaseCard({ fase }: { fase: FasePentest }) {
  const nat = NATUREZA_FASE[fase.natureza];
  return (
    <section className="iv-card iv-mt" id={`fase-${fase.id}`} aria-labelledby={`fase-${fase.id}-t`}>
      <div className="iv-row iv-wrap" style={{ alignItems: 'center', gap: '0.5rem' }}>
        <span className="iv-pill" aria-hidden="true"><i className={`pi ${fase.icone}`} /> Fase {fase.ordem}</span>
        <h2 id={`fase-${fase.id}-t`} className="iv-section-label" style={{ margin: 0 }}>{fase.nome}</h2>
        <Pill tone={nat.tone} label={nat.label} />
      </div>
      <p style={{ marginTop: '0.5rem' }}><strong>{fase.objetivo}</strong></p>
      <p className="iv-muted">{fase.resumo}</p>

      {fase.taticasMitre.length > 0 && (
        <p className="iv-muted" style={{ marginTop: 0 }}>
          Táticas ATT&CK: {fase.taticasMitre.map((id) => `${TATICA_NOME.get(id) ?? id} (${id})`).join(' · ')}
        </p>
      )}

      <div className="iv-row iv-wrap" style={{ gap: '1.5rem', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 220px' }}>
          <h3 className="iv-section-label">Entradas</h3>
          <ul>{fase.entradas.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <h3 className="iv-section-label">Saídas</h3>
          <ul>{fase.saidas.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      </div>

      <h3 className="iv-section-label">Técnicas</h3>
      <ul>
        {fase.tecnicas.map((t) => {
          const mitre = t.mitreId ? getTecnica(t.mitreId) : undefined;
          return (
            <li key={t.nome} style={{ marginBottom: '0.35rem' }}>
              {t.mitreId && <span className="mono" title={mitre?.nome ?? 'Técnica ATT&CK'}>{t.mitreId} </span>}
              <strong>{t.nome}</strong> — <span className="iv-muted">{t.detalhe}</span>
            </li>
          );
        })}
      </ul>

      {fase.ferramentaIds.length > 0 ? (
        <>
          <h3 className="iv-section-label">Ferramentas</h3>
          <div className="iv-row iv-wrap">
            {fase.ferramentaIds.map((id) => {
              const f = getFerramenta(id);
              return <Pill key={id} icon="pi-wrench" label={f?.nome ?? id} />;
            })}
          </div>
          <p className="iv-muted" style={{ marginTop: '0.35rem' }}>
            <Link to="/ferramentas">Abrir o Arsenal de Ferramentas para ver cada uma e anotar o que testou</Link>
          </p>
        </>
      ) : (
        <>
          <h3 className="iv-section-label">Ferramentas</h3>
          <p className="iv-muted">Fase de documento/processo — sem ferramenta ofensiva. {fase.id === 'relatorio' && (
            <>Monte a entrega em <Link to="/laudos">Laudos</Link> e <Link to="/artefatos">Biblioteca de artefatos</Link>.</>
          )}</p>
        </>
      )}

      <h3 className="iv-section-label">Checklist</h3>
      <ul>{fase.checklist.map((c) => <li key={c}>{c}</li>)}</ul>

      <StatusStrip tone="warn" icon="pi-exclamation-triangle">
        <strong>Cuidados:</strong>
        <ul style={{ margin: '0.35rem 0 0' }}>{fase.cuidados.map((c) => <li key={c}>{c}</li>)}</ul>
      </StatusStrip>
    </section>
  );
}

export function Metodologia() {
  const [faseId, setFaseId] = useState<string | null>(null);

  const ferramentasUnicas = useMemo(
    () => new Set(FASES_PENTEST.flatMap((f) => f.ferramentaIds)).size, []);
  const tecnicasMitre = useMemo(
    () => new Set(FASES_PENTEST.flatMap((f) => f.tecnicas.map((t) => t.mitreId).filter(Boolean))).size, []);

  const visiveis = faseId ? FASES_PENTEST.filter((f) => f.id === faseId) : FASES_PENTEST;

  return (
    <div>
      <PageHeader
        title="Metodologia de Pentest"
        subtitle="O ciclo de um teste de intrusão autorizado, fase a fase, amarrando técnicas (MITRE ATT&CK) e ferramentas do arsenal. Baseado em PTES e OWASP WSTG."
      />

      <StatusStrip tone="crit" icon="pi-shield">
        <strong>Regra de ouro:</strong> só se testa o que está no escopo autorizado por escrito, na janela acordada, de
        forma não destrutiva, reversível e auditável. A Fase 1 (autorização) é o portão — nada toca o alvo antes dela.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Fases do ciclo" icon="pi-sitemap" value={FASES_PENTEST.length} hint="do pré-engajamento ao reteste" />
        <Kpi label="Ferramentas mapeadas" icon="pi-wrench" value={ferramentasUnicas} hint="ligadas ao Arsenal" />
        <Kpi label="Técnicas ATT&CK" icon="pi-table" value={tecnicasMitre} hint="cruzam com a Matriz" />
        <Kpi label="Natureza" icon="pi-exclamation-triangle" value={'Passivo → Intrusivo'} hint="risco cresce por fase" />
      </div>

      <div className="iv-toolbar iv-mt" role="tablist" aria-label="Ir para uma fase">
        <Chip label="Todas as fases" active={faseId === null} onClick={() => setFaseId(null)} icon="pi-list" />
        {FASES_PENTEST.map((f) => (
          <Chip key={f.id} label={`${f.ordem}. ${f.nome}`} icon={f.icone}
            active={faseId === f.id} onClick={() => setFaseId(f.id)} />
        ))}
      </div>

      {visiveis.map((f) => <FaseCard key={f.id} fase={f} />)}

      <p className="iv-muted iv-mt">
        Referências: <a href="http://www.pentest-standard.org" target="_blank" rel="noreferrer">PTES</a>,{' '}
        <a href="https://owasp.org/www-project-web-security-testing-guide/" target="_blank" rel="noreferrer">OWASP WSTG</a>,{' '}
        <Link to="/attack">Matriz ATT&CK</Link>. O conteúdo é genérico e educativo; o trabalho real segue o contrato e a RoE de cada cliente.
      </p>
      <ComoUsar rota="/metodologia" />
    </div>
  );
}
