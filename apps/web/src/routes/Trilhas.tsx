import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClickCard } from '@/components/ui/ClickCard';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Bar, EmptyState, Kpi, Pill } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { useFilter } from '@/hooks/useFilter';
import { getRevisoes, listTopicos, listTrilhas, progressoPorTrilha } from '@/services/catalog';
import { todayISO } from '@/services/store';
import { progressTone } from '@/theme/status';
import { TrilhaDrawer } from './estudo/TrilhaDrawer';
import { ESTADO_TRILHA_LABEL, estadoTrilha, MOTIVO_PROXIMO, proximoTopico, type EstadoTrilha } from './estudo/regras';
import '@/styles/telas/estudo.css';

const semPaginacao = () => {};

export function Trilhas() {
  const { data } = useQuery({
    queryKey: ['trilhas'],
    queryFn: () => ({ trilhas: listTrilhas(), progresso: progressoPorTrilha(), topicos: listTopicos({ rows: 10_000 }).items, revisoes: getRevisoes(), hoje: todayISO() }),
  });
  const estado = useFilter<EstadoTrilha>(semPaginacao);

  const contagem = useMemo(() => {
    const c: Record<EstadoTrilha, number> = { nao_iniciada: 0, andamento: 0, concluida: 0 };
    data?.trilhas.forEach((t) => { c[estadoTrilha(data.progresso[t.id])]++; });
    return c;
  }, [data]);
  const lista = useMemo(() => (data?.trilhas ?? []).filter((t) => !estado.value || estadoTrilha(data!.progresso[t.id]) === estado.value), [data, estado.value]);
  const sel = useDrawerSelection(lista);

  if (!data) return null;
  const totalTopicos = data.topicos.length;
  const concluidos = data.topicos.filter((t) => t.status === 'concluido').length;

  return (
    <div>
      <PageHeader title="Trilhas de Estudo" subtitle="Áreas da Segurança da Informação, com foco em referências de mercado." />

      <div className="iv-kpis">
        <Kpi label="Em andamento" icon="pi-play-circle" value={contagem.andamento} active={estado.is('andamento')} onClick={() => estado.toggle('andamento')} />
        <Kpi label="Não iniciadas" icon="pi-circle" value={contagem.nao_iniciada} active={estado.is('nao_iniciada')} onClick={() => estado.toggle('nao_iniciada')} />
        <Kpi label="Concluídas" icon="pi-check-circle" value={contagem.concluida} active={estado.is('concluida')} onClick={() => estado.toggle('concluida')} />
        <Kpi label="Tópicos concluídos" value={`${concluidos}/${totalTopicos}`} hint={`${totalTopicos ? Math.round((concluidos / totalTopicos) * 100) : 0}% do catálogo`} />
      </div>

      <ActiveFiltersBar filters={[estado.value && { key: 'estado', label: `Estado: ${ESTADO_TRILHA_LABEL[estado.value]}`, onRemove: () => estado.set() }]} />

      {lista.length === 0 ? (
        <EmptyState icon="pi-filter-slash" title="Nenhuma trilha neste estado" text="Limpe o filtro para ver todas as trilhas." />
      ) : (
        <ul className="es-grid iv-mt">
          {lista.map((t) => {
            const p = data.progresso[t.id];
            const prox = proximoTopico(data.topicos.filter((x) => x.trilhaId === t.id), data.revisoes, data.hoje);
            return (
              <ClickCard key={t.id} as="li" className="es-trilha" onOpen={() => sel.open(t.id)} selected={sel.isOpen(t.id)}
                tone={prox?.motivo === 'revisao' ? 'warning' : undefined} label={`Abrir ficha da trilha ${t.titulo}`}>
                <div className="es-trilha__top">
                  <i className={`pi ${t.icone} es-trilha__icon`} aria-hidden="true" />
                  <Pill label={`${p.concluidos}/${p.total}`} />
                </div>
                <h2 className="es-trilha__title">{t.titulo}</h2>
                <p className="es-trilha__desc">{t.descricao}</p>
                <div className="es-progress"><Bar pct={p.pct} tone={progressTone(p.pct)} /><span className="tabular">{p.pct}%</span></div>
                <p className="es-trilha__next">
                  {prox ? <><span className="es-eyebrow">{MOTIVO_PROXIMO[prox.motivo]}</span> {prox.topico.titulo}</> : <span className="es-eyebrow">Trilha concluída</span>}
                </p>
                <Link to="/trilhas/$trilhaId" params={{ trilhaId: t.id }} className="es-cardlink">Ver tópicos <i className="pi pi-arrow-right" aria-hidden="true" /></Link>
              </ClickCard>
            );
          })}
        </ul>
      )}

      {sel.item && <TrilhaDrawer trilha={sel.item} nav={sel.nav} />}
    </div>
  );
}
