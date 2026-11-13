import { z } from 'zod';
import type { RangeProgressoItem } from '@seginfo/shared';
import { RANGE_ALVOS, RANGE_CHECKLIST } from '@/data/range';
import { read, registerSchema, todayISO, write } from './store';
import type { LabVars } from './rangePrompt';

const PROGRESS_KEY = 'range:checklist-progresso';

registerSchema(PROGRESS_KEY, {
  safeParse: (v) =>
    z.record(z.string(), z.object({
      concluido: z.boolean(),
      concluidoEm: z.string().optional(),
      notas: z.string().default(''),
    })).safeParse(v),
});

export function listRangeAlvos() {
  return RANGE_ALVOS;
}
export function getRangeAlvo(id: string) {
  return RANGE_ALVOS.find((a) => a.id === id);
}

/** Checklist de preparação do segmento (tudo menos os exercícios, que têm aba própria). */
export function listRangeChecklist() {
  return RANGE_CHECKLIST.filter((item) => item.grupo !== 'exercicio');
}
/** Exercícios ofensivos/purple do range (Lab 9, Atomic Red Team/Caldera): aba "Exercícios". */
export function listRangeExercicios() {
  return RANGE_CHECKLIST.filter((item) => item.grupo === 'exercicio');
}
export function getRangeChecklistItem(id: string) {
  return RANGE_CHECKLIST.find((c) => c.id === id);
}

export function getProgressoChecklist(id: string): RangeProgressoItem {
  const all = read<Record<string, RangeProgressoItem>>(PROGRESS_KEY, {});
  return all[id] ?? { concluido: false, notas: '' };
}

export function listProgressoChecklist(): Record<string, RangeProgressoItem> {
  return read<Record<string, RangeProgressoItem>>(PROGRESS_KEY, {});
}

export function saveProgressoChecklist(id: string, progresso: RangeProgressoItem): void {
  const all = read<Record<string, RangeProgressoItem>>(PROGRESS_KEY, {});
  const concluidoEm = progresso.concluido ? (progresso.concluidoEm || todayISO()) : undefined;
  write(PROGRESS_KEY, { ...all, [id]: { ...progresso, concluidoEm } });
}

/** Resumo de conclusão do checklist de preparação (para o cabeçalho da aba). */
export function resumoChecklist() {
  const all = listProgressoChecklist();
  const checklist = listRangeChecklist();
  const total = checklist.length;
  const concluidos = checklist.filter((c) => all[c.id]?.concluido).length;
  return { total, concluidos, pct: total ? Math.round((concluidos / total) * 100) : 0 };
}

/** Resumo de conclusão dos exercícios (aba "Exercícios"). */
export function resumoExercicios() {
  const all = listProgressoChecklist();
  const exercicios = listRangeExercicios();
  const total = exercicios.length;
  const concluidos = exercicios.filter((c) => all[c.id]?.concluido).length;
  return { total, concluidos, pct: total ? Math.round((concluidos / total) * 100) : 0 };
}

// ===================== Variáveis do lab e prompts editados =====================
// Ficam só neste navegador: descrevem o ambiente real do usuário e não vão ao repositório.

const VARS_KEY = 'range:lab-vars';
const PROMPTS_KEY = 'range:prompts-editados';
const textoPorChave = { safeParse: (v: unknown) => z.record(z.string(), z.string()).safeParse(v) };
registerSchema(VARS_KEY, textoPorChave);
registerSchema(PROMPTS_KEY, textoPorChave);

export function getLabVars(): LabVars {
  return read<LabVars>(VARS_KEY, {});
}
export function saveLabVars(vars: LabVars): void {
  write(VARS_KEY, vars);
}

/** Prompt que o usuário editou à mão para uma etapa (substitui o gerado). */
export function getPromptEditado(id: string): string | undefined {
  return read<Record<string, string>>(PROMPTS_KEY, {})[id];
}
export function savePromptEditado(id: string, texto: string | undefined): void {
  const { [id]: _antigo, ...resto } = read<Record<string, string>>(PROMPTS_KEY, {});
  write(PROMPTS_KEY, texto === undefined ? resto : { ...resto, [id]: texto });
}
