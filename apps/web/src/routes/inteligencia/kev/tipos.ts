import type { Ativo } from '@seginfo/shared';
import type { Tone } from '@/theme/status';
import type { KevItem } from '@/services/kev';
import type { PurpleExercise } from '@/services/exerciciosPurple';

/** Item do KEV já cruzado com o inventário e com os exercícios Red × Blue. */
export interface KevLinha {
  id: string;
  item: KevItem;
  ativos: Ativo[];
  exercicios: PurpleExercise[];
  tone?: Tone;
}
