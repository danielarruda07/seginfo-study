import { Button } from 'primereact/button';
import type { ProjetoLinkedin, RascunhoLinkedin } from '@seginfo/shared';
import { ClickCard } from '@/components/ui/ClickCard';
import { Pill } from '@/components/InfraKit';
import { primeiraLinha } from './regras';
import { CANAL_CURTO, STATUS_META, dataHoraCurta, fusoDoNavegador, nomeDoProjeto, type ColunaQuadro } from './pipelineRegras';
import { copiarPost } from './dados';

/** Cartão compacto do quadro; o detalhe e as ações ficam na ficha lateral. */
function CartaoRascunho({ rascunho: r, projetos, selected, onOpen }: {
  rascunho: RascunhoLinkedin; projetos: ProjetoLinkedin[]; selected: boolean; onOpen: () => void;
}) {
  const fuso = fusoDoNavegador();
  const projeto = nomeDoProjeto(projetos, r.projetoId);
  const meta = STATUS_META[r.status];
  const especial = r.status === 'falhou' || r.status === 'publicando';
  return (
    <ClickCard onOpen={onOpen} selected={selected} className="lp-cartao" tone={r.status === 'falhou' ? 'danger' : undefined} label={`Abrir ${r.titulo}`}>
      <strong className="ca-clamp-2">{r.titulo}</strong>
      <p className="iv-muted ca-small ca-clamp-2 lp-cartao__gancho">{primeiraLinha(r.gancho || r.corpo, 140) || 'Sem texto ainda'}</p>
      <div className="ca-post__meta">
        {especial && <Pill label={meta.label} tone={meta.tone} icon={meta.icon} />}
        {r.agendadoPara && r.status !== 'publicado' && <Pill label={`${dataHoraCurta(r.agendadoPara, fuso)} · ${CANAL_CURTO[r.canal]}`} icon="pi-clock" />}
        {r.status === 'publicado' && r.publicadoEm && <Pill label={dataHoraCurta(r.publicadoEm, fuso).slice(0, 5)} icon="pi-check" tone="ok" />}
        {r.formato !== 'texto' && <Pill label={r.formato} />}
        {projeto && <Pill label={projeto} icon="pi-folder" />}
      </div>
    </ClickCard>
  );
}

/** Quadro do pipeline: uma coluna por etapa. No celular as colunas viram uma pilha. */
export function Quadro({ colunas, projetos, isOpen, onOpen }: {
  colunas: ColunaQuadro[]; projetos: ProjetoLinkedin[]; isOpen: (id: string) => boolean; onOpen: (id: string) => void;
}) {
  return (
    <div className="lp-quadro">
      {colunas.map((c) => (
        <section key={c.id} className="lp-coluna" aria-labelledby={`lp-col-${c.id}`}>
          <h3 id={`lp-col-${c.id}`} className="lp-coluna__titulo" title={c.dica}>
            {c.titulo} <span className="iv-muted tabular">{c.total}</span>
          </h3>
          {c.itens.length === 0 ? <p className="iv-muted ca-small lp-coluna__vazia">{c.dica}</p>
            : c.itens.map((r) => <CartaoRascunho key={r.id} rascunho={r} projetos={projetos} selected={isOpen(r.id)} onOpen={() => onOpen(r.id)} />)}
          {c.total > c.itens.length && <p className="iv-muted ca-small lp-coluna__vazia">+ {c.total - c.itens.length} mais antigos</p>}
        </section>
      ))}
    </div>
  );
}

/** Faixas do topo: lembretes cuja hora chegou e publicações que falharam. */
export function AvisosPipeline({ vencidos, falhados, onAbrir, onRegistrar }: {
  vencidos: RascunhoLinkedin[]; falhados: RascunhoLinkedin[];
  onAbrir: (id: string) => void; onRegistrar: (r: RascunhoLinkedin) => void;
}) {
  const fuso = fusoDoNavegador();
  if (!vencidos.length && !falhados.length) return null;
  return (
    <div className="lp-avisos">
      {vencidos.map((r) => (
        <div key={r.id} className="lp-faixa tone-serious" role="status">
          <i className="pi pi-bell" aria-hidden="true" />
          <div className="ca-flex1">
            <strong>Hora de publicar:</strong> {r.titulo} <span className="iv-muted">(marcado para {dataHoraCurta(r.agendadoPara as string, fuso)})</span>
          </div>
          <div className="iv-row iv-wrap">
            <Button label="Copiar texto" icon="pi pi-copy" size="small" outlined onClick={() => copiarPost(r.gancho, r.corpo)} />
            <a href="https://www.linkedin.com/feed/" target="_blank" rel="noreferrer" className="p-button p-button-outlined p-button-sm">
              <i className="pi pi-external-link" aria-hidden="true" />&nbsp; Abrir LinkedIn
            </a>
            <Button label="Publiquei: registrar" icon="pi pi-link" size="small" onClick={() => onRegistrar(r)} />
          </div>
        </div>
      ))}
      {falhados.map((r) => (
        <div key={r.id} className="lp-faixa tone-danger" role="alert">
          <i className="pi pi-times-circle" aria-hidden="true" />
          <div className="ca-flex1"><strong>Publicação falhou:</strong> {r.titulo} <span className="iv-muted">— {r.ultimoErro || 'sem detalhe'}</span></div>
          <Button label="Ver o que fazer" size="small" outlined onClick={() => onAbrir(r.id)} />
        </div>
      ))}
    </div>
  );
}
