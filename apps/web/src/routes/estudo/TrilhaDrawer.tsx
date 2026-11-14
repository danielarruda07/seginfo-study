import { useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import type { Trilha } from '@seginfo/shared';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Bar, Pill } from '@/components/InfraKit';
import { setStatus } from '@/services/catalog';
import { progressTone } from '@/theme/status';
import { useBaseEstudo, useInvalidarEstudo } from './dados';
import { ListaMetas, ListaSessoes, ListaTopicos } from './Listas';
import { SessaoRapida } from './SessaoRapida';
import { ESTADO_TRILHA_LABEL, estadoTrilha, formatarData, formatarMinutos, MOTIVO_PROXIMO, proximaAcaoTopico, proximoTopico, resumoSessoes } from './regras';

interface Nav { index: number; total: number; onIndex: (i: number) => void; onClose: () => void }

/** Ficha da trilha: progresso, próximo passo, tópicos, metas e sessões ligadas. */
export function TrilhaDrawer({ trilha, nav }: { trilha: Trilha; nav: Nav }) {
  const base = useBaseEstudo();
  const invalidar = useInvalidarEstudo();
  const navigate = useNavigate();
  const topicos = base.topicos.filter((t) => t.trilhaId === trilha.id);
  const p = base.progresso[trilha.id] ?? { total: 0, concluidos: 0, estudando: 0, pct: 0 };
  const estado = estadoTrilha(p);
  const prox = proximoTopico(topicos, base.revisoes, base.hoje);
  const sessoes = base.sessoes.filter((s) => s.trilhaId === trilha.id);
  const tempo = resumoSessoes(sessoes);
  const metas = base.metas.filter((m) => m.trilhaId === trilha.id);
  const abrirTrilha = () => navigate({ to: '/trilhas/$trilhaId', params: { trilhaId: trilha.id } });

  return (
    <DetailDrawer
      {...nav}
      kind={{ icon: trilha.icone, label: 'Trilha' }}
      ariaLabel={`Ficha da trilha ${trilha.titulo}`}
      status={<Pill label={ESTADO_TRILHA_LABEL[estado]} tone={estado === 'concluida' ? 'ok' : estado === 'andamento' ? 'info' : undefined} />}
      title={trilha.titulo}
      subtitle={trilha.descricao}
      actions={<Button label="Abrir tópicos da trilha" icon="pi pi-list" onClick={abrirTrilha} />}
    >
      <section>
        <h3 className="iv-section-label">Progresso</h3>
        <div className="es-progress">
          <Bar pct={p.pct} tone={progressTone(p.pct)} />
          <strong className="tabular">{p.pct}%</strong>
        </div>
        <DetailFields items={[
          ['Concluídos', `${p.concluidos} de ${p.total} tópicos`],
          ['Estudando agora', p.estudando],
          ['A estudar', p.total - p.concluidos - p.estudando],
          ['Tempo registrado', tempo.quantidade ? `${formatarMinutos(tempo.minutos)} em ${tempo.quantidade} ${tempo.quantidade === 1 ? 'sessão' : 'sessões'}` : 'Nenhuma sessão ligada a esta trilha'],
          ['Última sessão', tempo.ultima ? formatarData(tempo.ultima) : ''],
        ]} />
      </section>

      <section>
        <h3 className="iv-section-label">Próximo passo</h3>
        {prox ? (
          <div className="es-next-step">
            <span className="es-eyebrow">{MOTIVO_PROXIMO[prox.motivo]}</span>
            <strong>{prox.topico.titulo}</strong>
            <span className="es-hint">{prox.topico.resumo}</span>
            {prox.motivo !== 'revisao' && (
              <Button label={proximaAcaoTopico(prox.topico.status).label} icon={`pi ${proximaAcaoTopico(prox.topico.status).icon}`} size="small" outlined
                onClick={() => { setStatus(prox.topico.id, proximaAcaoTopico(prox.topico.status).status); invalidar(); }} />
            )}
          </div>
        ) : <p className="es-empty-line">Todos os tópicos desta trilha estão concluídos. Agende revisões na lista de tópicos.</p>}
      </section>

      <section>
        <h3 className="iv-section-label">Metas ligadas</h3>
        <ListaMetas metas={metas} hoje={base.hoje} />
      </section>

      <section>
        <h3 className="iv-section-label">Sessões recentes</h3>
        <ListaSessoes sessoes={sessoes} contexto="trilha" />
        <SessaoRapida trilhaId={trilha.id} />
      </section>

      <section>
        <h3 className="iv-section-label">Tópicos ({topicos.length})</h3>
        <ListaTopicos topicos={topicos} />
        {topicos.length > 0 && <Button label="Ver detalhes de cada tópico" icon="pi pi-arrow-right" iconPos="right" text size="small" onClick={abrirTrilha} />}
      </section>
    </DetailDrawer>
  );
}
