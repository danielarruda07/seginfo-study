import type { PostPublicado } from '@seginfo/shared';
import { ClickCard } from '@/components/ui/ClickCard';
import { Pill } from '@/components/InfraKit';
import { taxaEngajamento } from '@/services/linkedin';
import { primeiraLinha } from './regras';

const fmt = (n?: number) => (n === undefined ? '—' : n.toLocaleString('pt-BR'));

/** Cartão compacto do post publicado; o detalhe (texto, análise, ideias) abre na ficha lateral. */
export function PostCard({ post: p, ocupado, selected, onOpen }: {
  post: PostPublicado; ocupado?: string; selected: boolean; onOpen: () => void;
}) {
  const a = p.analise;
  const m = p.metricas;
  const taxa = taxaEngajamento(m);
  const titulo = a?.resumo ?? primeiraLinha(p.texto);
  return (
    <ClickCard onOpen={onOpen} selected={selected} className="ca-post" label={`Abrir post de ${p.publicadoEm}: ${primeiraLinha(titulo, 80)}`}>
      <div className="ca-post__meta">
        <span className="iv-muted">{p.publicadoEm}</span>
        <Pill label={p.formato} />
        {a ? <Pill label={a.pilar} tone="info" /> : <Pill label="Não organizado" tone="muted" icon="pi-clock" />}
        {p.memoriaId && <Pill label="No cérebro" icon="pi-sitemap" tone="ok" />}
        <span className="iv-right iv-row">
          {ocupado && <span className="iv-muted ca-small" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> {ocupado}</span>}
          <a href={p.url} target="_blank" rel="noreferrer" className="p-button p-button-text p-button-icon-only p-button-sm" aria-label="Abrir no LinkedIn (nova aba)">
            <i className="pi pi-external-link" aria-hidden="true" />
          </a>
        </span>
      </div>
      <p className="ca-post__titulo ca-clamp-2">{titulo}</p>
      <div className="ca-metricas" aria-label="Métricas">
        <span title="Impressões"><i className="pi pi-eye" aria-hidden="true" /> {fmt(m.impressoes)}</span>
        <span title="Reações"><i className="pi pi-thumbs-up" aria-hidden="true" /> {fmt(m.reacoes)}</span>
        <span title="Comentários"><i className="pi pi-comment" aria-hidden="true" /> {fmt(m.comentarios)}</span>
        <span title="Compartilhamentos"><i className="pi pi-share-alt" aria-hidden="true" /> {fmt(m.compartilhamentos)}</span>
        {taxa !== null && <span>engajamento <strong>{taxa}%</strong></span>}
      </div>
    </ClickCard>
  );
}
