import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { ClickCard } from '@/components/ui/ClickCard';
import { EmptyState, Kpi, Pill, StatusStrip } from '@/components/InfraKit';
import { useDebounce } from '@/hooks/useDebounce';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { getRuntime } from '@/services/agentes';
import {
  CATEGORIA_LABEL, FERRAMENTAS_CATALOGO, REGRAS_FERRAMENTAS, RISCO_LABEL,
  type CategoriaFerramenta, type Risco,
} from '@/data/agentesFerramentas';
import { ESTADO_SERVIDOR, RISCO_TONE, filtrarFerramentas, noServidor } from './regras';
import { MetaPill } from './ficha/comum';
import { FerramentaFicha } from './ficha/FerramentaFicha';
import '@/styles/telas/agents.css';
import { GuiaDaTela } from './guia/GuiaDaTela';

const CATEGORIAS = (Object.keys(CATEGORIA_LABEL) as CategoriaFerramenta[]).map((c) => ({ label: CATEGORIA_LABEL[c], value: c }));
const RISCOS: Risco[] = ['alto', 'medio', 'baixo'];

export function AgentsFerramentas() {
  const runtime = useQuery({ queryKey: ['agentes-runtime'], queryFn: getRuntime, staleTime: 60_000 });
  const [categoria, setCategoria] = useState<CategoriaFerramenta | undefined>();
  const [risco, setRisco] = useState<Risco | undefined>();
  const [faltaConfig, setFaltaConfig] = useState(false);
  const [busca, setBusca] = useState('');
  const buscaD = useDebounce(busca, 300);

  const rt = runtime.data?.ferramentas;
  const itens = useMemo(() => filtrarFerramentas(FERRAMENTAS_CATALOGO, { categoria, risco, faltaConfig, busca: buscaD }, rt),
    [categoria, risco, faltaConfig, buscaD, rt]);
  const sel = useDrawerSelection(itens);
  const contar = (r: Risco) => FERRAMENTAS_CATALOGO.filter((f) => f.risco === r).length;
  const nFalta = FERRAMENTAS_CATALOGO.filter((f) => noServidor(rt, f.id).estado === 'falta-config').length;
  const nProntas = FERRAMENTAS_CATALOGO.filter((f) => noServidor(rt, f.id).estado === 'pronta').length;
  const limpar = () => { setCategoria(undefined); setRisco(undefined); setFaltaConfig(false); setBusca(''); };

  return (
    <div>
      <PageHeader
        title="Ferramentas e integrações"
        subtitle="O que um agente pode fazer no mundo e o que cuidar em cada caso. Clique numa ferramenta para ver o estado no servidor e quem a usa."
      />
      <GuiaDaTela tela="ferramentas" />

      <StatusStrip tone="warn" icon="pi-shield">
        Cada ferramenta amplia o que o agente alcança e o que um ataque de prompt injection consegue fazer. Comece em leitura e dê escrita só com aprovação humana.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        {RISCOS.map((r) => (
          <Kpi key={r} label={`Risco ${RISCO_LABEL[r].toLowerCase()}`} icon="pi-shield" value={contar(r)}
            tone={r === 'alto' ? 'danger' : undefined} active={risco === r} onClick={() => setRisco(risco === r ? undefined : r)} />
        ))}
        <Kpi label="Executam no servidor" icon="pi-server" value={runtime.data ? nProntas : '—'} hint={runtime.isError ? 'API indisponível' : 'prontas para o playground'} />
        <Kpi label="Falta configurar" icon="pi-exclamation-triangle" value={runtime.data ? nFalta : '—'} tone="serious"
          hint="variáveis ausentes na API" active={faltaConfig} onClick={() => setFaltaConfig(!faltaConfig)} />
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar por nome, descrição ou cuidado" />
          <Dropdown value={categoria} options={CATEGORIAS} onChange={(e) => setCategoria(e.value ?? undefined)} placeholder="Categoria"
            showClear aria-label="Filtrar por categoria" />
          <span className="iv-toolbar__count">{itens.length} de {FERRAMENTAS_CATALOGO.length}</span>
        </div>
        <ActiveFiltersBar onClearAll={limpar} filters={[
          categoria && { key: 'cat', label: CATEGORIA_LABEL[categoria], onRemove: () => setCategoria(undefined) },
          risco && { key: 'risco', label: `Risco ${RISCO_LABEL[risco].toLowerCase()}`, onRemove: () => setRisco(undefined) },
          faltaConfig && { key: 'falta', label: 'Falta configurar', onRemove: () => setFaltaConfig(false) },
          buscaD.trim() && { key: 'busca', label: `"${buscaD.trim()}"`, onRemove: () => setBusca('') },
        ]} />

        {itens.length === 0 ? (
          <EmptyState icon="pi-filter-slash" title="Nenhuma ferramenta nesta visão" text="Mude o filtro ou a busca."
            action={<Button label="Limpar filtros" text size="small" onClick={limpar} />} />
        ) : (
          <div className="ag-cards">
            {itens.map((f) => {
              const srv = noServidor(rt, f.id);
              return (
                <ClickCard key={f.id} onOpen={() => sel.open(f.id)} label={`Abrir a ficha de ${f.nome}`} selected={sel.isOpen(f.id)}
                  tone={srv.estado === 'falta-config' ? 'serious' : undefined}>
                  <div className="ag-cardx__topo">
                    <span className="ag-rotulo">{CATEGORIA_LABEL[f.categoria]}</span>
                    <Pill label={`Risco ${RISCO_LABEL[f.risco].toLowerCase()}`} tone={RISCO_TONE[f.risco]} />
                  </div>
                  <h3 className="ag-cardx__titulo">{f.nome}</h3>
                  <p className="ag-cardx__texto ag-cardx__clamp">{f.descricao}</p>
                  <div className="ag-cardx__pe">
                    <Pill label={f.permissaoSugerida === 'escrita' ? 'Escrita' : 'Leitura'} tone={f.permissaoSugerida === 'escrita' ? 'info' : 'muted'}
                      icon={f.permissaoSugerida === 'escrita' ? 'pi-pencil' : 'pi-eye'} />
                    {f.aprovacaoSugerida && <Pill label="Aprovação humana" tone="muted" icon="pi-lock" />}
                    {runtime.data && srv.estado !== 'so-projeto' && <MetaPill m={ESTADO_SERVIDOR[srv.estado]} />}
                  </div>
                </ClickCard>
              );
            })}
          </div>
        )}
      </div>

      <div className="iv-card iv-mt ag-bloco">
        <h3>Regras de ouro</h3>
        <ul>{REGRAS_FERRAMENTAS.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>

      {sel.item && <FerramentaFicha f={sel.item} runtime={runtime.data} nav={sel.nav} />}
    </div>
  );
}
