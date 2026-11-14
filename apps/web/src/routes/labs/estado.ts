import type { EstadoLab } from '@/services/inventario';
import type { Tone } from '@/theme/status';

/** Estado do lab → rótulo, tom e ícone. "Não iniciado" fica neutro (cor só onde há ação). */
export const ESTADO_LAB_META: Record<EstadoLab, { label: string; tone?: Tone; icon: string }> = {
  nao_iniciado: { label: 'Não iniciado', icon: 'pi-circle' },
  em_andamento: { label: 'Em andamento', tone: 'info', icon: 'pi-clock' },
  concluido: { label: 'Concluído', tone: 'ok', icon: 'pi-check' },
};

export const ESTADO_LAB_OPTS = (Object.keys(ESTADO_LAB_META) as EstadoLab[]).map((value) => ({
  value, label: ESTADO_LAB_META[value].label,
}));

/** Próximo passo natural do lab, usado como ação principal da ficha. */
export function proximoEstado(atual: EstadoLab): { para: EstadoLab; rotulo: string; icon: string } | null {
  if (atual === 'nao_iniciado') return { para: 'em_andamento', rotulo: 'Começar lab', icon: 'pi pi-play' };
  if (atual === 'em_andamento') return { para: 'concluido', rotulo: 'Marcar como concluído', icon: 'pi pi-check' };
  return null;
}
