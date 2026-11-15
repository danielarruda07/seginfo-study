import { z } from 'zod';

export const AmbienteSchema = z.enum(['laboratorio', 'producao', 'nao_classificado']);
export type AmbienteMonitorado = z.infer<typeof AmbienteSchema>;
export const AmbienteFiltroSchema = z.enum(['todos', ...AmbienteSchema.options]).default('todos');
export type AmbienteFiltro = z.infer<typeof AmbienteFiltroSchema>;

const objeto = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function ambienteDoAtivo(a: { id?: unknown; name?: unknown; labels?: unknown; group?: unknown }): AmbienteMonitorado {
  const labels = Array.isArray(a.labels) ? Object.fromEntries(a.labels.map(objeto).map((l) => [l.key, l.value])) : objeto(a.labels);
  const environment = labels.environment;
  if (environment === 'production' || environment === 'producao') return 'producao';
  if (environment === 'laboratory' || environment === 'laboratorio' || environment === 'lab' || environment === 'range') return 'laboratorio';
  if (String(a.id) === '000') return 'nao_classificado';
  const groups = Array.isArray(a.group) ? a.group.filter((v): v is string => typeof v === 'string') : [];
  if (groups.some((g) => g.startsWith('prod-'))) return 'producao';
  if (groups.some((g) => g.startsWith('range-'))) return 'laboratorio';
  if (typeof a.name === 'string' && /^prod-/i.test(a.name)) return 'producao';
  if (typeof a.name === 'string' && /^range-/i.test(a.name) && a.name.toLowerCase() !== 'range-wazuh') return 'laboratorio';
  return 'nao_classificado';
}

export function ambienteDoEvento(e: { ambiente?: AmbienteMonitorado; fonte: string; alvo?: string | null; detalhes?: unknown }): AmbienteMonitorado {
  if (e.ambiente && e.ambiente !== 'nao_classificado') return e.ambiente;
  const d = objeto(e.detalhes);
  if (d.ambiente === 'producao' || d.ambiente === 'laboratorio') return d.ambiente;
  if (e.fonte === 'fortigate') return 'nao_classificado';
  const identificado = ambienteDoAtivo({ id: d.agentId, name: d.sensor ?? e.alvo, labels: d.labels, group: d.grupos });
  if (identificado !== 'nao_classificado') return identificado;
  if (['cowrie', 'dionaea', 'opencanary', 'heralding', 'isca', 'prompt_honeypot'].includes(e.fonte)) return 'laboratorio';
  return 'nao_classificado';
}
