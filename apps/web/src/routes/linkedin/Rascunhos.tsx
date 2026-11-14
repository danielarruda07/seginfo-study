import { Button } from 'primereact/button';
import { ClickCard } from '@/components/ui/ClickCard';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { EmptyState, Pill } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { getTopico } from '@/services/catalog';
import { checklistPost, riscosDePublicacao, type Rascunho } from '@/services/linkedin';
import { tomChecklist } from './regras';

/** Rascunhos salvos: cartão compacto + ficha com texto completo, checklist e ações. */
export function Rascunhos({ rascunhos, onEditar, onCopiar, onMarcarPublicado, onExcluir }: {
  rascunhos: Rascunho[];
  onEditar: (r: Rascunho) => void;
  onCopiar: (r: Rascunho) => void;
  onMarcarPublicado: (r: Rascunho) => void;
  onExcluir: (r: Rascunho) => void;
}) {
  const sel = useDrawerSelection(rascunhos);
  const r = sel.item;
  const checklist = r ? checklistPost(r.gancho, r.corpo) : [];
  const nota = checklist.filter((c) => c.ok).length;
  const riscos = r ? riscosDePublicacao(`${r.gancho}\n${r.corpo}`) : [];

  return (
    <section className="iv-mt" aria-labelledby="rascunhos-titulo">
      <h3 id="rascunhos-titulo" className="ca-h3">Rascunhos <span className="iv-muted">({rascunhos.length})</span></h3>
      {rascunhos.length === 0 ? (
        <div className="iv-card iv-mt"><EmptyState icon="pi-file-edit" title="Nenhum rascunho salvo" text="Escreva no editor acima ou peça um rascunho à IA e clique em Salvar rascunho." /></div>
      ) : (
        <div className="posts-drafts iv-mt">
          {rascunhos.map((p) => (
            <ClickCard key={p.id} onOpen={() => sel.open(p.id)} selected={sel.isOpen(p.id)} label={`Abrir rascunho ${p.titulo}`} tone={p.publicado ? 'ok' : undefined}>
              <div className="ca-post__meta">
                <strong className="ca-flex1">{p.titulo}</strong>
                {p.publicado && <Pill label="Publicado" tone="ok" icon="pi-check" />}
              </div>
              <p className="ca-post__titulo ca-clamp-2">{p.gancho || <span className="iv-muted">Sem gancho</span>}</p>
              <p className="iv-muted ca-clamp-3 ca-mb0 ca-pre">{p.corpo}</p>
            </ClickCard>
          ))}
        </div>
      )}

      {r && (
        <DetailDrawer {...sel.nav} wide kind={{ icon: 'pi-file-edit', label: 'Rascunho' }} ariaLabel={`Ficha do rascunho ${r.titulo}`}
          status={<>
            {r.publicado ? <Pill label="Publicado" tone="ok" icon="pi-check" /> : <Pill label="Rascunho" tone="muted" />}
            <Pill label={`Checklist ${nota}/${checklist.length}`} tone={tomChecklist(nota)} />
            {riscos.length > 0 && <Pill label="Revisar exposição" tone="serious" icon="pi-exclamation-triangle" />}
          </>}
          title={r.titulo}
          subtitle={r.topicoId ? `Tópico: ${getTopico(r.topicoId)?.titulo ?? r.topicoId}` : 'Sem tópico relacionado'}
          actions={<>
            <Button label="Editar no editor" icon="pi pi-pencil" size="small" onClick={() => { sel.close(); onEditar(r); }} />
            <Button label="Copiar texto" icon="pi pi-copy" size="small" outlined onClick={() => onCopiar(r)} />
            {!r.publicado && <Button label="Publiquei: registrar" icon="pi pi-send" size="small" outlined onClick={() => { sel.close(); onMarcarPublicado(r); }} />}
            <Button label="Excluir" icon="pi pi-trash" size="small" text severity="danger" onClick={() => onExcluir(r)} />
          </>}>
          {riscos.length > 0 && <p className="ca-aviso"><i className="pi pi-exclamation-triangle" aria-hidden="true" /> Pode expor: {riscos.join(', ')}. Revise antes de publicar.</p>}
          <section>
            <h3 className="iv-section-label">Texto</h3>
            <div className="ca-texto"><strong>{r.gancho}</strong>{'\n\n'}{r.corpo}</div>
          </section>
          {(r.direcaoVisual || r.roteiroSlides || r.textoAlternativo) && <section>
            <h3 className="iv-section-label">Material visual</h3>
            {r.roteiroSlides && <div className="ca-texto"><strong>Roteiro do carrossel</strong>{'\n'}{r.roteiroSlides}</div>}
            {r.direcaoVisual && <div className="ca-texto iv-mt"><strong>Direção visual</strong>{'\n'}{r.direcaoVisual}</div>}
            {r.textoAlternativo && <p className="iv-muted ca-small"><strong>Texto alternativo:</strong> {r.textoAlternativo}</p>}
          </section>}
          <section>
            <h3 className="iv-section-label">Checklist do post</h3>
            <ul className="linkedin-checklist">
              {checklist.map((c) => (
                <li key={c.id}>
                  <i className={`pi ${c.ok ? 'pi-check-circle ca-ok' : 'pi-circle iv-muted'}`} aria-hidden="true" />
                  <span><strong>{c.label}</strong><span className="ca-sr">{c.ok ? ' (ok)' : ' (pendente)'}</span>{!c.ok && <span className="iv-muted"> — {c.dica}</span>}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="iv-section-label">Dados</h3>
            <DetailFields items={[
              ['Caracteres', `${`${r.gancho}\n\n${r.corpo}`.trim().length} (limite do LinkedIn: 3.000)`],
              ['Situação', r.publicado ? 'Marcado como publicado' : 'Ainda não publicado'],
            ]} />
          </section>
        </DetailDrawer>
      )}
    </section>
  );
}
