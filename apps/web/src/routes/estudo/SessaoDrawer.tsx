import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import type { SessaoEstudo } from '@seginfo/shared';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { getTrilha } from '@/services/catalog';
import { getLab } from '@/services/inventario';
import { useBaseEstudo } from './dados';
import { ListaSessoes } from './Listas';
import { formatarData, formatarMinutos, resumoSessoes, STATUS_TOPICO } from './regras';

interface Nav { index: number; total: number; onIndex: (i: number) => void; onClose: () => void }

/** Ficha da sessão: registro completo e o acumulado no mesmo tópico e na mesma trilha. */
export function SessaoDrawer({ sessao, nav, onRemove }: { sessao: SessaoEstudo; nav: Nav; onRemove: (s: SessaoEstudo) => void }) {
  const base = useBaseEstudo();
  const navigate = useNavigate();
  const topico = base.topicos.find((t) => t.id === sessao.topicoId);
  const trilha = getTrilha(sessao.trilhaId ?? topico?.trilhaId ?? '');
  const lab = sessao.labId ? getLab(sessao.labId) : undefined;
  const doTopico = topico ? base.sessoes.filter((s) => s.topicoId === topico.id) : [];
  const daTrilha = trilha ? base.sessoes.filter((s) => s.trilhaId === trilha.id) : [];
  const rTopico = resumoSessoes(doTopico);
  const rTrilha = resumoSessoes(daTrilha);
  const outras = (topico ? doTopico : daTrilha).filter((s) => s.id !== sessao.id);
  const st = topico ? STATUS_TOPICO[topico.status] : undefined;
  const titulo = topico?.titulo ?? lab?.titulo ?? trilha?.titulo ?? 'Sessão de estudo';

  return (
    <DetailDrawer
      {...nav}
      kind={{ icon: 'pi-clock', label: 'Sessão' }}
      ariaLabel={`Ficha da sessão de ${formatarData(sessao.data)}`}
      status={<Pill label={formatarMinutos(sessao.minutos)} icon="pi-clock" />}
      title={titulo}
      subtitle={`${formatarData(sessao.data)}${sessao.nota ? ` · ${sessao.nota}` : ''}`}
      actions={<>
        {trilha && <Button label="Abrir trilha" icon="pi pi-sitemap" outlined onClick={() => navigate({ to: '/trilhas/$trilhaId', params: { trilhaId: trilha.id } })} />}
        <Button label="Excluir sessão" icon="pi pi-trash" severity="danger" outlined onClick={() => onRemove(sessao)} />
      </>}
    >
      <section>
        <h3 className="iv-section-label">Registro</h3>
        <DetailFields items={[
          ['Data', formatarData(sessao.data)],
          ['Duração', formatarMinutos(sessao.minutos)],
          ['Trilha', trilha?.titulo ?? ''],
          ['Tópico', topico ? <span className="iv-row iv-wrap">{topico.titulo} {st && <Pill label={st.label} tone={st.tone} icon={st.icon} />}</span> : ''],
          ['Lab', lab ? <Link to="/labs">{lab.titulo}</Link> : ''],
          ['O que estudou', sessao.nota],
        ]} />
      </section>

      {(topico || trilha) && (
        <section>
          <h3 className="iv-section-label">Acumulado</h3>
          <DetailFields items={[
            ...(topico ? [['Neste tópico', `${formatarMinutos(rTopico.minutos)} em ${rTopico.quantidade} ${rTopico.quantidade === 1 ? 'sessão' : 'sessões'}`] as [string, string]] : []),
            ...(trilha ? [['Nesta trilha', `${formatarMinutos(rTrilha.minutos)} em ${rTrilha.quantidade} ${rTrilha.quantidade === 1 ? 'sessão' : 'sessões'}`] as [string, string]] : []),
          ]} />
        </section>
      )}

      {(topico || trilha) && (
        <section>
          <h3 className="iv-section-label">{topico ? 'Outras sessões deste tópico' : 'Outras sessões desta trilha'}</h3>
          <ListaSessoes sessoes={outras} contexto={topico ? 'topico' : 'trilha'} />
        </section>
      )}
    </DetailDrawer>
  );
}
