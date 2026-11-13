import { Button } from 'primereact/button';
import { Pill } from '@/components/InfraKit';
import { MODELOS_AGENTE, type ModeloAgente } from '@/data/agentesModelos';

/** id usado para "em branco" no estado de criação */
export const EM_BRANCO = '__em_branco__';

interface Props {
  /** id do modelo sendo criado agora (mostra o spinner só nele) */
  criando: string | null;
  onEscolher: (modelo?: ModeloAgente) => void;
  /** mostra o cartão "Em branco" no início da grade */
  comEmBranco?: boolean;
}

function ModeloCard({ m, criando, onEscolher }: { m: ModeloAgente; criando: string | null; onEscolher: Props['onEscolher'] }) {
  const escrita = m.config.ferramentas.filter((f) => f.permissao === 'escrita').length;
  const modelo = m.config.modelo.nome && !m.config.modelo.nome.startsWith('A definir') ? m.config.modelo.nome : null;
  return (
    <article className="ag-modelo">
      <div className="iv-row iv-wrap">
        {escrita > 0
          ? <Pill label="Com ações · exige aprovação" tone="serious" icon="pi-lock" />
          : <Pill label="Somente leitura" tone="muted" icon="pi-eye" />}
      </div>
      <h4>{m.nome}</h4>
      <p>{m.resumo}</p>
      <div className="ag-modelo__meta">
        <span><i className="pi pi-wrench" aria-hidden="true" /> {m.config.ferramentas.length} {m.config.ferramentas.length === 1 ? 'ferramenta' : 'ferramentas'}</span>
        {modelo && <span className="mono">{modelo}</span>}
      </div>
      <Button label="Usar este modelo" icon="pi pi-copy" size="small" outlined
        onClick={() => onEscolher(m)} disabled={!!criando} loading={criando === m.id} aria-label={`Usar o modelo ${m.nome}`} />
    </article>
  );
}

export function ModelosGaleria({ criando, onEscolher, comEmBranco }: Props) {
  return (
    <div className="ag-modelos">
      {comEmBranco && (
        <article className="ag-modelo ag-modelo--branco">
          <i className="pi pi-file-edit" aria-hidden="true" />
          <h4>Em branco</h4>
          <p>Comece do zero e preencha os 8 pilares no editor. A revisão aponta o que falta.</p>
          <Button label="Criar em branco" icon="pi pi-plus" size="small"
            onClick={() => onEscolher()} disabled={!!criando} loading={criando === EM_BRANCO} />
        </article>
      )}
      {MODELOS_AGENTE.map((m) => <ModeloCard key={m.id} m={m} criando={criando} onEscolher={onEscolher} />)}
    </div>
  );
}
