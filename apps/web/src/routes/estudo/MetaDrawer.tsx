import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import type { Meta } from '@seginfo/shared';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Bar, Pill } from '@/components/InfraKit';
import { getTrilha } from '@/services/catalog';
import { toggleMeta, updateMeta } from '@/services/sessoes';
import { progressTone } from '@/theme/status';
import { useBaseEstudo, useInvalidarEstudo } from './dados';
import { ListaSessoes, ListaTopicos } from './Listas';
import { MetaCampos, type MetaRascunho } from './MetaCampos';
import { estadoMeta, formatarData, formatarMinutos, proximoTopico, resumoSessoes, ritmoNecessario, MOTIVO_PROXIMO } from './regras';

interface Nav { index: number; total: number; onIndex: (i: number) => void; onClose: () => void }

/** Ficha da meta: prazo, ritmo necessário, trilha ligada (progresso, pendências, tempo) e edição. */
export function MetaDrawer({ meta, nav, onRemove }: { meta: Meta; nav: Nav; onRemove?: (m: Meta) => void }) {
  const base = useBaseEstudo();
  const invalidar = useInvalidarEstudo();
  const [editando, setEditando] = useState(false);
  const e = estadoMeta(meta, base.hoje);
  const trilha = meta.trilhaId ? getTrilha(meta.trilhaId) : undefined;
  const p = trilha ? base.progresso[trilha.id] : undefined;
  const topicos = trilha ? base.topicos.filter((t) => t.trilhaId === trilha.id) : [];
  const pendentes = topicos.filter((t) => t.status !== 'concluido');
  const ritmo = p && !meta.concluida ? ritmoNecessario(p.total - p.concluidos, e.dias) : undefined;
  const prox = proximoTopico(topicos, base.revisoes, base.hoje);
  const sessoes = trilha ? base.sessoes.filter((s) => s.trilhaId === trilha.id) : [];
  const tempo = resumoSessoes(sessoes);

  function alternar() { toggleMeta(meta.id); invalidar(); }
  function salvar(r: MetaRascunho) { updateMeta(meta.id, { titulo: r.titulo.trim(), prazo: r.prazo, trilhaId: r.trilhaId }); setEditando(false); invalidar(); }

  return (
    <DetailDrawer
      {...nav}
      onIndex={(i) => { setEditando(false); nav.onIndex(i); }}
      kind={{ icon: 'pi-flag', label: 'Meta' }}
      ariaLabel={`Ficha da meta ${meta.titulo}`}
      status={<Pill label={e.label} tone={e.tone} icon={e.icon} />}
      title={meta.titulo}
      subtitle={`Prazo ${formatarData(meta.prazo)} · ${e.texto}`}
      actions={<>
        <Button label={meta.concluida ? 'Reabrir meta' : 'Marcar como concluída'} icon={meta.concluida ? 'pi pi-replay' : 'pi pi-check'} onClick={alternar} />
        <Button label="Editar" icon="pi pi-pencil" outlined onClick={() => setEditando((v) => !v)} aria-expanded={editando} />
        {onRemove && <Button label="Excluir" icon="pi pi-trash" severity="danger" outlined onClick={() => onRemove(meta)} />}
      </>}
    >
      {editando && (
        <section>
          <h3 className="iv-section-label">Editar meta</h3>
          <MetaCampos key={meta.id} inicial={{ titulo: meta.titulo, prazo: meta.prazo, trilhaId: meta.trilhaId }} verbo="Salvar alterações" onSave={salvar} onCancel={() => setEditando(false)} />
        </section>
      )}

      <section>
        <h3 className="iv-section-label">Prazo</h3>
        <DetailFields items={[
          ['Data-alvo', formatarData(meta.prazo)],
          ['Situação', e.texto],
          ['Ritmo necessário', ritmo === undefined ? (p && !meta.concluida && p.total > p.concluidos ? 'Prazo vencido: ajuste a data ou o escopo' : '') : ritmo === 0 ? 'Trilha já concluída' : `≈ ${ritmo} ${ritmo === 1 ? 'tópico' : 'tópicos'} por semana até o prazo`],
        ]} />
      </section>

      {trilha && p ? (
        <>
          <section>
            <h3 className="iv-section-label">Trilha ligada</h3>
            <p className="es-line"><Link to="/trilhas/$trilhaId" params={{ trilhaId: trilha.id }}><i className={`pi ${trilha.icone}`} aria-hidden="true" /> {trilha.titulo}</Link></p>
            <div className="es-progress"><Bar pct={p.pct} tone={progressTone(p.pct)} /><strong className="tabular">{p.pct}%</strong></div>
            <DetailFields items={[
              ['Concluídos', `${p.concluidos} de ${p.total} tópicos`],
              ['Tempo na trilha', tempo.quantidade ? `${formatarMinutos(tempo.minutos)} em ${tempo.quantidade} ${tempo.quantidade === 1 ? 'sessão' : 'sessões'}` : 'Nenhuma sessão registrada'],
              ['Próximo passo', prox ? `${MOTIVO_PROXIMO[prox.motivo]}: ${prox.topico.titulo}` : ''],
            ]} />
          </section>
          <section>
            <h3 className="iv-section-label">Falta estudar ({pendentes.length})</h3>
            <ListaTopicos topicos={pendentes.slice(0, 8)} />
            {pendentes.length > 8 && <p className="es-empty-line">+ {pendentes.length - 8} tópicos na trilha.</p>}
          </section>
          <section>
            <h3 className="iv-section-label">Sessões recentes na trilha</h3>
            <ListaSessoes sessoes={sessoes} contexto="trilha" limite={4} />
          </section>
        </>
      ) : (
        <section>
          <h3 className="iv-section-label">Trilha ligada</h3>
          <p className="es-empty-line">Sem trilha. Ligue a meta a uma trilha (Editar) para acompanhar progresso e ritmo necessário aqui.</p>
        </section>
      )}
    </DetailDrawer>
  );
}
