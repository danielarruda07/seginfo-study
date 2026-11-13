import { z } from 'zod';
import { collection, registerSchema } from './store';

export const PurpleExerciseSchema = z.object({
  id: z.string(), labId: z.string(), title: z.string().max(160), createdAt: z.string(), updatedAt: z.string(),
  findingReference: z.string().max(100),
  status: z.enum(['planejado', 'executado', 'remediacao', 'reteste_aprovado', 'reteste_falhou']),
  assetIds: z.array(z.string()), rangeTargetIds: z.array(z.string()), techniques: z.array(z.string()),
  authorized: z.boolean(), scope: z.string().max(3000), exclusions: z.string().max(2000), window: z.string().max(300),
  stopCondition: z.string().max(1000), rollback: z.string().max(1000),
  redAction: z.string().max(3000), redResult: z.enum(['confirmado', 'nao_reproduzido', 'bloqueado', 'inconclusivo']),
  expectedDetection: z.string().max(1500), logSources: z.string().max(500),
  detection: z.enum(['detectado', 'parcial', 'nao_detectado', 'nao_testado']), blueResponse: z.string().max(2000),
  detectionTimeSeconds: z.number().int().nonnegative().optional(), responseTimeSeconds: z.number().int().nonnegative().optional(),
  evidence: z.string().max(1500), severity: z.enum(['sem_achado', 'baixa', 'media', 'alta', 'critica']),
  remediation: z.string().max(2000), owner: z.string().max(120), dueDate: z.string().max(10),
  retestResult: z.enum(['pendente', 'aprovado', 'falhou']),
});
export type PurpleExercise = z.infer<typeof PurpleExerciseSchema>;

const KEY = 'purple:exercicios';
registerSchema(KEY, { safeParse: (v) => PurpleExerciseSchema.array().safeParse(v) });
const records = collection<PurpleExercise>(KEY);

export function listPurpleExercises(labId?: string): PurpleExercise[] {
  return records.all()
    .filter((e) => !labId || e.labId === labId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function savePurpleExercise(input: Omit<PurpleExercise, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): PurpleExercise {
  const current = input.id ? records.all().find((e) => e.id === input.id) : undefined;
  const now = new Date().toISOString();
  const value: PurpleExercise = {
    ...input,
    id: input.id ?? '',
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
  if (current) { records.update(current.id, () => value); return value; }
  return records.add(value);
}

export function deletePurpleExercise(id: string): void { records.remove(id); }

export const EMPTY_PURPLE_EXERCISE = (labId: string): Omit<PurpleExercise, 'id' | 'createdAt' | 'updatedAt'> => ({
  labId, title: '', findingReference: '', status: 'planejado', assetIds: [], rangeTargetIds: [], techniques: [],
  authorized: false, scope: '', exclusions: '', window: '', stopCondition: '', rollback: '',
  redAction: '', redResult: 'inconclusivo', expectedDetection: '', logSources: '',
  detection: 'nao_testado', blueResponse: '', detectionTimeSeconds: undefined, responseTimeSeconds: undefined, evidence: '', severity: 'sem_achado',
  remediation: '', owner: '', dueDate: '', retestResult: 'pendente',
});

export function purpleExerciseCountForTechnique(techniqueId: string) {
  const id = techniqueId.trim().toUpperCase().split('.')[0];
  return listPurpleExercises().filter((e) => e.status !== 'planejado' && e.techniques.some((technique) => technique.split('.')[0] === id));
}

