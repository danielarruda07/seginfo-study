import { useSyncExternalStore } from 'react';
import type { AmbienteFiltro } from '@seginfo/shared';
export const AMBIENTES: { value: AmbienteFiltro; label: string }[] = [
  { value: 'todos', label: 'Todos' }, { value: 'laboratorio', label: 'Laboratório' },
  { value: 'producao', label: 'Produção' }, { value: 'nao_classificado', label: 'Não classificado' },
];
const KEY = 'seginfo-monitoramento-ambiente';
const EVENT = 'seginfo-monitoramento-ambiente-change';
export function getAmbiente(): AmbienteFiltro {
  try { const value = localStorage.getItem(KEY); return AMBIENTES.find((a) => a.value === value)?.value ?? 'todos'; } catch { return 'todos'; }
}
function subscribe(fn: () => void) {
  window.addEventListener(EVENT, fn); window.addEventListener('storage', fn);
  return () => { window.removeEventListener(EVENT, fn); window.removeEventListener('storage', fn); };
}
export function useAmbiente() {
  const ambiente = useSyncExternalStore(subscribe, getAmbiente, () => 'todos' as AmbienteFiltro);
  return [ambiente, (value: AmbienteFiltro) => { localStorage.setItem(KEY, value); window.dispatchEvent(new Event(EVENT)); }] as const;
}
export const rotuloAmbiente = (v: string) => AMBIENTES.find((a) => a.value === v)?.label ?? 'Não classificado';
