import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from 'primereact/sidebar';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { DetailHeader, DetailLayout, DetailSection } from '@/components/ui/Detail';
import { listLabs, getAtivo } from '@/services/inventario';
import { DOMINIO_LAB } from '@/theme/status';
import type { Lab } from '@seginfo/shared';

type Dominio = Lab['dominio'];
const FILTROS: Dominio[] = ['blue', 'red', 'purple'];

function DominioPill({ dominio }: { dominio: Dominio }) {
  return <Pill label={DOMINIO_LAB[dominio].label} color={DOMINIO_LAB[dominio].color} />;
}

export function Labs() {
  const { data } = useQuery({ queryKey: ['labs'], queryFn: listLabs });
  const [dominio, setDominio] = useState<Dominio | undefined>();
  const [sel, setSel] = useState<Lab | null>(null);

  const labs = (data ?? []).filter((l) => !dominio || l.dominio === dominio);

  return (
    <div>
      <PageHeader title="Labs Práticos" subtitle="Exercícios de Blue e Red Team amarrados aos ativos reais do seu homelab." />
      <StatusStrip tone="ok" icon="pi-desktop">
        {labs.length} labs. Cada um referencia equipamentos que você realmente tem — pratique e documente para o LinkedIn.
      </StatusStrip>

      <div className="iv-row iv-wrap iv-mt">
        <Chip label="Todos" active={!dominio} onClick={() => setDominio(undefined)} />
        {FILTROS.map((d) => (
          <Chip key={d} label={DOMINIO_LAB[d].label} active={dominio === d} onClick={() => setDominio(d)} />
        ))}
      </div>

      <div className="grid-cards iv-mt">
        {labs.map((l) => (
          <div key={l.id} className="iv-card trilha-card" onClick={() => setSel(l)}>
            <div className="iv-row" style={{ justifyContent: 'space-between' }}>
              <DominioPill dominio={l.dominio} />
              <Pill label={l.nivel} />
            </div>
            <h3 style={{ margin: '.6rem 0 .25rem', color: 'var(--alvoar-navy)' }}>{l.titulo}</h3>
            <p className="iv-muted" style={{ margin: 0, fontSize: '.88rem' }}>{l.objetivo}</p>
          </div>
        ))}
      </div>

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 520 }}>
        {sel && <LabDetalhe lab={sel} />}
      </Sidebar>
    </div>
  );
}

function LabDetalhe({ lab }: { lab: Lab }) {
  return (
    <DetailLayout>
      <DetailHeader title={lab.titulo}>
        <DominioPill dominio={lab.dominio} />
        <Pill label={lab.nivel} />
      </DetailHeader>
      <p><strong>Objetivo:</strong> {lab.objetivo}</p>

      <DetailSection title="Ativos-alvo (do seu ambiente)">
        <div className="iv-row iv-wrap">
          {lab.ativosAlvo.map((id) => {
            const a = getAtivo(id);
            return <Pill key={id} label={a ? `${a.nome} (${a.endereco})` : id} />;
          })}
        </div>
      </DetailSection>

      <DetailSection title="Passos">
        <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
          {lab.passos.map((p, i) => <li key={i} style={{ marginBottom: '.35rem' }}>{p}</li>)}
        </ol>
      </DetailSection>

      <StatusStrip tone="ok" icon="pi-flag-fill"><strong>Resultado esperado:</strong> {lab.resultadoEsperado}</StatusStrip>
    </DetailLayout>
  );
}
