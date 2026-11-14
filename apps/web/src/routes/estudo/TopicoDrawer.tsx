import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputTextarea } from 'primereact/inputtextarea';
import type { StatusEstudo } from '@seginfo/shared';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailCard, DetailFields, DetailSection } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { agendarRevisao, getTrilha, setAnotacao, setStatus, type TopicoComStatus } from '@/services/catalog';
import { listLabs } from '@/services/inventario';
import { listPosts } from '@/services/sessoes';
import { DOMINIO_LAB, REFERENCIA_LABEL, STATUS_ESTUDO_OPTS } from '@/theme/status';
import { useBaseEstudo, useInvalidarEstudo } from './dados';
import { ListaMetas, ListaSessoes, MiniLista } from './Listas';
import { SessaoRapida } from './SessaoRapida';
import { formatarMinutos, NIVEL_LABEL, proximaAcaoTopico, resumoSessoes, revisaoPendente, STATUS_TOPICO, textoRevisao } from './regras';

interface Nav { index: number; total: number; onIndex: (i: number) => void; onClose: () => void }

/** Ficha do tópico: próximo passo, revisão, histórico de sessões, prática relacionada, conteúdo e anotações. */
export function TopicoDrawer({ topico, nav, naTrilha }: { topico: TopicoComStatus; nav: Nav; naTrilha?: boolean }) {
  const base = useBaseEstudo();
  const invalidar = useInvalidarEstudo();
  const navigate = useNavigate();
  const trilha = getTrilha(topico.trilhaId);
  const st = STATUS_TOPICO[topico.status];
  const acao = proximaAcaoTopico(topico.status);
  const revisao = base.revisoes[topico.id];
  const pendente = revisaoPendente(revisao, base.hoje);
  const sessoes = base.sessoes.filter((s) => s.topicoId === topico.id);
  const tempo = resumoSessoes(sessoes);
  const labs = listLabs().filter((l) => l.topicoId === topico.id);
  const posts = listPosts().filter((p) => p.topicoId === topico.id);
  const metas = base.metas.filter((m) => m.trilhaId === topico.trilhaId && !m.concluida);

  function mudarStatus(s: StatusEstudo) { setStatus(topico.id, s); invalidar(); }
  function revisar() { agendarRevisao(topico.id); invalidar(); }

  return (
    <DetailDrawer
      {...nav}
      kind={{ icon: 'pi-book', label: 'Tópico' }}
      ariaLabel={`Ficha do tópico ${topico.titulo}`}
      status={<>
        <Pill label={st.label} tone={st.tone} icon={st.icon} />
        <Pill label={NIVEL_LABEL[topico.nivel]} />
        {pendente && <Pill label="Revisar hoje" tone="warning" icon="pi-history" />}
      </>}
      title={topico.titulo}
      subtitle={topico.resumo}
      actions={<>
        <Button label={acao.label} icon={`pi ${acao.icon}`} onClick={() => mudarStatus(acao.status)} />
        {(pendente || topico.status === 'concluido') && <Button label="Revisei agora" icon="pi pi-history" outlined onClick={revisar} />}
        {!naTrilha && trilha && <Button label="Ver na trilha" icon="pi pi-sitemap" outlined onClick={() => navigate({ to: '/trilhas/$trilhaId', params: { trilhaId: trilha.id } })} />}
      </>}
    >
      <section>
        <h3 className="iv-section-label">Situação</h3>
        <DetailFields items={[
          ['Status', <Dropdown key="s" value={topico.status} options={STATUS_ESTUDO_OPTS} onChange={(e) => mudarStatus(e.value)} aria-label="Status do tópico" className="es-status-dd" />],
          ['Trilha', trilha ? <Link to="/trilhas/$trilhaId" params={{ trilhaId: trilha.id }}>{trilha.titulo}</Link> : ''],
          ['Revisão espaçada', textoRevisao(revisao, base.hoje)],
          ['Tempo dedicado', tempo.quantidade ? `${formatarMinutos(tempo.minutos)} em ${tempo.quantidade} ${tempo.quantidade === 1 ? 'sessão' : 'sessões'}` : 'Nenhuma sessão registrada'],
          ['Tags', topico.tags.length ? <span className="iv-row iv-wrap">{topico.tags.map((t) => <Pill key={t} label={t} />)}</span> : ''],
        ]} />
        <p className="es-hint">A revisão espaçada aumenta o intervalo a cada retorno (1, 3, 7, 14 e 30 dias). Use “Revisei agora” depois de revisar.</p>
      </section>

      <TopicoAnotacao key={topico.id} topicoId={topico.id} inicial={base.anotacoes[topico.id] ?? ''} />

      <section>
        <h3 className="iv-section-label">Histórico de estudo</h3>
        <ListaSessoes sessoes={sessoes} contexto="topico" />
        <SessaoRapida trilhaId={topico.trilhaId} topicoId={topico.id} />
      </section>

      {(labs.length > 0 || posts.length > 0 || metas.length > 0) && (
        <section>
          <h3 className="iv-section-label">Pratique e compartilhe</h3>
          {labs.length > 0 && (
            <MiniLista vazio="">
              {labs.map((l) => (
                <li key={l.id} className="es-mini__item">
                  <span className="es-mini__main"><Link to="/labs">{l.titulo}</Link><small>{l.objetivo}</small></span>
                  <Pill label={DOMINIO_LAB[l.dominio].label} color={DOMINIO_LAB[l.dominio].color} />
                </li>
              ))}
            </MiniLista>
          )}
          {posts.length > 0 && (
            <MiniLista vazio="">
              {posts.map((p) => (
                <li key={p.id} className="es-mini__item">
                  <span className="es-mini__main"><Link to="/posts">{p.titulo}</Link><small>Ideia de post</small></span>
                  <Pill label={p.publicado ? 'Publicado' : 'Rascunho'} tone={p.publicado ? 'ok' : undefined} />
                </li>
              ))}
            </MiniLista>
          )}
          {metas.length > 0 && <><h4 className="es-subhead">Metas abertas desta trilha</h4><ListaMetas metas={metas} hoje={base.hoje} /></>}
        </section>
      )}

      {topico.conceitosChave.length > 0 && (
        <section><DetailSection title="Conceitos-chave">
          <div className="iv-row iv-wrap">{topico.conceitosChave.map((c) => <Pill key={c} label={c} />)}</div>
        </DetailSection></section>
      )}

      {(topico.mitre ?? []).length > 0 && (
        <section><DetailSection title="Técnicas MITRE ATT&CK">
          <div className="iv-row iv-wrap">{(topico.mitre ?? []).map((t) => <Link key={t} to="/attack" className="es-plainlink"><Pill label={t} icon="pi-external-link" /></Link>)}</div>
        </DetailSection></section>
      )}

      {topico.ferramentas.length > 0 && (
        <section><DetailSection title="Ferramentas de referência">
          <div className="iv-col">
            {topico.ferramentas.map((f) => {
              const ref = REFERENCIA_LABEL[f.referencia];
              return <DetailCard key={f.nome} title={f.url ? <a href={f.url} target="_blank" rel="noreferrer">{f.nome}</a> : f.nome} aside={<Pill label={ref?.label} color={ref?.color} />} description={f.descricao} />;
            })}
          </div>
        </DetailSection></section>
      )}

      {topico.recursos.length > 0 && (
        <section><DetailSection title="Recursos para estudar">
          <MiniLista vazio="">
            {topico.recursos.map((r) => (
              <li key={r.url} className="es-mini__item">
                <span className="es-mini__main"><a href={r.url} target="_blank" rel="noreferrer">{r.titulo} <i className="pi pi-external-link" aria-hidden="true" /></a></span>
                <span className="es-mini__aside">{r.tipo}</span>
              </li>
            ))}
          </MiniLista>
        </DetailSection></section>
      )}
    </DetailDrawer>
  );
}

function TopicoAnotacao({ topicoId, inicial }: { topicoId: string; inicial: string }) {
  const invalidar = useInvalidarEstudo();
  const [nota, setNota] = useState(inicial);
  const [salvo, setSalvo] = useState('');
  const alterada = nota !== inicial;
  return (
    <section>
      <h3 className="iv-section-label"><label htmlFor={`nota-${topicoId}`}>Minhas anotações</label></h3>
      <InputTextarea id={`nota-${topicoId}`} value={nota} onChange={(e) => { setNota(e.target.value); setSalvo(''); }} rows={4} autoResize className="es-full"
        placeholder="Insights, comandos, ganchos para posts no LinkedIn..." />
      <div className="iv-row es-mt-sm">
        <Button label="Salvar anotação" icon="pi pi-save" size="small" outlined disabled={!alterada}
          onClick={() => { setAnotacao(topicoId, nota); setSalvo('Anotação salva.'); invalidar(); }} />
        <small className="es-quick__aviso" role="status">{salvo}</small>
      </div>
    </section>
  );
}
