import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from 'primereact/sidebar';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import type { ArsenalItem, TipoArsenal, DominioArsenal } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Kpi, StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { useDebounce } from '@/hooks/useDebounce';
import {
  listArsenal, resumoArsenal, saveArsenal, removeArsenal, toggleFavorito,
  addArtefato, removeArtefato,
} from '@/services/arsenal';

const TIPO_LABEL: Record<TipoArsenal, string> = { prompt: 'Prompt', skill: 'Skill', agente: 'Agente' };
const TIPO_COLOR: Record<TipoArsenal, string> = { prompt: '#0ea5e9', skill: '#7c3aed', agente: '#16a34a' };
const DOMINIO_OPTS: { label: string; value: DominioArsenal }[] = [
  { label: 'Red Team', value: 'red' }, { label: 'Blue Team', value: 'blue' }, { label: 'Purple Team', value: 'purple' },
  { label: 'AppSec', value: 'appsec' }, { label: 'OSINT', value: 'osint' }, { label: 'GRC', value: 'grc' }, { label: 'Geral', value: 'geral' },
];
const TIPO_OPTS: { label: string; value: TipoArsenal }[] = [
  { label: 'Prompt', value: 'prompt' }, { label: 'Skill', value: 'skill' }, { label: 'Agente', value: 'agente' },
];

type Draft = Partial<ArsenalItem> & { nome: string; tipo: TipoArsenal; _requisitos?: string; _tags?: string };

