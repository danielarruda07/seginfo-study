import type { ReactNode } from 'react';

/** Campo de formulário: rótulo (+ * se obrigatório) · controle · dica ou erro. */
export function FormField({ id, label, required, hint, error, full, children }: {
  id: string; label: string; required?: boolean; hint?: string; error?: string; full?: boolean; children: ReactNode;
}) {
  return (
    <div className={`iv-field${full ? ' iv-form__full' : ''}`}>
      <label htmlFor={id}>{label}{required && <span className="iv-field__req" aria-hidden="true"> *</span>}</label>
      {children}
      {error ? <small className="iv-field__error" id={`${id}-erro`} role="alert">{error}</small>
        : hint && <small className="iv-field__hint">{hint}</small>}
    </div>
  );
}
