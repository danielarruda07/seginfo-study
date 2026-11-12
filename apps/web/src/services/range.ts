import { z } from 'zod';
import type { RangeProgressoItem } from '@seginfo/shared';
import { RANGE_ALVOS, RANGE_CHECKLIST } from '@/data/range';
import { read, registerSchema, todayISO, write } from './store';

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

export function listRangeChecklist() {
  return RANGE_CHECKLIST;
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

/** Resumo de conclusão do checklist (para o cabeçalho da tela). */
export function resumoChecklist() {
  const all = listProgressoChecklist();
  const total = RANGE_CHECKLIST.length;
  const concluidos = RANGE_CHECKLIST.filter((c) => all[c.id]?.concluido).length;
  return { total, concluidos, pct: total ? Math.round((concluidos / total) * 100) : 0 };
}
