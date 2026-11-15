import type { Severidade } from '@/services/exposicao';
import type { Tone } from '@/theme/status';

export const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const SEVERIDADE: Record<Severidade, { rotulo: string; tone: Tone; icon: string }> = {
  alta: { rotulo: 'Alta', tone: 'danger', icon: 'pi-exclamation-circle' },
  media: { rotulo: 'Média', tone: 'warning', icon: 'pi-exclamation-triangle' },
  info: { rotulo: 'Info', tone: 'info', icon: 'pi-info-circle' },
};
