import { z } from 'zod';
import { TATICAS, TECNICAS, type Tecnica } from '@/data/attack';
import { TOPICOS } from '@/data/topicos';
import { LABS } from '@/data/labs';
import { getStatusMap } from './catalog';
import { getProgressoLab } from './inventario';
import { listPurpleExercises, type PurpleExercise } from './exerciciosPurple';
import { read, write, registerSchema, todayISO } from './store';

/**
 * Matriz ATT&CK de cobertura. Cada técnica acumula até quatro camadas:
 *  - estudada: algum tópico concluído cobre a técnica;
 *  - praticada: algum lab concluído cobre a técnica (catálogo ou MITRE anotado no lab);
 *  - detectada: marcação manual, com a regra que detectou e a data do teste;
 *  - observada: o Radar registrou eventos reais dessa técnica (modo servidor).
 */

const DETECCOES_KEY = 'attack:deteccoes';
const DeteccaoSchema = z.object({ regra: z.string().max(300), testadoEm: z.string(), automatico: z.boolean().optional(), exercicioId: z.string().optional() });
registerSchema(DETECCOES_KEY, { safeParse: (v) => z.record(z.string(), DeteccaoSchema).safeParse(v) });

export type Deteccao = z.infer<typeof DeteccaoSchema>;

export interface CoberturaTecnica extends Tecnica {
  estudada: boolean;
  praticada: boolean;
  detectada: Deteccao | null;
  observada: number;
  alerta?: boolean;
  respondida?: boolean;
  topicos: string[];
  labs: string[];
  exercicios: PurpleExercise[];
}

const normalizar = (id: string) => id.trim().toUpperCase().split('.')[0];

export function getDeteccoes(): Record<string, Deteccao> {
  return read<Record<string, Deteccao>>(DETECCOES_KEY, {});
}

export function marcarDeteccao(tecnicaId: string, regra: string): void {
  write(DETECCOES_KEY, { ...getDeteccoes(), [normalizar(tecnicaId)]: { regra: regra.slice(0, 300), testadoEm: todayISO() } });
}

export function removerDeteccao(tecnicaId: string): void {
  const atual = { ...getDeteccoes() };
  delete atual[normalizar(tecnicaId)];
  write(DETECCOES_KEY, atual);
}

/** observadas: mapa técnica -> nº de eventos do Radar (vazio no modo local). */
export function calcularCobertura(observadas: Record<string, number> = {}): CoberturaTecnica[] {
  const status = getStatusMap();
  const deteccoes = getDeteccoes();
  const todosExercicios = listPurpleExercises();
  return TECNICAS.map((t) => {
    const topicos = TOPICOS.filter((tp) => (tp.mitre ?? []).map(normalizar).includes(t.id));
    const labs = LABS.filter((l) => {
      const anotadas = getProgressoLab(l.id).mitre.map(normalizar);
      return [...(l.mitre ?? []).map(normalizar), ...anotadas].includes(t.id);
    });
    const exercicios = todosExercicios.filter((e) => e.status !== 'planejado' && e.techniques.some((id) => normalizar(id) === t.id));
    const resultadoDeteccao = exercicios.find((e) => e.detection !== 'nao_testado');
    const manual = deteccoes[t.id] ?? null;
    const detectada = resultadoDeteccao
      ? resultadoDeteccao.detection === 'detectado'
        ? {
          regra: [resultadoDeteccao.logSources, resultadoDeteccao.expectedDetection].filter(Boolean).join(' · ').slice(0, 300),
          testadoEm: resultadoDeteccao.updatedAt.slice(0, 10), automatico: true, exercicioId: resultadoDeteccao.id,
        }
        : null
      : manual;
    return {
      ...t,
      estudada: topicos.some((tp) => status[tp.id] === 'concluido'),
      praticada: labs.some((l) => getProgressoLab(l.id).status === 'concluido') || exercicios.length > 0,
      detectada,
      observada: observadas[t.id] ?? 0,
      alerta: exercicios.some((e) => e.detection === 'detectado' || e.detection === 'parcial'),
      respondida: exercicios.some((e) => !!e.blueResponse.trim()),
      topicos: topicos.map((tp) => tp.id),
      labs: labs.map((l) => l.id),
      exercicios,
    };
  });
}

export function resumoCobertura(c: CoberturaTecnica[]) {
  const total = c.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const estudadas = c.filter((x) => x.estudada).length;
  const praticadas = c.filter((x) => x.praticada).length;
  const detectadas = c.filter((x) => x.detectada).length;
  const observadas = c.filter((x) => x.observada > 0).length;
  // lacuna: técnica vista de verdade (ou já praticada) que você ainda não detecta
  const lacunas = c.filter((x) =>
    (x.observada > 0 && !x.alerta) || (x.alerta && !x.detectada) || (!!x.detectada && !x.respondida));
  return {
    total, estudadas, praticadas, detectadas, observadas,
    pctEstudadas: pct(estudadas), pctPraticadas: pct(praticadas), pctDetectadas: pct(detectadas),
    lacunas,
  };
}

/** Pontuação 0-4 de uma técnica (uma camada por ponto), usada nas cores e no Navigator. */
export const pontuacao = (t: CoberturaTecnica) =>
  Number(t.observada > 0) + Number(!!t.alerta) + Number(!!t.detectada) + Number(!!t.respondida);

/** Camada no formato do MITRE ATT&CK Navigator (importável em mitre-attack.github.io/attack-navigator). */
export function camadaNavigator(c: CoberturaTecnica[]) {
  const taticaSlug: Record<string, string> = {
    TA0043: 'reconnaissance', TA0001: 'initial-access', TA0002: 'execution', TA0003: 'persistence',
    TA0004: 'privilege-escalation', TA0005: 'defense-evasion', TA0006: 'credential-access', TA0007: 'discovery',
    TA0008: 'lateral-movement', TA0009: 'collection', TA0011: 'command-and-control', TA0010: 'exfiltration', TA0040: 'impact',
  };
  return {
    name: 'SegInfo Study: cobertura',
    versions: { layer: '4.5', navigator: '5.1.0' },
    domain: 'enterprise-attack',
    description: `Exportado em ${todayISO()}. Ciclo operacional: observada + alerta de teste + validação + resposta (0 a 4).`,
    gradient: { colors: ['#ffffff', '#00d6c8'], minValue: 0, maxValue: 4 },
    techniques: c.filter((t) => pontuacao(t) > 0).map((t) => ({
      techniqueID: t.id,
      tactic: taticaSlug[t.tatica],
      score: pontuacao(t),
      comment: [
        t.observada > 0 && `observada no Radar: ${t.observada}`,
        t.alerta && 'alerta gerado em exercício',
        t.detectada && `validação: ${t.detectada.regra || 'regra registrada'}`,
        t.respondida && 'resposta documentada',
      ].filter(Boolean).join('; '),
    })),
  };
}

export { TATICAS };
