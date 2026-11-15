import { useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { diaLocal } from '@seginfo/shared';
import { fusoDoNavegador, gradeDoMes, type ItemCalendario, type TipoItemCalendario } from './pipelineRegras';

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const TIPO: Record<TipoItemCalendario, { rotulo: string; icone: string }> = {
  agendado: { rotulo: 'Agendado', icone: 'pi-clock' },
  falhou: { rotulo: 'Falhou', icone: 'pi-times-circle' },
  publicado: { rotulo: 'Publicado', icone: 'pi-check-circle' },
  ideia: { rotulo: 'Ideia sugerida', icone: 'pi-lightbulb' },
};

/** Calendário mensal do que tem data: agendados, publicados e ideias sugeridas pelo planejador. */
export function Calendario({ itens, onAbrir }: {
  itens: Map<string, ItemCalendario[]>;
  onAbrir: (item: ItemCalendario) => void;
}) {
  const hoje = diaLocal(new Date(), fusoDoNavegador());
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(hoje.slice(5, 7)) - 1);
  const dias = useMemo(() => gradeDoMes(ano, mes, hoje), [ano, mes, hoje]);
  const noMes = dias.filter((d) => d.doMes).reduce((n, d) => n + (itens.get(d.data)?.length ?? 0), 0);

  function mover(delta: number) {
    const d = new Date(Date.UTC(ano, mes + delta, 1));
    setAno(d.getUTCFullYear()); setMes(d.getUTCMonth());
  }
  function irParaHoje() { setAno(Number(hoje.slice(0, 4))); setMes(Number(hoje.slice(5, 7)) - 1); }

  return (
    <section className="iv-card" aria-label="Calendário de publicações">
      <div className="ca-toolbar">
        <h3 className="ca-h3 lp-cal__titulo" aria-live="polite">{MESES[mes]} de {ano} <span className="iv-muted">· {noMes} {noMes === 1 ? 'item' : 'itens'}</span></h3>
        <div className="iv-row">
          <Button icon="pi pi-chevron-left" text size="small" aria-label="Mês anterior" onClick={() => mover(-1)} />
          <Button label="Hoje" outlined size="small" onClick={irParaHoje} />
          <Button icon="pi pi-chevron-right" text size="small" aria-label="Próximo mês" onClick={() => mover(1)} />
        </div>
      </div>
      <div className="lp-cal iv-mt" role="grid" aria-label={`${MESES[mes]} de ${ano}`}>
        {DIAS_SEMANA.map((d) => <div key={d} className="lp-cal__cab" role="columnheader">{d}</div>)}
        {dias.map((d) => {
          const doDia = itens.get(d.data) ?? [];
          return (
            <div key={d.data} className="lp-cal__dia" role="gridcell" data-fora={!d.doMes || undefined} data-hoje={d.hoje || undefined}
              aria-label={`${d.dia} de ${MESES[Number(d.data.slice(5, 7)) - 1]}${doDia.length ? `, ${doDia.length} ${doDia.length === 1 ? 'item' : 'itens'}` : ''}`}>
              <span className="lp-cal__num">{d.dia}</span>
              {doDia.map((i) => (
                <button key={i.chave} type="button" className={`lp-cal__item lp-cal__item--${i.tipo}`} onClick={() => onAbrir(i)}
                  title={`${TIPO[i.tipo].rotulo}${i.hora ? ` às ${i.hora}` : ''}: ${i.titulo}`}>
                  <i className={`pi ${TIPO[i.tipo].icone}`} aria-hidden="true" />
                  <span className="ca-sr">{TIPO[i.tipo].rotulo}: </span>
                  {i.hora && <span className="lp-cal__hora">{i.hora}</span>}
                  <span className="lp-cal__texto">{i.titulo}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <p className="lp-cal__legenda iv-muted ca-small ca-mb0">
        {(Object.keys(TIPO) as TipoItemCalendario[]).map((t) => (
          <span key={t} className={`lp-cal__item lp-cal__item--${t} lp-cal__item--legenda`}><i className={`pi ${TIPO[t].icone}`} aria-hidden="true" /> {TIPO[t].rotulo}</span>
        ))}
      </p>
    </section>
  );
}
