import { useState } from 'react';
import type { EstadoAtivo, TipoAtivo } from '@seginfo/shared';
import type { ActiveFilter } from '@/components/ui/ActiveFiltersBar';
import { useDebounce } from '@/hooks/useDebounce';
import { TIPO_ATIVO_LABEL } from '@/theme/status';
import { ESCOPO_OPTS, ESTADO_META, type Escopo } from './regras';

/** Estado dos filtros da tela Meu Ambiente + chips da barra "Filtrando". */
export function useInventarioFiltros() {
  const [busca, setBusca] = useState('');
  const search = useDebounce(busca, 300);
  const [tipo, setTipo] = useState<TipoAtivo | undefined>();
  const [estado, setEstado] = useState<EstadoAtivo | undefined>();
  const [escopo, setEscopo] = useState<Escopo>('todos');

  /** KPI de estado: liga/desliga e volta o escopo para "Todos", para o estado nunca ficar escondido. */
  const toggleEstado = (e: EstadoAtivo) => {
    setEstado((v) => (v === e ? undefined : e));
    setEscopo('todos');
  };
  const limpar = () => { setBusca(''); setTipo(undefined); setEstado(undefined); setEscopo('todos'); };

  const chips: (ActiveFilter | false)[] = [
    !!search && { key: 'q', label: `Busca: “${search}”`, onRemove: () => setBusca('') },
    !!tipo && { key: 'tipo', label: `Tipo: ${TIPO_ATIVO_LABEL[tipo]}`, onRemove: () => setTipo(undefined) },
    !!estado && { key: 'estado', label: `Estado: ${ESTADO_META[estado].label}`, onRemove: () => setEstado(undefined) },
    escopo !== 'todos' && { key: 'escopo', label: ESCOPO_OPTS.find((o) => o.value === escopo)!.label, onRemove: () => setEscopo('todos') },
  ];

  return { busca, setBusca, search, tipo, setTipo, estado, toggleEstado, escopo, setEscopo, limpar, chips };
}
