import { FERRAMENTAS } from '@/data/ferramentas';

export function listFerramentas() {
  return FERRAMENTAS;
}
export function getFerramenta(id: string) {
  return FERRAMENTAS.find((f) => f.id === id);
}
