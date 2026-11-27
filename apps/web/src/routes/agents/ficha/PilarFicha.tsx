import { Link, useNavigate } from '@tanstack/react-router';
import { MODULO_ESTUDO_ATIVO } from '@/config/modulos';
import { Button } from 'primereact/button';
import { DetailDrawer, type DetailDrawerProps } from '@/components/ui/DetailDrawer';
import { Pill } from '@/components/InfraKit';
import type { Pilar } from '@/data/agentesPilares';
import { resumoPilares } from '../regras';
import { Linhas, Secao, Vazio, useAgentesCompletos } from './comum';

type Nav = Pick<DetailDrawerProps, 'index' | 'total' | 'onIndex' | 'onClose'>;

/** Ficha do pilar: o que checar, o erro comum e como os seus agentes estão nele. */
export function PilarFicha({ p, nav }: { p: Pilar; nav: Nav }) {
  const navigate = useNavigate();
  const completos = useAgentesCompletos(true);
  const emUso = (completos.data ?? []).filter((a) => a.status !== 'arquivado');
  const situacao = emUso.map((a) => ({ a, r: resumoPilares(a.config)[p.numero - 1] }));
  const faltando = situacao.filter((s) => !s.r.ok).length;

  return (
    <DetailDrawer {...nav} kind={{ icon: p.icone, label: `Pilar ${p.numero} de 8` }} ariaLabel={`Pilar ${p.numero}: ${p.titulo}`}
      status={<Pill label={`Aba "${p.aba}" do editor`} tone="muted" icon="pi-pencil" />}
      title={p.titulo}
      subtitle={p.pergunta}
      actions={MODULO_ESTUDO_ATIVO ? <Button label="Estudar na trilha" icon="pi pi-book" size="small" outlined
        onClick={() => navigate({ to: '/trilhas/$trilhaId', params: { trilhaId: 'agentes' } })} /> : undefined}>

      <Secao titulo="O que checar">
        <ul className="agd-checklist">{p.checklist.map((c) => <li key={c}>{c}</li>)}</ul>
      </Secao>

      <Secao titulo="Erro comum">
        <p className="agd-texto">{p.erroComum}</p>
      </Secao>

      <Secao titulo={`Seus agentes neste pilar${faltando ? ` (${faltando} com algo a fazer)` : ''}`}>
        {completos.isLoading ? <Linhas n={2} /> : completos.isError ? <Vazio>API indisponível: não dá para ver os seus agentes agora.</Vazio>
          : situacao.length === 0 ? <Vazio>Nenhum agente em uso ainda.</Vazio> : (
            <ul className="agd-lista">
              {situacao.map(({ a, r }) => (
                <li key={a.id} className="agd-item" data-falta={!r.ok || undefined}>
                  <i className={`pi ${r.ok ? 'pi-check-circle' : 'pi-exclamation-triangle'} agd-item__icone`} aria-hidden="true" />
                  <span className="agd-item__corpo">
                    <Link to="/agents/agente/$agenteId" params={{ agenteId: a.id }} className="agd-link">{a.nome}</Link>
                    {!r.ok && <span className="agd-sr"> (incompleto)</span>}
                    <small className="agd-mudo"> · {r.texto}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
      </Secao>
    </DetailDrawer>
  );
}