export function Arsenal() {
  const qc = useQueryClient();
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [tipo, setTipo] = useState<TipoArsenal | undefined>();
  const [dominio, setDominio] = useState<DominioArsenal | undefined>();
  const [sel, setSel] = useState<ArsenalItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const filtros = useMemo(() => ({ search, tipo, dominio }), [search, tipo, dominio]);
  const { data } = useQuery({ queryKey: ['arsenal', filtros], queryFn: () => listArsenal(filtros) });
  const resumo = useQuery({ queryKey: ['resumo-arsenal'], queryFn: resumoArsenal }).data;

  function refresh() {
    qc.invalidateQueries({ queryKey: ['arsenal'] });
    qc.invalidateQueries({ queryKey: ['resumo-arsenal'] });
  }
  function setTipoF(t?: TipoArsenal) { setTipo(t); }

  function novo(tipoInicial: TipoArsenal) {
    setDraft({ nome: '', tipo: tipoInicial, dominio: 'geral', resumo: '', conteudo: '', quandoUsar: '', _requisitos: '', _tags: '' });
  }
  function editar(item: ArsenalItem) {
    setDraft({ ...item, _requisitos: item.requisitos.join(', '), _tags: item.tags.join(', ') });
    setSel(null);
  }
  function salvar() {
    if (!draft?.nome.trim()) return;
    const { _requisitos, _tags, ...rest } = draft;
    saveArsenal({
      ...rest,
      requisitos: (_requisitos ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      tags: (_tags ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    });
    setDraft(null);
    refresh();
  }
  function excluir(id: string) { removeArsenal(id); setSel(null); refresh(); }
  function favoritar(id: string) { toggleFavorito(id); refresh(); if (sel?.id === id) setSel({ ...sel, favorito: !sel.favorito }); }

  const activeFilters = [
    tipo && { key: 't', label: `Tipo: ${TIPO_LABEL[tipo]}`, onRemove: () => setTipoF(undefined) },
    dominio && { key: 'd', label: `Domínio: ${dominio}`, onRemove: () => setDominio(undefined) },
    search && { key: 'q', label: `Busca: "${search}"`, onRemove: () => setSearchRaw('') },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  return (
    <div>
      <PageHeader
        title="Arsenal de IA"
        subtitle="Sua biblioteca de prompts, skills e agentes de segurança. Vá acumulando o que funciona."
        actions={
          <div className="iv-row iv-wrap">
            <Button label="Novo prompt" icon="pi pi-plus" size="small" onClick={() => novo('prompt')} />
            <Button label="Nova skill" icon="pi pi-plus" size="small" outlined onClick={() => novo('skill')} />
            <Button label="Novo agente" icon="pi pi-plus" size="small" outlined onClick={() => novo('agente')} />
          </div>
        }
      />

      <StatusStrip tone="ok" icon="pi-sparkles">
        {resumo?.total ?? 0} itens no arsenal — {resumo?.prompts ?? 0} prompts, {resumo?.skills ?? 0} skills, {resumo?.agentes ?? 0} agentes.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Prompts" value={resumo?.prompts ?? 0} active={tipo === 'prompt'} onClick={() => setTipoF(tipo === 'prompt' ? undefined : 'prompt')} />
        <Kpi label="Skills" value={resumo?.skills ?? 0} active={tipo === 'skill'} onClick={() => setTipoF(tipo === 'skill' ? undefined : 'skill')} />
        <Kpi label="Agentes" value={resumo?.agentes ?? 0} active={tipo === 'agente'} onClick={() => setTipoF(tipo === 'agente' ? undefined : 'agente')} />
        <Kpi label="Favoritos" value={resumo?.favoritos ?? 0} />
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText value={searchRaw} onChange={(e) => setSearchRaw(e.target.value)} placeholder="Buscar por nome, conteúdo, tag..." />
          </span>
          <span className="iv-muted" style={{ fontSize: '.8rem' }}>Domínio:</span>
          {(['red', 'blue', 'appsec', 'osint', 'grc'] as DominioArsenal[]).map((d) => (
            <Chip key={d} label={d} active={dominio === d} onClick={() => setDominio(dominio === d ? undefined : d)} />
          ))}
        </div>

        <ActiveFiltersBar filters={activeFilters} />

        {(data?.length ?? 0) === 0 && <p className="iv-muted">Nenhum item para os filtros. Adicione prompts, skills e agentes conforme for criando.</p>}

        <div className="grid-cards">
          {(data ?? []).map((item) => (
            <div key={item.id} className="iv-card trilha-card" onClick={() => setSel(item)}>
              <div className="iv-row" style={{ justifyContent: 'space-between' }}>
                <Pill label={TIPO_LABEL[item.tipo]} color={TIPO_COLOR[item.tipo]} />
                <i className={`pi ${item.favorito ? 'pi-star-fill' : 'pi-star'}`} style={{ color: item.favorito ? '#f59e0b' : 'var(--text-color-secondary)' }} onClick={(e) => { e.stopPropagation(); favoritar(item.id); }} />
              </div>
              <h3 style={{ margin: '.6rem 0 .25rem', color: 'var(--alvoar-navy)' }}>{item.nome}</h3>
              <p className="iv-muted" style={{ margin: 0, fontSize: '.85rem' }}>{item.resumo}</p>
              <div className="iv-row iv-wrap iv-mt">
                <Pill label={item.dominio} />
                {item.artefatos.length > 0 && <Pill label={`${item.artefatos.length} artefato(s)`} color="#64748b" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drawer de detalhe */}
      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 560 }}>
        {sel && <ArsenalDetalhe item={sel} onEdit={() => editar(sel)} onDelete={() => excluir(sel.id)} onFav={() => favoritar(sel.id)} onChanged={() => { refresh(); const upd = listArsenal().find((i) => i.id === sel.id); if (upd) setSel(upd); }} />}
      </Sidebar>

      {/* Drawer de edição */}
      <Sidebar visible={!!draft} position="right" onHide={() => setDraft(null)} style={{ width: 560 }}>
        {draft && <ArsenalEditor draft={draft} setDraft={setDraft} onSave={salvar} onCancel={() => setDraft(null)} />}
      </Sidebar>
    </div>
  );
}

function ArsenalDetalhe({ item, onEdit, onDelete, onFav, onChanged }: {
  item: ArsenalItem; onEdit: () => void; onDelete: () => void; onFav: () => void; onChanged: () => void;
}) {
  const [artTitulo, setArtTitulo] = useState('');
  const [artConteudo, setArtConteudo] = useState('');

  function salvarArtefato() {
    if (!artTitulo.trim()) return;
    const isHtml = artConteudo.trimStart().startsWith('<');
    addArtefato(item.id, { titulo: artTitulo, tipo: 'relatorio', formato: isHtml ? 'html' : 'md', conteudo: artConteudo });
    setArtTitulo(''); setArtConteudo('');
    onChanged();
  }

  return (
    <div className="iv-col" style={{ gap: '1rem' }}>
      <div>
        <div className="iv-row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, color: 'var(--alvoar-navy)' }}>{item.nome}</h2>
          <i className={`pi ${item.favorito ? 'pi-star-fill' : 'pi-star'}`} style={{ cursor: 'pointer', color: item.favorito ? '#f59e0b' : 'var(--text-color-secondary)' }} onClick={onFav} />
        </div>
        <div className="iv-row iv-wrap iv-mt">
          <Pill label={TIPO_LABEL[item.tipo]} color={TIPO_COLOR[item.tipo]} />
          <Pill label={item.dominio} />
          {item.slug && <Pill label={item.slug} color="#64748b" />}
        </div>
      </div>

      {item.resumo && <p>{item.resumo}</p>}

      {item.quandoUsar && (
        <StatusStrip tone="warn" icon="pi-info-circle"><strong>Quando usar:</strong> {item.quandoUsar}</StatusStrip>
      )}

      <div>
        <div className="iv-row" style={{ justifyContent: 'space-between' }}>
          <h4 style={{ margin: 0 }}>Conteúdo</h4>
          <Button icon="pi pi-copy" text size="small" label="Copiar" onClick={() => navigator.clipboard?.writeText(item.conteudo)} />
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#0d0c2b', color: '#e6e6f0', padding: '14px 16px', borderRadius: 10, fontSize: 13, lineHeight: 1.5, maxHeight: 320, overflow: 'auto' }}>{item.conteudo}</pre>
      </div>

      {item.requisitos.length > 0 && (
        <div>
          <h4 style={{ marginBottom: '.4rem' }}>Requisitos</h4>
          <div className="iv-row iv-wrap">{item.requisitos.map((r) => <Pill key={r} label={r} />)}</div>
        </div>
      )}

      {item.tags.length > 0 && (
        <div className="iv-row iv-wrap">{item.tags.map((t) => <Pill key={t} label={`#${t}`} color="#64748b" />)}</div>
      )}

      <div>
        <h4 style={{ marginBottom: '.4rem' }}>Artefatos gerados</h4>
        {item.artefatos.length === 0 && <p className="iv-muted" style={{ fontSize: '.85rem' }}>Nenhum artefato ainda. Anexe relatórios/saídas produzidos por este item.</p>}
        <div className="iv-col">
          {item.artefatos.map((a) => (
            <div key={a.id} className="iv-card" style={{ padding: '.6rem .8rem' }}>
              <div className="iv-row" style={{ justifyContent: 'space-between' }}>
                <strong>{a.titulo}</strong>
                <div className="iv-row">
                  <Pill label={a.formato} color="#64748b" />
                  {a.formato === 'html' && (
                    <Button icon="pi pi-external-link" text size="small" tooltip="Abrir em nova aba"
                      onClick={() => { const w = window.open(); if (w) { w.document.write(a.conteudo); w.document.close(); } }} />
                  )}
                  <Button icon="pi pi-copy" text size="small" onClick={() => navigator.clipboard?.writeText(a.conteudo)} />
                  <Button icon="pi pi-trash" text size="small" severity="danger" onClick={() => { removeArtefato(item.id, a.id); onChanged(); }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="iv-card iv-mt" style={{ padding: '.8rem' }}>
          <h5 style={{ margin: '0 0 .5rem' }}>Anexar artefato</h5>
          <div className="iv-col iv-gap">
            <InputText value={artTitulo} onChange={(e) => setArtTitulo(e.target.value)} placeholder="Título (ex: Relatório pentest gestao-ad)" />
            <InputTextarea value={artConteudo} onChange={(e) => setArtConteudo(e.target.value)} rows={4} placeholder="Cole o conteúdo (HTML, Markdown ou texto)..." />
            <Button label="Anexar" icon="pi pi-paperclip" size="small" onClick={salvarArtefato} />
          </div>
        </div>
      </div>

      <div className="iv-row" style={{ marginTop: '1rem' }}>
        <Button label="Editar" icon="pi pi-pencil" onClick={onEdit} />
        <Button label="Excluir" icon="pi pi-trash" severity="danger" outlined onClick={onDelete} />
      </div>
    </div>
  );
}

function ArsenalEditor({ draft, setDraft, onSave, onCancel }: {
  draft: Draft; setDraft: (d: Draft) => void; onSave: () => void; onCancel: () => void;
}) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  return (
    <div className="iv-col" style={{ gap: '.8rem' }}>
      <h2 style={{ margin: 0, color: 'var(--alvoar-navy)' }}>{draft.id ? 'Editar' : 'Novo'} item do arsenal</h2>
      {!draft.nome.trim() && <Message severity="info" text="Dê um nome para salvar." style={{ width: '100%' }} />}

      <label className="iv-muted" style={{ fontSize: '.8rem' }}>Tipo</label>
      <Dropdown value={draft.tipo} options={TIPO_OPTS} onChange={(e) => set({ tipo: e.value })} style={{ width: '100%' }} />

      <label className="iv-muted" style={{ fontSize: '.8rem' }}>Nome</label>
      <InputText value={draft.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex: pentest-api" />

      <label className="iv-muted" style={{ fontSize: '.8rem' }}>Domínio</label>
      <Dropdown value={draft.dominio} options={DOMINIO_OPTS} onChange={(e) => set({ dominio: e.value })} style={{ width: '100%' }} />

      <label className="iv-muted" style={{ fontSize: '.8rem' }}>Resumo</label>
      <InputTextarea value={draft.resumo ?? ''} onChange={(e) => set({ resumo: e.target.value })} rows={2} placeholder="O que esse item faz, em 1-2 linhas." />

      <label className="iv-muted" style={{ fontSize: '.8rem' }}>Conteúdo (o prompt / a skill / as instruções do agente)</label>
      <InputTextarea value={draft.conteudo ?? ''} onChange={(e) => set({ conteudo: e.target.value })} rows={8} placeholder="Cole aqui o texto completo." />

      <label className="iv-muted" style={{ fontSize: '.8rem' }}>Quando usar</label>
      <InputTextarea value={draft.quandoUsar ?? ''} onChange={(e) => set({ quandoUsar: e.target.value })} rows={2} placeholder="Contexto de aplicação." />

      <label className="iv-muted" style={{ fontSize: '.8rem' }}>Requisitos (separados por vírgula)</label>
      <InputText value={draft._requisitos ?? ''} onChange={(e) => set({ _requisitos: e.target.value })} placeholder="Docker, nmap, jwt..." />

      <label className="iv-muted" style={{ fontSize: '.8rem' }}>Tags (separadas por vírgula)</label>
      <InputText value={draft._tags ?? ''} onChange={(e) => set({ _tags: e.target.value })} placeholder="pentest, api, authz..." />

      <div className="iv-row iv-mt">
        <Button label="Salvar" icon="pi pi-save" onClick={onSave} />
        <Button label="Cancelar" text onClick={onCancel} />
      </div>
    </div>
  );
}
