import { preflightLiberado } from '@seginfo/shared';
import { Chip, Pill } from '@/components/InfraKit';
import { POST_TEMPLATES } from '@/data/postTemplates';
import { checklistPost, preflightLocal } from '@/services/linkedin';
import { PreflightLista } from './PreflightLista';
import { tomChecklist } from './regras';

/** Coluna lateral do Estúdio: checklist editorial, verificação de liberação, prévia e modelos. */
export function EstudioLateral({ gancho, corpo, onModelo }: {
  gancho: string; corpo: string; onModelo: (id: string) => void;
}) {
  const checklist = checklistPost(gancho, corpo);
  const nota = checklist.filter((c) => c.ok).length;
  const preflight = preflightLocal(gancho, corpo);
  const liberado = preflightLiberado(preflight);
  return (
    <aside className="posts-aside">
      <section className="iv-card">
        <div className="ca-toolbar">
          <h3 className="ca-h3">Checklist do post</h3>
          <Pill label={`${nota}/${checklist.length}`} tone={tomChecklist(nota)} />
        </div>
        <ul className="linkedin-checklist">
          {checklist.map((c) => (
            <li key={c.id} title={c.dica}>
              <i className={`pi ${c.ok ? 'pi-check-circle ca-ok' : 'pi-circle iv-muted'}`} aria-hidden="true" />
              <span><strong>{c.label}</strong>{!c.ok && <span className="iv-muted"> — {c.dica}</span>}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="iv-card">
        <div className="ca-toolbar">
          <h3 className="ca-h3">Pode ser aprovado?</h3>
          <Pill label={liberado ? 'Liberado' : 'Bloqueado'} tone={liberado ? 'ok' : 'serious'} icon={liberado ? 'pi-check' : 'pi-ban'} />
        </div>
        <PreflightLista itens={preflight} />
        <p className="iv-muted ca-small ca-mb0">A aprovação acontece no Pipeline, e o servidor refaz esta verificação antes de agendar ou publicar.</p>
      </section>
      <section className="iv-card posts-preview" aria-live="polite">
        <div className="ca-toolbar"><h3 className="ca-h3">Prévia</h3><Pill label="LinkedIn" /></div>
        <strong>{gancho || 'Seu gancho aparece aqui'}</strong>
        <p className="iv-muted ca-pre ca-mb0">{corpo || 'A prévia acompanha o texto enquanto você escreve.'}</p>
      </section>
      <section className="iv-card">
        <h3 className="ca-h3 ca-mb">Modelos</h3>
        <div className="posts-template-list">
          {POST_TEMPLATES.map((t) => <Chip key={t.id} label={t.titulo} icon="pi-copy" onClick={() => onModelo(t.id)} />)}
        </div>
      </section>
    </aside>
  );
}
