import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyState, Pill } from '@/components/InfraKit';
import type { Tone } from '@/theme/status';
import { COMANDOS, FERRAMENTAS, FRENTES, ROTEIROS, ROTULO_IA, filtrarFerramentas, type Ferramenta, type NivelIa } from './conhecimento/ajuda';
import { BlocoComandos } from '@/components/ComoUsar';

const TOM_IA: Record<NivelIa, Tone> = { profunda: 'ok', apoio: 'info', nenhuma: 'muted' };
const porId = new Map(FERRAMENTAS.map((f) => [f.id, f]));

function SeloIa({ nivel }: { nivel: NivelIa }) {
  return <span title={ROTULO_IA[nivel].explica}><Pill label={ROTULO_IA[nivel].rotulo} tone={TOM_IA[nivel]} icon={nivel === 'nenhuma' ? 'pi-cog' : 'pi-sparkles'} /></span>;
}

function FichaFerramenta({ f, abrir }: { f: Ferramenta; abrir: (to: string) => void }) {
  return (
    <details className="iv-card" id={`ajuda-${f.id}`} style={{ padding: '0.75rem 1rem' }}>
      <summary style={{ cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{f.nome}</strong>
        <SeloIa nivel={f.ia} />
        {f.exporta && <Pill label="Exporta HTML/PDF" icon="pi-file-export" />}
      </summary>
      <p style={{ marginTop: '0.6rem' }}>{f.resumo}</p>
      <h4 className="iv-section-label">Como usar</h4>
      <ol style={{ margin: '0.25rem 0 0.5rem 1.2rem' }}>{f.passos.map((p) => <li key={p}>{p}</li>)}</ol>
      {(COMANDOS[f.id] ?? []).length > 0 && <h4 className="iv-section-label">Comandos prontos</h4>}
      <BlocoComandos comandos={COMANDOS[f.id] ?? []} />
      <p><strong>O que você recebe:</strong> {f.resultado}</p>
      {f.limites.length > 0 && (
        <>
          <h4 className="iv-section-label">Limites (seja honesto no laudo)</h4>
          <ul style={{ margin: '0.25rem 0 0.5rem 1.2rem' }}>{f.limites.map((l) => <li key={l}>{l}</li>)}</ul>
        </>
      )}
      <div className="iv-row" style={{ gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {f.to && <Button label="Abrir" icon="pi pi-arrow-right" size="small" onClick={() => abrir(f.to!)} />}
        {f.comando && <code style={{ wordBreak: 'break-all' }}>{f.comando}</code>}
      </div>
    </details>
  );
}

export function Ajuda() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const lista = useMemo(() => filtrarFerramentas(busca), [busca]);
  const abrir = (to: string) => navigate({ to });

  return (
    <div>
      <PageHeader title="Ajuda e guia de uso"
        subtitle="O que cada ferramenta faz, como usar num teste de cliente, se usa IA de verdade e onde ela para. Só em alvos com autorização por escrito." />

      <section className="iv-mt" aria-labelledby="aj-roteiros">
        <h2 id="aj-roteiros" className="iv-section-label">Comece por aqui: roteiros de teste</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
          {ROTEIROS.map((r) => (
            <div key={r.id} className="iv-card" style={{ padding: '0.9rem 1rem' }}>
              <strong>{r.titulo}</strong>
              <p className="iv-muted" style={{ margin: '0.3rem 0 0.5rem' }}>{r.quando}</p>
              <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                {r.passos.map((p) => {
                  const f = p.ferramenta ? porId.get(p.ferramenta) : undefined;
                  return (
                    <li key={p.texto} style={{ marginBottom: '0.35rem' }}>
                      {p.texto}{' '}
                      {f && <a href={`#ajuda-${f.id}`} className="iv-muted" onClick={(e) => { e.preventDefault(); setBusca(''); document.getElementById(`ajuda-${f.id}`)?.setAttribute('open', ''); document.getElementById(`ajuda-${f.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}>({f.nome})</a>}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="iv-mt" aria-labelledby="aj-local">
        <h2 id="aj-local" className="iv-section-label">Passo a passo: varredura profunda de um repositório local (sem gastar a API)</h2>
        <div className="iv-card" style={{ padding: '0.9rem 1rem' }}>
          <ol style={{ marginTop: 0, paddingLeft: '1.2rem' }}>
            <li>Tenha o repositório clonado (ex.: <code>{'C:\\temp\\criptobrokers'}</code>) e o Claude Code instalado e logado na sua assinatura.</li>
            <li>Abra o <strong>PowerShell</strong> e rode o comando abaixo. O script cria uma cópia descartável sem push e abre o Claude Code nela — o seu clone e o GitHub não são tocados.</li>
            <li>No Claude Code, cole os prompts de <strong>Conhecimento → Prompts de pentest</strong> (comece pelo <em>Mapa da aplicação</em>, depois <em>Varredura completa — esforço alto</em>). Aceite o custo/tempo quando o plugin perguntar.</li>
            <li>Ao terminar, digite <code>/exit</code>. O script confere que o original não mudou e copia o relatório para <code>{'SegInfo-Confidencial\\varreduras'}</code> na sua pasta de usuário.</li>
            <li>Aqui no app: <strong>Inteligência → Revisão de código (IA) → Importar varredura local</strong> → escolha a pasta <code>CLAUDE-SECURITY-…</code>. Depois exporte em HTML/PDF.</li>
          </ol>
          <BlocoComandos comandos={COMANDOS.local ?? []} />
        </div>
      </section>

      <section className="iv-mt" aria-labelledby="aj-ia">
        <h2 id="aj-ia" className="iv-section-label">Onde a IA entra de verdade</h2>
        <div className="iv-card" style={{ padding: '0.9rem 1rem' }}>
          <p style={{ marginTop: 0 }}>
            Só a <strong>Revisão de código (IA)</strong> usa o modelo para raciocinar sobre o alvo — é por isso que ela acha falhas de
            autenticação, autorização e lógica que nenhum scanner de padrões acha. Scanner, testes ativos, JWT, Exposição e Reposcan são
            <strong> motores determinísticos</strong>: rápidos, baratos e repetíveis (bons para triagem e gate de CI), mas não entendem o negócio.
            O teste manual (Burp/ZAP) continua necessário para fluxos com login.
          </p>
          <div className="iv-row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            {(Object.keys(ROTULO_IA) as NivelIa[]).map((n) => (
              <span key={n} className="iv-row" style={{ gap: '0.35rem', alignItems: 'center' }}><SeloIa nivel={n} /><span className="iv-muted">{ROTULO_IA[n].explica}</span></span>
            ))}
          </div>
        </div>
      </section>

      <div className="iv-toolbar pr-toolbar iv-mt">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar ferramenta, teste ou palavra (ex.: jwt, injeção, repositório)" />
        <span className="iv-toolbar__count">{lista.length} {lista.length === 1 ? 'ferramenta' : 'ferramentas'}</span>
      </div>

      {lista.length === 0 && <div className="iv-card iv-mt"><EmptyState icon="pi-filter-slash" title="Nada encontrado" text="Tente outra palavra." /></div>}

      {FRENTES.map((fr) => {
        const itens = lista.filter((f) => f.frente === fr.id);
        if (!itens.length) return null;
        return (
          <section key={fr.id} className="iv-mt" aria-labelledby={`aj-${fr.id}`}>
            <h2 id={`aj-${fr.id}`} className="iv-section-label">{fr.titulo}</h2>
            <p className="iv-muted" style={{ margin: '0 0 0.5rem' }}>{fr.descricao}</p>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {itens.map((f) => <FichaFerramenta key={f.id} f={f} abrir={abrir} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
