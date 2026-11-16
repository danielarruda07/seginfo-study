import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Kpi, StatusStrip, Chip, EmptyState } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { useDebounce } from '@/hooks/useDebounce';
import { getKev, getTermos, setTermos } from '@/services/kev';
import { listAtivos } from '@/services/inventario';
import { listPurpleExercises } from '@/services/exerciciosPurple';
import { ativosRelacionados, exerciciosDoCve, kevCasaBusca, ordenarKev, tomKev } from './inteligencia/regras';
import type { KevLinha } from './inteligencia/kev/tipos';
import { KevCard } from './inteligencia/kev/KevCard';
import { KevDrawer } from './inteligencia/kev/KevDrawer';
import { ProdutosAcompanhados } from './inteligencia/kev/ProdutosAcompanhados';
import '@/styles/telas/inteligencia.css';

const PERIODOS = [
  { dias: 30, label: '30 dias' },
  { dias: 90, label: '90 dias' },
  { dias: 365, label: '1 ano' },
  { dias: 0, label: 'Tudo' },
];
type Recorte = 'ativos' | 'ransomware' | 'recentes';
const RECORTE_LABEL: Record<Recorte, string> = { ativos: 'Com ativo possivelmente afetado', ransomware: 'Usadas por ransomware', recentes: 'Entraram nos últimos 30 dias' };

