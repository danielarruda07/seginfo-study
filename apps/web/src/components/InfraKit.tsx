import type { ReactNode } from 'react';
import type { StatusTone } from '@/theme/status';

/**
 * Átomos do design system iv-*.
 * Regra de ouro: um KPI com onClick vira filtro (ganha data-clickable e data-active).
 */

// ---- Kpi ----
export interface KpiProps {
  label: string;
  value: ReactNode;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}
export function Kpi({ label, value, hint, active, onClick }: KpiProps) {
  const clickable = typeof onClick === 'function';
  return (
    <div
      className="iv-kpi"
      data-clickable={clickable || undefined}
      data-active={active || undefined}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      aria-pressed={clickable ? !!active : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(); }
      } : undefined}
    >
      <div className="iv-kpi__label">{label}</div>
      <div className="iv-kpi__value">{value}</div>
      {hint && <div className="iv-kpi__hint">{hint}</div>}
    </div>
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
    <button type="button" className="iv-chip" data-active={active || undefined}
      aria-pressed={!!active} onClick={onClick}>
      {icon && <i className={`pi ${icon}`} aria-hidden="true" />}
      {label}
    </button>
  );
}

// ---- Pill (etiqueta colorida) ----
export interface PillProps {
  label: ReactNode;
  color?: string;
  icon?: string;
}
export function Pill({ label, color, icon }: PillProps) {
  return (
    <span className="iv-pill" style={color ? ({ ['--pill-color' as string]: color }) : undefined}>
      {icon && <i className={`pi ${icon}`} />}
      {label}
    </span>
  );
}

// ---- Meter / Bar (progresso) ----
export function Bar({ pct, tone }: { pct: number; tone?: StatusTone }) {
  return (
    <div className="iv-bar" title={`${pct}%`}>
      <div className={`iv-meter${tone ? ` iv-meter--${tone}` : ''}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
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
      {icon && <i className={`pi ${icon}`} style={{ fontSize: '1.1rem' }} />}
      <div>{children}</div>
    </div>
  );
}
