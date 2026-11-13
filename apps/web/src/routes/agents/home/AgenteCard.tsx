import { Link } from '@tanstack/react-router';
import { Pill } from '@/components/InfraKit';
import { toneClass } from '@/theme/status';
import type { AgenteResumo } from '@/services/agentes';
import { STATUS_LABEL, STATUS_PILL, etapas, proximoPasso, taxaOk, tempoRelativo, TAXA_MINIMA, type ProximoPasso } from './regras';

/** Link do próximo passo: cada destino abre a tela onde ele se resolve. */
function LinkPasso({ a, p }: { a: AgenteResumo; p: ProximoPasso }) {
  const conteudo = (
    <>
      <i className={`pi ${p.icon}`} aria-hidden="true" />
      <span className="ag-passo__texto"><strong>{p.rotulo}</strong><small>{p.detalhe}</small></span>
      <i className="pi pi-angle-right ag-passo__seta" aria-hidden="true" />
    </>
  );
  const cls = `ag-passo ${toneClass(p.tone)}`;
  const params = { agenteId: a.id };
  if (p.destino === 'aprovacao' || p.destino === 'playground') {
    const exec = p.destino === 'aprovacao' ? a.aguardandoAprovacao?.maisRecente : undefined;
    return <Link to="/agents/agente/$agenteId/playground" params={params} search={{ exec }} className={cls}>{conteudo}</Link>;
  }
  if (p.destino === 'avaliacoes') return <Link to="/agents/avaliacoes" search={{ agente: a.id }} className={cls}>{conteudo}</Link>;
  return <Link to="/agents/agente/$agenteId" params={params} className={cls}>{conteudo}</Link>;
}

/** Trilha de 4 etapas (projeto → execução → avaliação → ativo). */
function Etapas({ a }: { a: AgenteResumo }) {
  const lista = etapas(a);
  const feitas = lista.filter((e) => e.feita).length;
  return (
    <div className="ag-etapas" role="img" aria-label={`Ciclo: ${feitas} de ${lista.length} etapas. ${lista.map((e) => `${e.rotulo} ${e.feita ? 'feito' : 'pendente'}`).join(', ')}.`}>
      {lista.map((e) => (
        <span key={e.rotulo} className="ag-etapa" data-feita={e.feita || undefined} title={`${e.rotulo}: ${e.dica}${e.feita ? ' ✓' : ''}`}>
          <span className="ag-etapa__barra" />
          <span className="ag-etapa__rotulo">{e.rotulo}</span>
        </span>
      ))}
    </div>
  );
}

export function AgenteCard({ a }: { a: AgenteResumo }) {
  const passo = proximoPasso(a);
  const alerta = passo && (passo.tone === 'danger' || passo.tone === 'serious');
  const taxa = taxaOk(a);
  const st = STATUS_PILL[a.status];
  const arquivado = a.status === 'arquivado';

  return (
    <article className={`iv-card ag-card ${alerta ? toneClass(passo.tone) : ''}`} data-alert={alerta || undefined} data-arquivado={arquivado || undefined}>
      <header className="ag-card__topo">
        <span className="ag-card__icone" aria-hidden="true"><i className="pi pi-sparkles" /></span>
        <div className="ag-card__titulo">
          <h3><Link to="/agents/agente/$agenteId" params={{ agenteId: a.id }}>{a.nome}</Link></h3>
          <span className="ag-card__sub">Editado {tempoRelativo(a.atualizadoEm)}</span>
        </div>
        <Pill label={STATUS_LABEL[a.status]} tone={st.tone} icon={st.icon} />
      </header>

      <p className="ag-card__resumo">{a.resumo || <span className="iv-muted">Sem descrição. Diga em uma frase o que ele resolve.</span>}</p>

      <ul className="ag-card__meta" aria-label="Resumo do agente">
        <li title="Ferramentas configuradas">
          <i className="pi pi-wrench" aria-hidden="true" />
          {a.ferramentas} {a.ferramentas === 1 ? 'ferramenta' : 'ferramentas'}
          {a.ferramentasEscrita > 0 && <span className="ag-card__escrita" title="Ferramentas que alteram o ambiente (exigem aprovação)"><i className="pi pi-lock" aria-hidden="true" />{a.ferramentasEscrita} com escrita</span>}
        </li>
        <li title={taxa === null ? 'Nenhum caso de teste registrado' : `${a.avaliacoes.ok} ok, ${a.avaliacoes.parcial} parcial, ${a.avaliacoes.falha} falha`}>
          <i className="pi pi-check-square" aria-hidden="true" />
          {taxa === null ? 'sem testes' : <span className={taxa < TAXA_MINIMA ? 'ag-card__baixo' : undefined}>{taxa}% ok · {a.avaliacoes.total}</span>}
        </li>
        <li title="Última execução no playground">
          <i className="pi pi-bolt" aria-hidden="true" />
          {a.ultimaExecucao ? `rodou ${tempoRelativo(a.ultimaExecucao.criadoEm)}` : 'nunca rodou'}
        </li>
        {a.baseTags.length > 0 && (
          <li title={`Base de conhecimento: ${a.baseTags.join(', ')}`}>
            <i className="pi pi-folder-open" aria-hidden="true" />
            {a.baseTags.length} {a.baseTags.length === 1 ? 'tag' : 'tags'} na base
          </li>
        )}
      </ul>

      {!arquivado && <Etapas a={a} />}
      {passo && <LinkPasso a={a} p={passo} />}

      <footer className="ag-card__acoes">
        <Link to="/agents/agente/$agenteId" params={{ agenteId: a.id }} className="ag-btn"><i className="pi pi-pencil" aria-hidden="true" /> Editar</Link>
        {!arquivado && (
          <Link to="/agents/agente/$agenteId/playground" params={{ agenteId: a.id }} search={{}} className="ag-btn ag-btn--primario">
            <i className="pi pi-play" aria-hidden="true" /> Executar
          </Link>
        )}
      </footer>
    </article>
  );
}
