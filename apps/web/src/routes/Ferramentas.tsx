import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { InputText } from 'primereact/inputtext';
import { Sidebar } from 'primereact/sidebar';
import type { FaseFerramenta, FerramentaCatalogo } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { DetailLayout, DetailHeader, DetailSection } from '@/components/ui/Detail';
import { Chip, Pill, StatusStrip } from '@/components/InfraKit';
import { DOMINIO_LAB, FASE_FERRAMENTA_LABEL, FASES_FERRAMENTA_ORDEM } from '@/theme/status';
import { listFerramentas } from '@/services/ferramentas';
import { getTopico } from '@/services/catalog';

type Dominio = FerramentaCatalogo['dominio'];
const DOMINIOS: Dominio[] = ['blue', 'red', 'purple', 'infra'];

function DominioPill({ dominio }: { dominio: Dominio }) {
  return <Pill label={DOMINIO_LAB[dominio].label} color={DOMINIO_LAB[dominio].color} />;
}

export function Ferramentas() {
  const { data } = useQuery({ queryKey: ['ferramentas'], queryFn: listFerramentas });
  const [fase, setFase] = useState<FaseFerramenta | undefined>();
  const [dominio, setDominio] = useState<Dominio | undefined>();
  const [soKali, setSoKali] = useState(false);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<FerramentaCatalogo | null>(null);

  const ferramentas = (data ?? []).filter((f) =>
    (!fase || f.fase === fase) &&
    (!dominio || f.dominio === dominio) &&
    (!soKali || f.kali) &&
    (!search || `${f.nome} ${f.descricao}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())),
  );

  return (
    <div>
      <PageHeader
        title="Arsenal de Ferramentas"
        subtitle="Referência rápida das ferramentas de segurança por fase do workflow — do reconhecimento à defesa."
      />
      <StatusStrip tone="ok" icon="pi-wrench">
        {ferramentas.length} ferramentas. Kali Linux não é uma categoria própria aqui: ele é a distribuição que já
        empacota a maior parte delas — use o filtro &quot;Só Kali&quot; para ver quais já estão prontas na sua VM atacante do Range.
      </StatusStrip>

      <div className="iv-row iv-wrap iv-mt">
        <Chip label="Todas as fases" active={!fase} onClick={() => setFase(undefined)} />
        {FASES_FERRAMENTA_ORDEM.map((f) => (
          <Chip key={f} label={FASE_FERRAMENTA_LABEL[f]} active={fase === f} onClick={() => setFase(f)} />
        ))}
      </div>
      <div className="iv-row iv-wrap iv-mt">
        <Chip label="Todos os domínios" active={!dominio} onClick={() => setDominio(undefined)} />
        {DOMINIOS.map((d) => (
          <Chip key={d} label={DOMINIO_LAB[d].label} active={dominio === d} onClick={() => setDominio(d)} />
        ))}
        <Chip label="Só Kali" icon="pi-desktop" active={soKali} onClick={() => setSoKali((v) => !v)} />
      </div>
      <div className="iv-row iv-wrap iv-mt">
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ferramenta…" aria-label="Buscar ferramentas" />
      </div>

      <div className="grid-cards iv-mt">
        {ferramentas.map((f) => (
          <div key={f.id} className="iv-card trilha-card lab-card" role="button" tabIndex={0}
            onClick={() => setSel(f)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(f); } }}>
            <div className="iv-row" style={{ justifyContent: 'space-between' }}>
              <DominioPill dominio={f.dominio} />
              {f.kali && <Pill label="Kali" icon="pi-desktop" />}
            </div>
            <h3 style={{ margin: '.6rem 0 .25rem', color: 'var(--alvoar-navy)' }}>{f.nome}</h3>
            <p className="iv-muted" style={{ margin: 0, fontSize: '.88rem' }}>{f.descricao}</p>
            <div className="iv-row iv-wrap iv-mt"><Pill label={FASE_FERRAMENTA_LABEL[f.fase]} /></div>
          </div>
        ))}
      </div>

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 480 }}>
        {sel && <FerramentaDetalhe ferramenta={sel} />}
      </Sidebar>
    </div>
  );
}

function FerramentaDetalhe({ ferramenta }: { ferramenta: FerramentaCatalogo }) {
  const topico = ferramenta.topicoId ? getTopico(ferramenta.topicoId) : undefined;
  return (
    <DetailLayout>
      <DetailHeader title={ferramenta.nome}>
        <DominioPill dominio={ferramenta.dominio} />
        <Pill label={FASE_FERRAMENTA_LABEL[ferramenta.fase]} />
        {ferramenta.kali && <Pill label="Vem no Kali Linux" icon="pi-desktop" />}
      </DetailHeader>
      <p>{ferramenta.descricao}</p>
      {ferramenta.url && (
        <p><a href={ferramenta.url} target="_blank" rel="noopener noreferrer">{ferramenta.url} <i className="pi pi-external-link" aria-hidden="true" /></a></p>
      )}

      {topico && (
        <DetailSection title="Tópico de estudo relacionado">
          <Link to="/trilhas/$trilhaId" params={{ trilhaId: topico.trilhaId }}>{topico.titulo}</Link>
        </DetailSection>
      )}
    </DetailLayout>
  );
}
