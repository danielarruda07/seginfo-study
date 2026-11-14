import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import type { RangeAlvo } from '@seginfo/shared';
import { ClickCard } from '@/components/ui/ClickCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { EmptyState, Pill } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { useDebounce } from '@/hooks/useDebounce';
import { listRangeAlvos } from '@/services/range';
import { CATEGORIA_RANGE_LABEL, DOMINIO_LAB } from '@/theme/status';
import { DominioPill } from '../pratica/Blocos';
import { combina } from '../pratica/relacoes';
import { CATEGORIA_ICON } from './meta';
import { AlvoDrawer } from './AlvoDrawer';

type Dominio = RangeAlvo['dominio'];
const DOMINIO_OPTS = (['blue', 'red', 'purple', 'infra'] as Dominio[]).map((value) => ({ value, label: DOMINIO_LAB[value].label }));

/** Aba "Alvos do range": VMs, serviços e segmentos expostos de propósito; cada um abre a ficha. */
export function AlvosPanel({ prepPct, onVerChecklist }: { prepPct: number; onVerChecklist: () => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['range-alvos'], queryFn: listRangeAlvos });
  const [dominio, setDominio] = useState<Dominio | undefined>();
  const [busca, setBusca] = useState('');
  const search = useDebounce(busca);

  const alvos = useMemo(() => (data ?? []).filter((a) => (!dominio || a.dominio === dominio) &&
    combina(search, a.nome, a.descricao, CATEGORIA_RANGE_LABEL[a.categoria], ...a.portas, ...a.ferramentas)), [data, dominio, search]);
  const sel = useDrawerSelection(alvos);
  const limpar = () => { setDominio(undefined); setBusca(''); };

  return (
    <div>
      <div className="iv-toolbar pr-toolbar">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar VM, porta, serviço ou ferramenta" />
        <Dropdown value={dominio} options={DOMINIO_OPTS} onChange={(e) => setDominio(e.value)} placeholder="Todos os domínios" showClear aria-label="Domínio" />
        <span className="iv-toolbar__count">{alvos.length} {alvos.length === 1 ? 'alvo' : 'alvos'}</span>
      </div>
      <ActiveFiltersBar onClearAll={limpar} filters={[
        dominio && { key: 'dominio', label: DOMINIO_LAB[dominio].label, onRemove: () => setDominio(undefined) },
        search && { key: 'busca', label: `“${search}”`, onRemove: () => setBusca('') },
      ]} />

      {alvos.length === 0 && !isLoading ? (
        <EmptyState icon="pi-filter-slash" title="Nenhum alvo com estes filtros" action={<Button label="Limpar filtros" text onClick={limpar} />} />
      ) : (
        <div className="pr-grid">
          {alvos.map((a) => (
            <ClickCard key={a.id} className="pr-card" onOpen={() => sel.open(a.id)} selected={sel.isOpen(a.id)} label={`Abrir ficha do alvo ${a.nome}`}>
              <div className="pr-card__top">
                <DominioPill dominio={a.dominio} />
                <Pill label={CATEGORIA_RANGE_LABEL[a.categoria]} icon={CATEGORIA_ICON[a.categoria]} />
              </div>
              <h3 className="pr-card__title">{a.nome}</h3>
              <p className="pr-card__desc">{a.descricao}</p>
              <ul className="pr-card__meta" aria-label="Resumo do alvo">
                {a.vlan && <li><i className="pi pi-sitemap" aria-hidden="true" />{a.vlan}</li>}
                {a.portas.length > 0 && <li><i className="pi pi-sign-in" aria-hidden="true" />{a.portas.length} {a.portas.length === 1 ? 'porta aberta' : 'portas abertas'}</li>}
                {a.ferramentas.length > 0 && <li><i className="pi pi-wrench" aria-hidden="true" />{a.ferramentas.length} {a.ferramentas.length === 1 ? 'ferramenta' : 'ferramentas'}</li>}
                {(a.mitre ?? []).length > 0 && <li><i className="pi pi-table" aria-hidden="true" />{a.mitre!.length} técnicas</li>}
              </ul>
            </ClickCard>
          ))}
        </div>
      )}

      {sel.item && <AlvoDrawer alvo={sel.item} nav={sel.nav} prepPct={prepPct} onVerChecklist={() => { sel.nav.onClose(); onVerChecklist(); }} />}
    </div>
  );
}
