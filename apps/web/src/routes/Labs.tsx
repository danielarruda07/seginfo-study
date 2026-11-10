import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from 'primereact/sidebar';
import { Dropdown } from 'primereact/dropdown';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { DetailHeader, DetailLayout, DetailSection } from '@/components/ui/Detail';
import { listLabs, getAtivo, getProgressoLab, saveProgressoLab, ESTADO_LAB_LABEL, type EstadoLab, type ProgressoLab } from '@/services/inventario';
import { DOMINIO_LAB } from '@/theme/status';
import type { Lab } from '@seginfo/shared';
import { getTopico } from '@/services/catalog';
import { addPost, listPosts } from '@/services/sessoes';
import { useInvalidate } from '@/hooks/useInvalidate';

type Dominio = Lab['dominio'];
const FILTROS: Dominio[] = ['blue', 'red', 'purple'];
const STATUS_OPTS = Object.entries(ESTADO_LAB_LABEL).map(([value, label]) => ({ value, label }));

function DominioPill({ dominio }: { dominio: Dominio }) {
  return <Pill label={DOMINIO_LAB[dominio].label} color={DOMINIO_LAB[dominio].color} />;
}

export function Labs() {
  const { data } = useQuery({ queryKey: ['labs'], queryFn: listLabs });
  const [dominio, setDominio] = useState<Dominio | undefined>();
  const [status, setStatus] = useState<EstadoLab | undefined>();
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<Lab | null>(null);
  const [progresso, setProgresso] = useState<Record<string, ProgressoLab>>(() =>
    Object.fromEntries(listLabs().map((lab) => [lab.id, getProgressoLab(lab.id)])),
  );

  const labs = (data ?? []).filter((l) => (!dominio || l.dominio === dominio) && (!status || progresso[l.id]?.status === status) && (!search || `${l.titulo} ${l.objetivo}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  const invalidate = useInvalidate();

  function salvar(labId: string, novo: ProgressoLab) {
    saveProgressoLab(labId, novo);
    setProgresso((atual) => ({ ...atual, [labId]: getProgressoLab(labId) }));
  }

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

      <div className="iv-row iv-wrap iv-mt">
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lab…" aria-label="Buscar labs" />
        <Dropdown value={status} options={STATUS_OPTS} onChange={(e) => setStatus(e.value)}
          placeholder="Todos os status" showClear style={{ minWidth: 210 }} />
      </div>

      <div className="grid-cards iv-mt">
        {labs.map((l) => (
          <div key={l.id} className="iv-card trilha-card lab-card" role="button" tabIndex={0}
            onClick={() => setSel(l)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(l); } }}>
            <div className="iv-row" style={{ justifyContent: 'space-between' }}>
              <DominioPill dominio={l.dominio} />
              <div className="iv-row iv-wrap"><Pill label={l.nivel} /><Pill label={ESTADO_LAB_LABEL[progresso[l.id]?.status ?? 'nao_iniciado']} /></div>
            </div>
            <h3 style={{ margin: '.6rem 0 .25rem', color: 'var(--alvoar-navy)' }}>{l.titulo}</h3>
            <p className="iv-muted" style={{ margin: 0, fontSize: '.88rem' }}>{l.objetivo}</p>
          </div>
        ))}
      </div>

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 520 }}>
        {sel && <LabDetalhe lab={sel} progresso={progresso[sel.id] ?? getProgressoLab(sel.id)} onSave={(p) => salvar(sel.id, p)} onDraft={() => {
          const postTitle = `Lab: ${sel.titulo}`;
          if (!listPosts().some((p) => p.titulo === postTitle)) {
            addPost({ titulo: postTitle, gancho: `Pratiquei: ${sel.titulo}`, corpo: `Objetivo: ${sel.objetivo}\n\nO que fiz:\n${sel.passos.map((x) => `• ${x}`).join('\n')}\n\nResultado esperado: ${sel.resultadoEsperado}\n\nAprendizados: ${getProgressoLab(sel.id).aprendizado || '[Adicione seus aprendizados antes de publicar.]'}`, topicoId: sel.topicoId, publicado: false });
          }
          invalidate('posts');
        }} />}
      </Sidebar>
    </div>
  );
}

function LabDetalhe({ lab, progresso, onSave, onDraft }: { lab: Lab; progresso: ProgressoLab; onSave: (p: ProgressoLab) => void; onDraft: () => void }) {
  const mitreText = progresso.mitre.join(', ');
  return (
    <DetailLayout>
      <DetailHeader title={lab.titulo}>
        <DominioPill dominio={lab.dominio} />
        <Pill label={lab.nivel} />
      </DetailHeader>
      <p><strong>Objetivo:</strong> {lab.objetivo}</p>
      {lab.topicoId && getTopico(lab.topicoId) && <p>Tópico relacionado: <Link to="/trilhas/$trilhaId" params={{ trilhaId: getTopico(lab.topicoId)!.trilhaId }}>{getTopico(lab.topicoId)!.titulo}</Link></p>}

      <DetailSection title="Seu progresso">
        <label className="iv-col">Status
          <Dropdown value={progresso.status} options={STATUS_OPTS} onChange={(e) => onSave({ ...progresso, status: e.value as EstadoLab })} />
        </label>
        {progresso.concluidoEm && <p className="iv-muted">Concluído em {progresso.concluidoEm}</p>}
        <label className="iv-col iv-mt">O que você aprendeu
          <InputTextarea value={progresso.aprendizado} rows={4} autoResize
            onChange={(e) => onSave({ ...progresso, aprendizado: e.target.value })}
            placeholder="Anote resultados e próximos passos, sem incluir credenciais ou dados sensíveis." />
        </label>
        <label className="iv-col iv-mt">Evidência não sensível (nota ou caminho local)
          <InputText value={progresso.evidencia} onChange={(e) => onSave({ ...progresso, evidencia: e.target.value })}
            placeholder="Ex.: relatório local lab-01.md — não cole segredos ou dados corporativos" />
        </label>
        <label className="iv-col iv-mt">Técnicas MITRE ATT&CK (separadas por vírgula)
          <InputTextarea value={mitreText} rows={2} autoResize
            onChange={(e) => onSave({ ...progresso, mitre: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
            placeholder="Ex.: T1110, T1046" />
        </label>
      </DetailSection>

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
      {progresso.status === 'concluido' && <Button className="iv-mt" label="Criar rascunho para LinkedIn" icon="pi pi-linkedin" onClick={onDraft} />}
    </DetailLayout>
  );
}
