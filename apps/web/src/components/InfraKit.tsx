import type { ReactNode } from 'react';
import { kpiAlert, toneClass, type StatusTone, type Tone } from '@/theme/status';

/**
 * Átomos do design system iv-* (padrão tinybase — docs/UI_GUIDE.md).
 * Regra de ouro: KPI com onClick é filtro (vira <button> com aria-pressed).
 */

// ---- Kpi ----
export interface KpiProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: string;
  /** Tom do estado; só tons de ação com valor > 0 ganham destaque. */
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
}
export function Kpi({ label, value, hint, icon, tone, active, onClick }: KpiProps) {
  const alert = kpiAlert(tone, value);
  const content = (
    <>
      <span className="iv-kpi__label">{icon && <i className={`pi ${icon}`} aria-hidden="true" />}{label}</span>
      <span className="iv-kpi__value">{value}</span>
      {hint && <span className="iv-kpi__hint">{hint}</span>}
    </>
  );
  const className = `iv-kpi ${alert ? toneClass(tone) : ''}`.trim();
  if (!onClick) return <div className={className} data-alert={alert || undefined}>{content}</div>;
  return (
    <button type="button" className={className} data-alert={alert || undefined} aria-pressed={!!active} onClick={onClick}
      title={active ? 'Clique para limpar o filtro' : 'Clique para filtrar a lista'}>
      {content}
    </button>
  );
}

// ---- Chip (filtro clicável) ----
export interface ChipProps {
  label: ReactNode;
  active?: boolean;
  onClick?: () => void;
  icon?: string;
}
export function Chip({ label, active, onClick, icon }: ChipProps) {
  if (!onClick) {
    return <span className="iv-chip" data-active={active || undefined}>
      {icon && <i className={`pi ${icon}`} aria-hidden="true" />}{label}
    </span>;
  }
  return (
    <button type="button" className="iv-chip" data-active={active || undefined} aria-pressed={!!active} onClick={onClick}>
      {icon && <i className={`pi ${icon}`} aria-hidden="true" />}
      {label}
    </button>
  );
}

// ---- Pill (selo de estado / etiqueta) ----
export interface PillProps {
  label: ReactNode;
  /** Preferir `tone`. `color` fica para etiquetas de identidade (domínio, fonte). */
  tone?: Tone;
  color?: string;
  icon?: string;
}
export function Pill({ label, tone, color, icon }: PillProps) {
  return (
    <span className={`iv-pill ${toneClass(tone)}`.trim()} style={!tone && color ? ({ ['--pill-color' as string]: color }) : undefined}>
      {icon && <i className={`pi ${icon}`} aria-hidden="true" />}
      {label}
    </span>
  );
}

// ---- Meter / Bar (progresso) ----
export function Bar({ pct, tone }: { pct: number; tone?: StatusTone }) {
  const v = Math.min(100, Math.max(0, pct));
  return (
    <div className="iv-bar" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} title={`${Math.round(v)}%`}>
      <div className={`iv-meter${tone ? ` iv-meter--${tone}` : ''}`} style={{ width: `${v}%` }} />
    </div>
  );
}

// ---- StatusStrip (faixa de resumo) ----
export interface StatusStripProps {
  tone?: StatusTone;
  icon?: string;
  children: ReactNode;
}
export function StatusStrip({ tone, icon, children }: StatusStripProps) {
  return (
    <div className={`iv-status${tone ? ` iv-status--${tone}` : ''}`}>
      {icon && <i className={`pi ${icon}`} aria-hidden="true" />}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

// ---- EmptyState ----
export function EmptyState({ icon = 'pi-inbox', title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="iv-empty">
      <i className={`pi ${icon}`} aria-hidden="true" />
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}
