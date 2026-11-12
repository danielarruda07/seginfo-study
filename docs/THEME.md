# 2. Tema e tokens

> ⚠️ Cores, tipografia e componentes de tela foram atualizados para o padrão tinybase — veja **[UI_GUIDE.md](UI_GUIDE.md)**, que prevalece em caso de conflito.

Dois sistemas de cor coexistem: o **tema PrimeReact repintado** (visual global) e a
**régua de status em código** (semântica de estado).

## (A) Tema PrimeReact — `lara-light-teal` repintado com a paleta Alvoar

O tema base é carregado por `<link>` no `index.html` e por cima aplicamos as
variáveis CSS da paleta Alvoar em `:root`. Trocar o tema inteiro é só trocar o link.

```html
<!-- index.html -->
<link id="theme-link" rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/primereact@10/resources/themes/lara-light-teal/theme.css" />
```

```css
/* tokens Alvoar — src/styles/tokens.css */
:root {
  /* marca */
  --alvoar-navy: #0d0c55;
  --alvoar-teal: #00d6c8;
  --alvoar-navy-700: #1a1870;
  --alvoar-teal-600: #00b8ac;

  /* superfícies */
  --surface-ground: #f4f6fb;
  --surface-card: #ffffff;
  --surface-border: #e3e8f0;
  --surface-hover: #eef2f8;

  /* texto */
  --text-color: #1c2333;
  --text-color-secondary: #5b6478;

  /* forma */
  --radius: 12px;
  --radius-sm: 8px;

  /* reaponta tokens do PrimeReact para a marca */
  --primary-color: var(--alvoar-teal-600);
  --primary-color-text: #ffffff;
  --highlight-bg: color-mix(in srgb, var(--alvoar-teal) 14%, #fff);
  --highlight-text-color: var(--alvoar-navy);
}
```

## (B) Régua de cores de status — em código

Semântica de estado (consumo, risco, severidade). Fica no código, não no CSS global,
porque muda por regra de negócio.

```ts
// src/theme/status.ts
export const STATUS_COLOR = {
  ok:    '#22c55e', // verde
  warn:  '#f59e0b', // laranja
  crit:  '#ef4444', // vermelho
} as const;

export type StatusTone = keyof typeof STATUS_COLOR;

/** Converte um percentual de uso/risco em um tom de status. */
export function usageTone(pct: number): StatusTone {
  if (pct >= 85) return 'crit';
  if (pct >= 60) return 'warn';
  return 'ok';
}
```

No contexto de estudo, `usageTone` também serve para progresso invertido
(ex: trilha pouco avançada perto do prazo = risco).
