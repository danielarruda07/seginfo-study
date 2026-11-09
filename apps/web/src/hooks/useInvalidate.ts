import { useQueryClient } from '@tanstack/react-query';

/**
 * Retorna uma função que invalida várias queries de uma vez.
 * Ex.: `invalidate('metas', 'dashboard')` após uma mutação local.
 */
export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => {
    keys.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
  };
}
