import { FERRAMENTAS } from '@/data/ferramentas';
import { z } from 'zod';
import { collection, registerSchema, todayISO } from './store';

export const ExperienciaFerramentaSchema = z.object({
  id: z.string(), ferramentaId: z.string(), tipo: z.enum(['teste', 'observacao', 'pendencia']),
  data: z.string(), titulo: z.string(), ambiente: z.string(), resultado: z.enum(['positivo', 'parcial', 'negativo', 'nao_aplicavel']),
  relato: z.string(), proximoPasso: z.string(),
});
export type ExperienciaFerramenta = z.infer<typeof ExperienciaFerramentaSchema>;
registerSchema('experiencias-ferramentas', { safeParse: (v) => ExperienciaFerramentaSchema.array().safeParse(v) });
const experiencias = collection<ExperienciaFerramenta>('experiencias-ferramentas');

export function listFerramentas() {
  return FERRAMENTAS;
}
export function getFerramenta(id: string) {
  return FERRAMENTAS.find((f) => f.id === id);
}

export function listExperiencias(ferramentaId: string) {
  return experiencias.all().filter((e) => e.ferramentaId === ferramentaId).sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
}

export function addExperiencia(input: Omit<ExperienciaFerramenta, 'id'>) {
  return experiencias.add(input);
}

export function removeExperiencia(id: string) { experiencias.remove(id); }
export { todayISO };
