import { useCallback, useMemo, useState } from 'react';

const porId = (i: unknown) => (i as { id: string }).id;

/**
 * Seleção do item aberto na ficha lateral, por id, sobre a lista filtrada que está na tela.
 * Se o item some da lista (filtro mudou, foi removido), a ficha fecha sozinha.
 * Passe `getId` estável (fora do componente ou com useCallback) quando o item não tiver `id`.
 */
export function useDrawerSelection<T>(lista: readonly T[], getId: (item: T) => string = porId) {
  const [selId, setSelId] = useState<string | null>(null);
  const index = useMemo(() => (selId === null ? -1 : lista.findIndex((i) => getId(i) === selId)), [lista, selId, getId]);
  const item = index >= 0 ? lista[index] : undefined;

  const open = useCallback((id: string) => setSelId(id), []);
  const close = useCallback(() => setSelId(null), []);
  const onIndex = useCallback((i: number) => { const alvo = lista[i]; if (alvo) setSelId(getId(alvo)); }, [lista, getId]);

  return {
    item,
    selId,
    open,
    close,
    isOpen: (id: string) => selId === id,
    /** espalhe em <DetailDrawer {...sel.nav}> */
    nav: { index: Math.max(0, index), total: lista.length, onIndex, onClose: close },
  };
}
