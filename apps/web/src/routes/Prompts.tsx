import { useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyState, Pill, StatusStrip } from '@/components/InfraKit';
import { CATEGORIAS, REGRAS, filtrarPrompts, textoParaCopiar, type CategoriaPrompt, type Custo, type PromptPronto } from './conhecimento/prompts';
import { ComoUsar } from '@/components/ComoUsar';

const TOM_CUSTO: Record<Custo, 'ok' | 'warning' | 'serious'> = { baixo: 'ok', medio: 'warning', alto: 'serious' };

function CartaoPrompt({ p }: { p: PromptPronto }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoParaCopiar(p));
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <div className="iv-card" style={{ padding: '0.8rem 1rem' }}>
      <div className="iv-row iv-wrap" style={{ gap: '0.5rem', alignItems: 'center' }}>
        <strong>{p.titulo}</strong>
        {p.skill && <Pill label={p.skill} icon="pi-bolt" tone="info" />}
        <Pill label={`custo ${p.custo}`} tone={TOM_CUSTO[p.custo]} />
        {p.comRegras && <Pill label="+ regras de só-leitura" icon="pi-lock" />}
        <Button label={copiado ? 'Copiado' : 'Copiar'} icon={copiado ? 'pi pi-check' : 'pi pi-copy'} size="small" outlined
          style={{ marginLeft: 'auto' }} onClick={() => void copiar()} aria-label={`Copiar prompt: ${p.titulo}`} />
      </div>
      <p className="iv-muted" style={{ margin: '0.4rem 0' }}>{p.quando}</p>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, padding: '0.6rem', borderRadius: 6, background: 'var(--surface-ground, rgba(127,127,127,.08))', fontSize: '0.85rem' }}>{p.texto}</pre>
      {p.aviso && <StatusStrip tone="warn" icon="pi-exclamation-triangle">{p.aviso}</StatusStrip>}
    </div>
  );
}

export function Prompts() {
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState<CategoriaPrompt | null>(null);
  const lista = useMemo(() => filtrarPrompts(busca, categoria), [busca, categoria]);

  return (
    <div>
      <PageHeader title="Prompts de pentest"
        subtitle="Prontos para colar no seu Claude Code (assinatura, sem gastar a chave da API), dentro da cópia descartável que o script de varredura local abre. Os do plugin chamam as skills oficiais do claude-security." />

      <StatusStrip tone="crit" icon="pi-shield">
        <strong>Fluxo seguro:</strong> rode <code>scripts\varredura-local.ps1 -Repo C:\temp\&lt;repo&gt;</code> → cole os prompts → saia com <code>/exit</code> →
        importe a pasta do relatório em <strong>Revisão de código (IA)</strong>. O clone original não é tocado e a cópia não consegue dar push.
      </StatusStrip>

      <div className="iv-toolbar pr-toolbar iv-mt">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar prompt (ex.: idor, swap, jwt, webhook)" />
        <div className="iv-row iv-wrap" style={{ gap: '0.35rem' }}>
          <Button label="Todos" size="small" text={categoria !== null} onClick={() => setCategoria(null)} />
          {CATEGORIAS.map((c) => (
            <Button key={c.id} label={c.titulo} size="small" text={categoria !== c.id} onClick={() => setCategoria(c.id)} />
          ))}
        </div>
        <span className="iv-toolbar__count">{lista.length} prompt(s)</span>
      </div>

      {lista.length === 0 && <div className="iv-card iv-mt"><EmptyState icon="pi-filter-slash" title="Nenhum prompt" text="Tente outra palavra ou categoria." /></div>}

      {CATEGORIAS.map((c) => {
        const itens = lista.filter((p) => p.categoria === c.id);
        if (!itens.length) return null;
        return (
          <section key={c.id} className="iv-mt" aria-labelledby={`pr-${c.id}`}>
            <h2 id={`pr-${c.id}`} className="iv-section-label">{c.titulo}</h2>
            <p className="iv-muted" style={{ margin: '0 0 0.5rem' }}>{c.descricao}</p>
            <div style={{ display: 'grid', gap: '0.6rem' }}>{itens.map((p) => <CartaoPrompt key={p.id} p={p} />)}</div>
          </section>
        );
      })}

      <details className="iv-card iv-mt" style={{ padding: '0.8rem 1rem' }}>
        <summary style={{ cursor: 'pointer' }}><strong>Regras anexadas aos prompts de análise</strong></summary>
        <pre style={{ whiteSpace: 'pre-wrap', margin: '0.5rem 0 0', fontSize: '0.85rem' }}>{REGRAS}</pre>
      </details>
      <ComoUsar rota="/prompts" />
    </div>
  );
}
