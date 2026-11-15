import { Pill } from '@/components/InfraKit';
import type { ClassificacaoGreynoise, EstadoGreynoise } from '@/services/radar';
import type { Tone } from '@/theme/status';

export const EXPLICACAO_GREYNOISE =
  'GreyNoise observa quem varre a internet inteira. Um scanner que todo mundo vê é ruído de fundo; ' +
  'um IP que o GreyNoise nunca viu e mesmo assim bateu aqui é mais interessante: pode ser algo direcionado ou novo.';

export const META_GREYNOISE: Record<EstadoGreynoise, { rotulo: string; tone: Tone; icon: string }> = {
  ruido: { rotulo: 'Ruído conhecido', tone: 'muted', icon: 'pi-globe' },
  benigno: { rotulo: 'Ruído conhecido (benigno)', tone: 'ok', icon: 'pi-check' },
  malicioso: { rotulo: 'Malicioso (GreyNoise)', tone: 'danger', icon: 'pi-exclamation-circle' },
  'nao-visto': { rotulo: 'Não visto antes', tone: 'warning', icon: 'pi-eye' },
  limite: { rotulo: 'GreyNoise: limite', tone: 'muted', icon: 'pi-clock' },
  erro: { rotulo: 'GreyNoise: sem resposta', tone: 'muted', icon: 'pi-times' },
};

/** Selo discreto com a classificação do GreyNoise; o título traz nome, última vez visto e a explicação. */
export function SeloGreynoise({ c }: { c: ClassificacaoGreynoise }) {
  const m = META_GREYNOISE[c.estado];
  const titulo = [c.name, c.last_seen && `visto em ${c.last_seen}`, c.mensagem, EXPLICACAO_GREYNOISE].filter(Boolean).join(' · ');
  return (
    <span className="in-gn" title={titulo}>
      <Pill label={m.rotulo} tone={m.tone} icon={m.icon} />
    </span>
  );
}
