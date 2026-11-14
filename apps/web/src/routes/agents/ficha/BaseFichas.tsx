import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import type { AgenteResumo, TrechoBase } from '@/services/agentes';
import { STATUS_LABEL } from '../home/regras';
import { Secao, Vazio } from './comum';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Trecho recuperado da base: o texto completo exatamente como o agente recebe. */
export function TrechoFicha({ t, agenteNome, pergunta, nav }: { t: TrechoBase & { id: string }; agenteNome?: string; pergunta: string; nav: Nav }) {
  const navigate = useNavigate();
  return (
    <DetailDrawer {...nav} kind={{ icon: 'pi-file', label: 'Trecho recuperado' }} ariaLabel={`Trecho de ${t.titulo}`}
      status={<Pill label={`Relevância ${t.score}`} tone="muted" icon="pi-sort-amount-down" />}
      title={t.titulo}
      subtitle={agenteNome ? `Contexto que ${agenteNome} receberia para "${pergunta}"` : undefined}
      actions={<>
        <Button label="Abrir no Segundo Cérebro" icon="pi pi-external-link" size="small" onClick={() => navigate({ to: '/cerebro' })} />
        <Button label="Copiar trecho" icon="pi pi-copy" size="small" outlined onClick={() => copyToClipboard(t.trecho)} />
      </>}>
      <Secao titulo="Trecho">
        <p className="agd-texto">{t.trecho}</p>
      </Secao>
      <Secao titulo="Origem">
        <DetailFields items={[
          ['Nota', t.titulo],
          ['Tags', t.tags.length ? <span className="iv-row iv-wrap">{t.tags.map((x) => <Pill key={x} label={`#${x}`} tone="muted" />)}</span> : ''],
          ['Relevância', String(t.score)],
        ]} />
        <p className="agd-mudo iv-mt">O agente trata este texto como dado, não como instrução. Se o trecho não ajuda a responder, revise as tags da nota ou da base.</p>
      </Secao>
    </DetailDrawer>
  );
}

export interface LinhaTag { id: string; tag: string; total: number; agentes: AgenteResumo[] }

/** Tag da base: quantas notas e quais agentes a enxergam. */
export function TagFicha({ l, nav, onTestar }: { l: LinhaTag; nav: Nav; onTestar: (agenteId: string) => void }) {
  const navigate = useNavigate();
  return (
    <DetailDrawer {...nav} kind={{ icon: 'pi-hashtag', label: 'Tag da base' }} ariaLabel={`Tag ${l.tag}`}
      status={l.agentes.length ? <Pill label={`${l.agentes.length} agente(s)`} tone="muted" icon="pi-sparkles" /> : <Pill label="Sem agente" tone="muted" />}
      title={`#${l.tag}`}
      subtitle={`${l.total} nota(s) pessoal(is) do Segundo Cérebro`}
      actions={<Button label="Abrir no Segundo Cérebro" icon="pi pi-external-link" size="small" outlined
        onClick={() => navigate({ to: '/cerebro' })} />}>
      <Secao titulo="Agentes que consultam esta tag">
        {l.agentes.length === 0 ? <Vazio>Nenhum agente usa esta tag. Ligue-a na aba Memória do editor de um agente.</Vazio> : (
          <ul className="agd-lista">
            {l.agentes.map((a) => (
              <li key={a.id} className="agd-item">
                <i className="pi pi-sparkles agd-item__icone" aria-hidden="true" />
                <span className="agd-item__corpo">
                  <Link to="/agents/agente/$agenteId" params={{ agenteId: a.id }} className="agd-link">{a.nome}</Link>
                  <small className="agd-mudo"> · {STATUS_LABEL[a.status]} · base com {a.baseTags.length} tag(s)</small>
                </span>
                <Button label="Testar" icon="pi pi-search" text size="small" onClick={() => onTestar(a.id)} aria-label={`Testar a recuperação de ${a.nome}`} />
              </li>
            ))}
          </ul>
        )}
      </Secao>
      <Secao titulo="Regras">
        <DetailFields items={[
          ['Notas corporativas', 'Nunca entram na base, mesmo com a tag'],
          ['Uso pelo agente', 'Texto recuperado é dado, não instrução'],
        ]} />
      </Secao>
    </DetailDrawer>
  );
}
