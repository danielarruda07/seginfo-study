import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { POST_TEMPLATES } from '@/data/postTemplates';
import { listPosts, addPost, togglePost, removePost } from '@/services/sessoes';
import { useInvalidate } from '@/hooks/useInvalidate';
import { copyToClipboard } from '@/lib/clipboard';

export function Posts() {
  const invalidate = useInvalidate();
  const { data } = useQuery({ queryKey: ['posts'], queryFn: listPosts });

  const [titulo, setTitulo] = useState('');
  const [gancho, setGancho] = useState('');
  const [corpo, setCorpo] = useState('');

  function aplicarTemplate(id: string) {
    const t = POST_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTitulo(t.titulo); setGancho(t.gancho); setCorpo(t.corpo);
  }
  function salvar() {
    if (!titulo.trim()) return;
    addPost({ titulo, gancho, corpo, publicado: false });
    setTitulo(''); setGancho(''); setCorpo('');
    invalidate('posts');
  }
  function copiar(gancho: string, corpo: string) {
    copyToClipboard(`${gancho}\n\n${corpo}`);
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
          <div className="iv-row">
            <Button label="Salvar rascunho" icon="pi pi-save" onClick={salvar} />
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
