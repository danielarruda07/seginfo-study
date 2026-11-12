import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Chip, Kpi, Pill, StatusStrip } from '@/components/InfraKit';
import {
  CATEGORIA_LABEL, FERRAMENTAS_CATALOGO, REGRAS_FERRAMENTAS, RISCO_COR, RISCO_LABEL,
  type CategoriaFerramenta, type Risco,
} from '@/data/agentesFerramentas';

export function AgentsFerramentas() {
  const [categoria, setCategoria] = useState<CategoriaFerramenta | undefined>();
  const [risco, setRisco] = useState<Risco | undefined>();

  const itens = FERRAMENTAS_CATALOGO.filter((f) => (!categoria || f.categoria === categoria) && (!risco || f.risco === risco));
  const categorias = Object.keys(CATEGORIA_LABEL) as CategoriaFerramenta[];
  const contar = (r: Risco) => FERRAMENTAS_CATALOGO.filter((f) => f.risco === r).length;

  return (
    <div>
      <PageHeader
        title="Ferramentas e integrações"
        subtitle="O que um agente pode fazer no mundo, e o que cuidar em cada caso. Você adiciona ferramentas ao agente na aba 4 do editor."
      />

      <StatusStrip tone="warn" icon="pi-shield">
        Cada ferramenta amplia o que o agente alcança e o que um ataque de prompt injection consegue fazer. Comece em leitura e dê escrita só com aprovação humana.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="No catálogo" value={FERRAMENTAS_CATALOGO.length} />
        <Kpi label="Risco baixo" value={contar('baixo')} active={risco === 'baixo'} onClick={() => setRisco(risco === 'baixo' ? undefined : 'baixo')} />
        <Kpi label="Risco médio" value={contar('medio')} active={risco === 'medio'} onClick={() => setRisco(risco === 'medio' ? undefined : 'medio')} />
        <Kpi label="Risco alto" value={contar('alto')} active={risco === 'alto'} onClick={() => setRisco(risco === 'alto' ? undefined : 'alto')} />
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .5rem' }}>Regras de ouro</h4>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {REGRAS_FERRAMENTAS.map((r) => <li key={r} style={{ marginBottom: '.25rem' }}>{r}</li>)}
        </ul>
      </div>

      <div className="iv-row iv-wrap iv-mt">
        <span className="iv-muted" style={{ fontSize: '.8rem' }}>Categoria:</span>
        {categorias.map((c) => (
          <Chip key={c} label={CATEGORIA_LABEL[c]} active={categoria === c} onClick={() => setCategoria(categoria === c ? undefined : c)} />
        ))}
      </div>

      <div className="grid-cards iv-mt">
        {itens.map((f) => (
          <div key={f.id} className="iv-card">
            <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
              <Pill label={CATEGORIA_LABEL[f.categoria]} color="#64748b" />
              <Pill label={`risco ${RISCO_LABEL[f.risco].toLowerCase()}`} color={RISCO_COR[f.risco]} />
            </div>
            <h4 style={{ margin: '.6rem 0 .25rem', color: 'var(--alvoar-navy)' }}>{f.nome}</h4>
            <p style={{ margin: '0 0 .5rem', fontSize: '.88rem' }}>{f.descricao}</p>
            <div className="iv-row iv-wrap" style={{ marginBottom: '.5rem' }}>
              <Pill label={f.permissaoSugerida === 'escrita' ? 'escrita' : 'leitura'} color={f.permissaoSugerida === 'escrita' ? '#ef4444' : '#16a34a'} />
              {f.aprovacaoSugerida && <Pill label="exige aprovação humana" color="#7c3aed" />}
            </div>
            <p className="iv-muted" style={{ margin: 0, fontSize: '.83rem' }}><strong>Cuidados:</strong> {f.cuidados}</p>
          </div>
        ))}
        {itens.length === 0 && <p className="iv-muted">Nenhuma ferramenta para esses filtros.</p>}
      </div>
    </div>
  );
}
