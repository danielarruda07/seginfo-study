import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Sidebar } from 'primereact/sidebar';
import type { FaseFerramenta, FerramentaCatalogo } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { DetailLayout, DetailHeader, DetailSection } from '@/components/ui/Detail';
import { Chip, Pill, StatusStrip } from '@/components/InfraKit';
import { DOMINIO_LAB, FASE_FERRAMENTA_LABEL, FASES_FERRAMENTA_ORDEM } from '@/theme/status';
import { addExperiencia, listExperiencias, listFerramentas, removeExperiencia, todayISO, type ExperienciaFerramenta } from '@/services/ferramentas';
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
  const [revision, setRevision] = useState(0);

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
            {(() => { const entries = listExperiencias(f.id); const pending = entries.filter((e) => e.tipo === 'pendencia').length; return entries.length > 0 && <div className="tool-card-notes"><i className="pi pi-book" /> {entries.length} registro{entries.length !== 1 ? 's' : ''}{pending > 0 && <span className="tool-pending-count">{pending} pendência{pending !== 1 ? 's' : ''}</span>}</div>; })()}
          </div>
        ))}
      </div>

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 520 }}>
        {sel && <FerramentaDetalhe key={`${sel.id}-${revision}`} ferramenta={sel} onChanged={() => setRevision((v) => v + 1)} />}
      </Sidebar>
    </div>
  );
}

const TIPO_EXPERIENCIA = [
  { label: 'Teste realizado', value: 'teste' }, { label: 'Observação', value: 'observacao' }, { label: 'Pendência', value: 'pendencia' },
];
const RESULTADOS = [
  { label: 'Funcionou como esperado', value: 'positivo' }, { label: 'Resultado parcial', value: 'parcial' },
  { label: 'Não funcionou', value: 'negativo' }, { label: 'Não se aplica', value: 'nao_aplicavel' },
];
const RESULTADO_LABEL: Record<ExperienciaFerramenta['resultado'], string> = {
  positivo: 'Funcionou como esperado', parcial: 'Resultado parcial', negativo: 'Não funcionou', nao_aplicavel: 'Não se aplica',
};

function FerramentaDetalhe({ ferramenta, onChanged }: { ferramenta: FerramentaCatalogo; onChanged: () => void }) {
  const topico = ferramenta.topicoId ? getTopico(ferramenta.topicoId) : undefined;
  const [tipo, setTipo] = useState<ExperienciaFerramenta['tipo']>('teste');
  const [data, setData] = useState(todayISO());
  const [titulo, setTitulo] = useState('');
  const [ambiente, setAmbiente] = useState('');
  const [resultado, setResultado] = useState<ExperienciaFerramenta['resultado']>('positivo');
  const [relato, setRelato] = useState('');
  const [proximoPasso, setProximoPasso] = useState('');
  const [error, setError] = useState('');
  const registros = listExperiencias(ferramenta.id);

  function salvarExperiencia() {
    if (!titulo.trim() || !relato.trim()) { setError('Preencha o título e o relato para salvar.'); return; }
    addExperiencia({ ferramentaId: ferramenta.id, tipo, data, titulo: titulo.trim(), ambiente: ambiente.trim(), resultado, relato: relato.trim(), proximoPasso: proximoPasso.trim() });
    setTitulo(''); setAmbiente(''); setRelato(''); setProximoPasso(''); setError(''); setData(todayISO());
    onChanged();
  }

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

      <DetailSection title="Sua experiência e anotações">
        <p className="iv-muted">Registre testes feitos em ambientes autorizados, observações verificáveis e próximos passos. Evite incluir credenciais ou dados sensíveis.</p>
        <div className="tool-entry-form">
          <label>Tipo do registro<Dropdown value={tipo} options={TIPO_EXPERIENCIA} onChange={(e) => setTipo(e.value)} /></label>
          <div className="tool-entry-form__row">
            <label>Data<InputText type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
            <label>Ambiente (opcional)<InputText value={ambiente} onChange={(e) => setAmbiente(e.target.value)} placeholder="Ex.: Kali em VM local" /></label>
          </div>
          <label>Título<InputText value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Primeira varredura no laboratório" /></label>
          {tipo === 'teste' && <label>Resultado<Dropdown value={resultado} options={RESULTADOS} onChange={(e) => setResultado(e.value)} /></label>}
          <label>Relato / observação<InputTextarea value={relato} maxLength={5000} rows={4} autoResize onChange={(e) => setRelato(e.target.value)} placeholder="O que você testou, observou e qual evidência sustenta a conclusão?" /></label>
          <label>Próximo passo ou pendência (opcional)<InputTextarea value={proximoPasso} maxLength={2000} rows={2} autoResize onChange={(e) => setProximoPasso(e.target.value)} placeholder="O que falta validar ou fazer depois?" /></label>
          {error && <small className="p-error" role="alert">{error}</small>}
          <Button label="Salvar registro" icon="pi pi-save" onClick={salvarExperiencia} />
        </div>
      </DetailSection>

      <DetailSection title={`Histórico (${registros.length})`}>
        {registros.length === 0 ? <p className="iv-muted">Nenhum registro ainda. Suas anotações aparecerão aqui e no card da ferramenta.</p> : (
          <div className="tool-entry-list">
            {registros.map((entry) => (
              <article className="tool-entry" key={entry.id}>
                <div className="tool-entry__top"><div><span className={`tool-entry__kind tool-entry__kind--${entry.tipo}`}>{TIPO_EXPERIENCIA.find((x) => x.value === entry.tipo)?.label}</span><h4>{entry.titulo}</h4></div><Button icon="pi pi-trash" text rounded severity="danger" aria-label={`Excluir registro ${entry.titulo}`} onClick={() => { removeExperiencia(entry.id); onChanged(); }} /></div>
                <small>{new Date(`${entry.data}T12:00:00`).toLocaleDateString('pt-BR')}{entry.ambiente && ` · ${entry.ambiente}`}</small>
                {entry.tipo === 'teste' && <Pill label={RESULTADO_LABEL[entry.resultado]} />}
                <p>{entry.relato}</p>
                {entry.proximoPasso && <div className="tool-entry__next"><strong>Próximo passo / pendência</strong><p>{entry.proximoPasso}</p></div>}
              </article>
            ))}
          </div>
        )}
      </DetailSection>
    </DetailLayout>
  );
}