export function Ameacas() {
  const [termos, setTermosState] = useState<string[]>(getTermos);
  const [dias, setDias] = useState(90);
  const [termoFiltro, setTermoFiltro] = useState<string | null>(null);
  const [recorte, setRecorte] = useState<Recorte | null>(null);
  const [buscaRaw, setBuscaRaw] = useState('');
  const busca = useDebounce(buscaRaw, 300);

  const kev = useQuery({ queryKey: ['kev', termos, dias], queryFn: () => getKev(termos, dias), enabled: termos.length > 0, retry: false, staleTime: 3_600_000 });
  const salvar = (lista: string[]) => { setTermos(lista); setTermosState(getTermos()); setTermoFiltro(null); };

  const hoje = new Date().toISOString().slice(0, 10);
  const corte30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  // cruza cada item com inventário e exercícios uma vez só
  const todas = useMemo<KevLinha[]>(() => {
    const ativos = listAtivos({ rows: 10_000 }).items;
    const exercicios = listPurpleExercises();
    return ordenarKev((kev.data?.itens ?? []).map((item) => {
      const rel = ativosRelacionados(item, ativos);
      return { id: item.cve, item, ativos: rel, exercicios: exerciciosDoCve(item.cve, exercicios), tone: tomKev(item.ransomware, rel.length) };
    }));
  }, [kev.data]);

  const doProduto = useMemo(() => todas.filter((l) => !termoFiltro || l.item.termo === termoFiltro.toLowerCase()), [todas, termoFiltro]);
  const lista = useMemo(() => doProduto.filter((l) => kevCasaBusca(l.item, busca) && (
    !recorte || (recorte === 'ativos' ? l.ativos.length > 0 : recorte === 'ransomware' ? l.item.ransomware : l.item.adicionadoEm >= corte30)
  )), [doProduto, busca, recorte, corte30]);
  const sel = useDrawerSelection(lista);

  const conta = (p: (l: KevLinha) => boolean) => doProduto.filter(p).length;
  const alternar = (r: Recorte) => setRecorte(recorte === r ? null : r);
  const limpar = () => { setTermoFiltro(null); setRecorte(null); setBuscaRaw(''); };
  const chips = [
    termoFiltro && { key: 'produto', label: `Produto: ${termoFiltro}`, onRemove: () => setTermoFiltro(null) },
    recorte && { key: 'recorte', label: RECORTE_LABEL[recorte], onRemove: () => setRecorte(null) },
    busca && { key: 'busca', label: `Busca: ${busca}`, onRemove: () => setBuscaRaw('') },
  ];

  return (
    <div>
      <PageHeader title="Ameaças (CISA KEV)"
        subtitle="Vulnerabilidades exploradas ativamente que afetam os produtos que você usa. Priorize estas antes do resto."
        actions={<span className="in-periodo" role="group" aria-label="Entraram no catálogo em">
          {PERIODOS.map((p) => <Chip key={p.dias} label={p.label} active={dias === p.dias} onClick={() => setDias(p.dias)} />)}
        </span>} />

      {kev.isError && (
        <StatusStrip tone="crit" icon="pi-exclamation-triangle">
          Não foi possível consultar o catálogo. Esta página precisa da API (modo servidor) e de acesso à internet no servidor.{' '}
          <button type="button" className="iv-linkbtn" onClick={() => void kev.refetch()}>Tentar de novo</button>
        </StatusStrip>
      )}
      {kev.data?.desatualizado && <StatusStrip tone="warn" icon="pi-clock">A CISA não respondeu agora; mostrando o último catálogo baixado.</StatusStrip>}

      <div className="iv-kpis iv-mt">
        <Kpi label="Encontradas" icon="pi-shield" onClick={limpar} value={kev.isLoading ? '…' : doProduto.length} hint={kev.data ? `de ${kev.data.totalCatalogo} no catálogo` : undefined} />
        <Kpi label="Ativo possivelmente afetado" icon="pi-server" tone="serious" value={conta((l) => l.ativos.length > 0)} hint="sugestão por nome/tag"
          active={recorte === 'ativos'} onClick={() => alternar('ativos')} />
        <Kpi label="Usadas por ransomware" icon="pi-exclamation-triangle" tone="danger" value={conta((l) => l.item.ransomware)} hint="campanhas conhecidas"
          active={recorte === 'ransomware'} onClick={() => alternar('ransomware')} />
        <Kpi label="Últimos 30 dias" icon="pi-calendar-plus" value={conta((l) => l.item.adicionadoEm >= corte30)} hint="entraram recentemente"
          active={recorte === 'recentes'} onClick={() => alternar('recentes')} />
      </div>

      <section className="iv-card iv-mt" aria-labelledby="kev-lista">
        <h3 id="kev-lista" className="iv-section-label">Vulnerabilidades</h3>
        <ProdutosAcompanhados termos={termos} filtro={termoFiltro} onFiltro={setTermoFiltro} onSalvar={salvar}
          contagem={(t) => (kev.data ? todas.filter((l) => l.item.termo === t.toLowerCase()).length : undefined)} />
        <div className="iv-toolbar iv-mt">
          <SearchInput value={buscaRaw} onChange={setBuscaRaw} placeholder="Buscar CVE, nome, fabricante ou produto" />
          <span className="iv-toolbar__count">
            {lista.length} {lista.length === 1 ? 'vulnerabilidade' : 'vulnerabilidades'}
            {kev.data && <span className="iv-hide-sm"> · catálogo {kev.data.versao} ({kev.data.publicadoEm.slice(0, 10)})</span>}
          </span>
        </div>
        <ActiveFiltersBar filters={chips} onClearAll={limpar} />

        {termos.length === 0 ? <EmptyState icon="pi-box" title="Nenhum produto acompanhado" text="Adicione os produtos e fabricantes que existem no seu ambiente." />
          : kev.isLoading ? <p className="in-muted-p" role="status">Consultando o catálogo da CISA…</p>
          : kev.data && lista.length === 0 ? (chips.some(Boolean)
            ? <EmptyState icon="pi-filter-slash" title="Nenhuma vulnerabilidade com estes filtros" action={<Button label="Limpar filtros" text onClick={limpar} />} />
            : <EmptyState icon="pi-check-circle" title="Nada explorado ativamente no período" text="Nenhuma entrada do KEV para esses produtos. Amplie o período para ver o histórico." />)
          : (
            <ul className="in-kev-lista">
              {lista.map((l) => <KevCard key={l.id} l={l} hoje={hoje} selected={sel.isOpen(l.id)} onOpen={() => sel.open(l.id)} />)}
            </ul>
          )}
      </section>

      {sel.item && <KevDrawer l={sel.item} hoje={hoje} nav={sel.nav} />}
    </div>
  );
}
