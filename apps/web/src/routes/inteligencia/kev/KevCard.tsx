import { ClickCard } from '@/components/ui/ClickCard';
import { Pill } from '@/components/InfraKit';
import { prazoKev } from '../regras';
import type { KevLinha } from './tipos';

/** Cartão de uma vulnerabilidade do KEV; o cartão inteiro abre a ficha. */
export function KevCard({ l, hoje, selected, onOpen }: { l: KevLinha; hoje: string; selected: boolean; onOpen: () => void }) {
  const { item: i, ativos, exercicios } = l;
  const prazo = prazoKev(i.prazo, hoje);
  const validacao = exercicios[0];
  return (
    <ClickCard as="li" className="in-kev" tone={l.tone} selected={selected} onOpen={onOpen}
      label={`Abrir ficha de ${i.cve}: ${i.nome}`}>
      <div className="in-kev__topo">
        <span className="mono in-kev__cve">{i.cve}</span>
        <span className="iv-row iv-wrap">
          {ativos.length > 0 && <Pill tone="serious" icon="pi-server" label={`${ativos.length} ativo(s) possivelmente afetado(s)`} />}
          {i.ransomware && <Pill tone="danger" icon="pi-exclamation-triangle" label="Ransomware" />}
          {prazo.tone === 'serious' && <Pill tone="serious" icon="pi-clock" label={prazo.texto} />}
        </span>
      </div>
      <h3 className="in-kev__nome">{i.nome}</h3>
      <p className="in-kev__desc">{i.descricao}</p>
      <div className="in-kev__meta">
        <span><i className="pi pi-box" aria-hidden="true" /> {i.fabricante} · {i.produto}</span>
        <span className="tabular"><i className="pi pi-calendar-plus" aria-hidden="true" /> No KEV desde {i.adicionadoEm}</span>
        <span><i className="pi pi-verified" aria-hidden="true" /> {validacao ? `Validação: ${validacao.status.replaceAll('_', ' ')}` : 'Sem validação registrada'}</span>
      </div>
    </ClickCard>
  );
}
