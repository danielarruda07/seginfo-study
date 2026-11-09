import { useState } from 'react';

/**
 * Estado de um filtro de listagem (PATTERNS.md §6):
 * - `set(v)` aplica o valor e reseta a paginação;
 * - `toggle(v)` liga/desliga o valor (KPIs e chips clicáveis).
 */
export function useFilter<T>(resetPage: () => void, initial?: T) {
  const [value, setValue] = useState<T | undefined>(initial);
  const set = (v?: T) => {
    setValue(v);
    resetPage();
  };
  const toggle = (v: T) => set(value === v ? undefined : v);
  const is = (v: T) => value === v;
  return { value, set, toggle, is };
}
