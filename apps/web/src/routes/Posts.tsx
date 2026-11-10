import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { POST_TEMPLATES } from '@/data/postTemplates';
import { listPosts, addPost, updatePost, togglePost, removePost } from '@/services/sessoes';
import { useInvalidate } from '@/hooks/useInvalidate';
import { copyToClipboard } from '@/lib/clipboard';
import { listAtivos } from '@/services/inventario';
import { listTopicos } from '@/services/catalog';

function riscosDePublicacao(texto: string): string[] {
  const riscos: string[] = [];
  if (/\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\./i.test(texto)) {
    riscos.push('endereço IP ou de rede');
  }
  if (/\b(?:senha|password|token|secret|credencial|vulner[aá]vel|exposto|exploit)\b/i.test(texto)) {
    riscos.push('termo que pode revelar segredo ou fragilidade');
  }
  const ativos = listAtivos({ rows: 1_000 }).items;
  if (ativos.some((a) => [a.nome, a.endereco].some((v) => v && v !== '-' && texto.toLowerCase().includes(v.toLowerCase())))) {
    riscos.push('nome ou endereço de ativo do homelab');
  }
  if (/\b[a-z0-9.-]+\.(?:local|internal|criecom\.ia\.br)\b/i.test(texto)) {
    riscos.push('domínio do ambiente');
  }
  return [...new Set(riscos)];
}

export function Posts() {
  const invalidate = useInvalidate();
  const { data } = useQuery({ queryKey: ['posts'], queryFn: listPosts });

  const [titulo, setTitulo] = useState('');
  const [gancho, setGancho] = useState('');
  const [corpo, setCorpo] = useState('');
  const [topicoId, setTopicoId] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const topicOptions = listTopicos({ rows: 1000 }).items.map((t) => ({ label: t.titulo, value: t.id }));

  function aplicarTemplate(id: string) {
    const t = POST_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTitulo(t.titulo); setGancho(t.gancho); setCorpo(t.corpo);
  }
  function salvar() {
    if (!titulo.trim()) return;
    if (editingId) updatePost(editingId, { titulo, gancho, corpo, topicoId });
    else addPost({ titulo, gancho, corpo, topicoId, publicado: false });
    setTitulo(''); setGancho(''); setCorpo(''); setTopicoId(undefined); setEditingId(null);
    invalidate('posts');
  }
  function copiar(gancho: string, corpo: string) {
    const texto = `${gancho}\n\n${corpo}`;
    const riscos = riscosDePublicacao(texto);
    if (riscos.length && !window.confirm(`O texto pode expor ${riscos.join(', ')}. Revise e remova detalhes do ambiente antes de publicar. Copiar mesmo assim?`)) return;
    copyToClipboard(texto);
  }

  return (
    <div>
      <PageHeader title="Ideias para LinkedIn" subtitle="Transforme o que estuda em presença profissional. Se vender como profissional de segurança." />
      <StatusStrip tone="ok" icon="pi-linkedin">
        {data?.length ?? 0} rascunhos salvos. Comece por um modelo que conecta sua experiência de infra à segurança.
      </StatusStrip>

      <div className="iv-card iv-mt">
        <h3 style={{ marginTop: 0 }}>Modelos</h3>
        <div className="iv-row iv-wrap">
          {POST_TEMPLATES.map((t) => <Chip key={t.id} label={t.titulo} icon="pi-copy" onClick={() => aplicarTemplate(t.id)} />)}
        </div>
      </div>

      <div className="iv-card iv-mt">
        <h3 style={{ marginTop: 0 }}>Rascunho</h3>
        <div className="iv-col iv-gap">
          <InputText value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título interno do post" />
          <InputText value={gancho} onChange={(e) => setGancho(e.target.value)} placeholder="Gancho (primeira linha, o que prende a atenção)" />
          <InputTextarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={8} placeholder="Corpo do post..." />
          <Dropdown value={topicoId} options={topicOptions} onChange={(e) => setTopicoId(e.value)} placeholder="Tópico relacionado (opcional)" showClear filter />
          <div className="iv-row">
            <Button label={editingId ? 'Atualizar rascunho' : 'Salvar rascunho'} icon="pi pi-save" onClick={salvar} />
            {editingId && <Button label="Cancelar edição" text onClick={() => { setEditingId(null); setTitulo(''); setGancho(''); setCorpo(''); setTopicoId(undefined); }} />}
            <Button label="Copiar texto" icon="pi pi-copy" outlined onClick={() => copiar(gancho, corpo)} />
          </div>
        </div>
      </div>

      <div className="iv-col iv-gap iv-mt">
        {(data ?? []).map((p) => (
          <div key={p.id} className="iv-card">
            <div className="iv-row" style={{ justifyContent: 'space-between' }}>
              <strong>{p.titulo}</strong>
              <div className="iv-row">
                {p.publicado && <Pill label="Publicado" color="#16a34a" />}
                <Button icon="pi pi-pencil" text onClick={() => { setEditingId(p.id); setTitulo(p.titulo); setGancho(p.gancho); setCorpo(p.corpo); setTopicoId(p.topicoId); window.scrollTo({ top: 0, behavior: 'smooth' }); }} tooltip="Editar rascunho" aria-label={`Editar ${p.titulo}`} />
                <Button icon="pi pi-copy" text onClick={() => copiar(p.gancho, p.corpo)} tooltip="Copiar" />
                <Button icon={p.publicado ? 'pi pi-undo' : 'pi pi-check'} text onClick={() => { togglePost(p.id); invalidate('posts'); }} tooltip={p.publicado ? 'Marcar como rascunho' : 'Marcar publicado'} />
                <Button icon="pi pi-trash" text severity="danger" onClick={() => { removePost(p.id); invalidate('posts'); }} />
              </div>
            </div>
            <p style={{ fontWeight: 600, margin: '.5rem 0 .25rem' }}>{p.gancho}</p>
            <p className="iv-muted" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{p.corpo}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
