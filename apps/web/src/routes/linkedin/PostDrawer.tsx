import { useState } from 'react';
import { Button } from 'primereact/button';
import type { PostPublicado } from '@seginfo/shared';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { getTopico, getTrilha } from '@/services/catalog';
import { CATEGORIA_DIARIO_LABEL, engajamento, taxaEngajamento, type EntradaDiarioComOrigem } from '@/services/linkedin';
import { todayISO } from '@/services/store';
import { avisoMetricas, falaDoProjeto, marcosAntesDe, METRICAS_CAMPOS, primeiraLinha } from './regras';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Ficha do post publicado: texto completo, métricas, organização da IA, ideias e marcos do diário. */
export function PostDrawer({ post: p, nav, diario, ocupado, iaPronta, onEditar, onOrganizar, onReenviar, onExcluir, onUsarIdeia }: {
  post: PostPublicado; nav: Nav; diario: EntradaDiarioComOrigem[]; ocupado?: string; iaPronta: boolean;
  onEditar: () => void; onOrganizar: () => void; onReenviar: () => void; onExcluir: () => void; onUsarIdeia: (ideia: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const a = p.analise;
  const m = p.metricas;
  const taxa = taxaEngajamento(m);
  const aviso = avisoMetricas(p, todayISO());
  const marcos = falaDoProjeto(p) ? marcosAntesDe(diario, p.publicadoEm) : [];

  function copiar() { copyToClipboard(p.texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }

  return (
    <DetailDrawer {...nav} wide kind={{ icon: 'pi-linkedin', label: 'Post publicado' }} ariaLabel={`Ficha do post de ${p.publicadoEm}`}
      status={<>
        {a ? <Pill label={a.pilar} tone="info" /> : <Pill label="Não organizado" tone="muted" icon="pi-clock" />}
        <Pill label={p.formato} />
        {p.memoriaId && <Pill label="No Segundo Cérebro" icon="pi-sitemap" tone="ok" />}
        {ocupado && <span className="iv-muted ca-small" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> {ocupado}</span>}
      </>}
      title={a?.resumo ?? primeiraLinha(p.texto)}
      subtitle={`Publicado em ${p.publicadoEm} · ${p.origem === 'importacao' ? 'importado do export do LinkedIn' : 'registrado à mão'}`}
      actions={<>
        <Button label={a ? 'Reanalisar' : 'Organizar com IA'} icon="pi pi-sparkles" size="small" outlined={!!a} disabled={!iaPronta || !!ocupado} onClick={onOrganizar}
          tooltip={!iaPronta ? 'Defina ANTHROPIC_API_KEY na API (Coolify)' : undefined} tooltipOptions={{ showOnDisabled: true }} />
        <Button label="Editar" icon="pi pi-pencil" size="small" outlined={!a} onClick={onEditar} />
        <Button label={copiado ? 'Copiado!' : 'Copiar texto'} icon="pi pi-copy" size="small" outlined onClick={copiar} />
        <a href={p.url} target="_blank" rel="noreferrer" className="p-button p-button-outlined p-button-sm"><i className="pi pi-external-link" aria-hidden="true" />&nbsp; Abrir no LinkedIn</a>
        {a && <Button label="Atualizar no cérebro" icon="pi pi-sitemap" size="small" text disabled={!!ocupado} onClick={onReenviar} />}
        <Button label="Remover" icon="pi pi-trash" size="small" text severity="danger" onClick={onExcluir} />
      </>}>

      <section>
        <h3 className="iv-section-label">Métricas</h3>
        <DetailFields items={[
          ...METRICAS_CAMPOS.map(([k, label]) => [label, m[k]?.toLocaleString('pt-BR') ?? ''] as [string, string]),
          ['Taxa de engajamento', taxa !== null ? `${taxa}% (interações ÷ impressões)` : ''],
          ['Pontos de engajamento', engajamento(m) ? `${engajamento(m)} (comentário e salvamento valem 2, compartilhamento 3)` : ''],
          ['Anotadas em', m.atualizadoEm ?? ''],
        ]} />
        {aviso && <p className="ca-aviso"><i className="pi pi-info-circle" aria-hidden="true" /> {aviso} <Button link label="Atualizar métricas" onClick={onEditar} className="ca-link-btn" /></p>}
      </section>

      {a && (
        <section>
          <h3 className="iv-section-label">Organização pela IA</h3>
          <DetailFields items={[
            ['Tipo de gancho', a.tipoGancho],
            ['Temas', a.temas.length ? <span className="iv-row iv-wrap">{a.temas.map((t) => <Pill key={t} label={t} />)}</span> : ''],
            ['No seu estudo', a.trilhaIds.length + a.topicoIds.length ? (
              <span className="iv-row iv-wrap">
                {a.trilhaIds.map((id) => <Pill key={id} label={getTrilha(id)?.titulo ?? id} icon="pi-sitemap" />)}
                {a.topicoIds.map((id) => <Pill key={id} label={getTopico(id)?.titulo ?? id} icon="pi-book" />)}
              </span>
            ) : ''],
            ['Organizado em', `${a.analisadoEm.slice(0, 10)} por ${a.modelo}`],
          ]} />
          <div className="linkedin-analise__grid iv-mt">
            <Lista titulo="Aprendizados reutilizáveis" itens={a.aprendizados} />
            <Lista titulo="Pontos fortes" itens={a.pontosFortes} />
            <Lista titulo="Para melhorar" itens={a.melhorias} />
          </div>
        </section>
      )}

      {a && a.ideiasDerivadas.length > 0 && (
        <section>
          <h3 className="iv-section-label">Ideias para os próximos posts</h3>
          <ul className="linkedin-ideias">
            {a.ideiasDerivadas.map((ideia) => (
              <li key={ideia}>
                <span>{ideia}</span>
                <Button label="Escrever" icon="pi pi-arrow-right" iconPos="right" text size="small" onClick={() => onUsarIdeia(ideia)} aria-label={`Escrever post: ${ideia}`} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {marcos.length > 0 && (
        <section>
          <h3 className="iv-section-label">Marcos do diário nos 30 dias antes</h3>
          <ul className="ca-lista">
            {marcos.map((e) => (
              <li key={e.id}><span className="iv-muted">{e.data}</span> · <strong>{e.titulo}</strong> <span className="iv-muted">({CATEGORIA_DIARIO_LABEL[e.categoria]})</span></li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="iv-section-label">Texto publicado</h3>
        <div className="ca-texto">{p.texto}</div>
      </section>
    </DetailDrawer>
  );
}

function Lista({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (!itens.length) return null;
  return (
    <div>
      <h4 className="ca-h4">{titulo}</h4>
      <ul className="ca-bullets">{itens.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}
