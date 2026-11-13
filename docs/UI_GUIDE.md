# Guia de UI/UX — padrão tinybase (Alvoar)

> **Fonte da verdade para qualquer tela nova ou refatorada.** Substitui as partes de
> cor e tipografia de `THEME.md`, `DESIGN_SYSTEM.md` e `PATTERNS.md` onde houver conflito.
> Tela de referência já no padrão: **Meu Ambiente** (`apps/web/src/routes/Inventario.tsx` + `routes/inventario/`).

## Onde está cada coisa

| O quê | Arquivo |
|---|---|
| Tokens (cores, fonte 14px Segoe UI, raio 6px, tons) | `apps/web/src/styles/tokens.css` |
| Overrides do PrimeReact (botão navy, tabela/diálogo com cabeçalho navy, foco teal) | `apps/web/src/styles/prime-overrides.css` |
| Casca: barra superior + breadcrumb + menu lateral | `components/shell/` (`nav.ts` define seções e breadcrumb) + `styles/shell.css` |
| Kit: KPI, pílula, chip, faixa, estado vazio, ficha, formulário | `components/InfraKit.tsx`, `components/ui/*`, `styles/iv.css` |
| Tons de estado (`Tone`, `kpiAlert`) | `theme/status.ts` |

## Princípios
1. **Uma informação aparece uma vez.** Faixa, KPI e tabela não repetem a mesma contagem.
2. **Cor só onde há ação.** "Em operação" ou "em dia" fica neutro. Estado = ícone + texto, nunca só cor.
3. **Hierarquia:** resumo no topo (KPIs clicáveis + gráfico), lista no meio, detalhe na ficha lateral.
4. **Atalhos preenchem, nunca obrigam.** Todo campo continua editável à mão.
5. **Feedback no lugar:** erro de validação no campo; sucesso em toast curto com o nome do item.
6. **Só variáveis na interface** (`var(--primary-color)`, `var(--tone-danger)`…). Hex fixo só em `tokens.css` e em relatório impresso.
7. **Componentes ≤ ~200 linhas**; regras puras em `.ts` com teste (ex.: `inventario/regras.ts`).

## Tipografia (nada maior que 1.25rem no conteúdo; base 14px)
Título da página 1.125rem/600 · subtítulo 0.875rem secundário · rótulo de seção `.iv-section-label`
(0.72rem, bold, MAIÚSCULAS) · corpo/tabela 1rem (=14px) · auxiliar 0.75rem · KPI 1.25rem bold.
Números e datas com `font-variant-numeric: tabular-nums` (classe `.tabular`); identificadores em `.mono`.

## Tons
`danger` vencido/crítico · `serious` urgente · `warning` atenção · `info` · `ok` (pouco) · `muted` inativo.
A classe `.tone-*` seta `--tone`; quem pinta usa `var(--tone)`. Fundo tingido: `color-mix(in srgb, var(--tone) 6%, var(--surface-card))`.

## Esqueleto de toda tela
1. `PageHeader` — título + subtítulo de uma linha; à direita no máximo 3 ações (1 primária navy, demais `outlined`).
2. Faixa de status **só se** disser algo que os KPIs não dizem.
3. `.iv-summary`: `.iv-kpis` (4–6 `Kpi`) + gráfico. `Kpi` com `onClick` vira filtro (`aria-pressed`); passe `tone` e só o que tem valor > 0 ganha destaque.
4. Card da lista: `.iv-toolbar` (`SearchInput` com debounce de 300 ms, `Dropdown` de categoria com ícone e `showClear`, `SelectButton` de escopo, `.iv-toolbar__count`) → `ActiveFiltersBar` ("Filtrando: … · Limpar tudo") → `DataTable`.
5. Ficha lateral (`Sidebar` com `.iv-drawer`): Voltar · tipo · "3 de 25" com ↑/↓; pílula de estado, título, ações; seções com `DetailFields` (vazio = "—").

## Cartões clicáveis + ficha lateral (regra para toda tela com cartões)
Todo cartão de item (tópico, lab, ferramenta, ameaça, nota, agente…) é clicável **inteiro** e abre a ficha lateral com informação útil que **não cabe no cartão** (detalhe, histórico, relacionados, próximos passos, ações). Nada de cartão "morto".
- `ClickCard` (`components/ui/ClickCard.tsx`): botão invisível cobre o cartão (mouse, Tab+Enter, leitor de tela via `label`). Links/botões internos continuam funcionando por cima. `tone` marca estado na borda; `selected` marca o cartão com a ficha aberta.
- `DetailDrawer` (`components/ui/DetailDrawer.tsx`): Voltar · tipo · "3 de 25" com ↑/↓ · selo · título · subtítulo · ações · seções (`DetailSection`/`DetailFields` de `components/ui/Detail.tsx`). `wide` para conteúdo denso.
- `useDrawerSelection(listaFiltrada)` (`hooks/useDrawerSelection.ts`): `open(id)`, `item`, `nav` para espalhar no drawer; ↑/↓ percorre a lista **filtrada**.
- Linhas de `DataTable` seguem a mesma regra: `onRowClick` abre a ficha, ações no menu ⋮.
- Segredo nunca aparece aberto na ficha: credencial mascarada, com botão explícito para revelar/copiar.

## Tabela
Até 6 colunas; a 1ª é a que decide (estado/prazo). Coluna principal `.iv-maincell` (ícone do tipo 30px + nome semibold + linha secundária) — tipo não ganha coluna própria.
`rowClassName` → `iv-row-alert tone-*` só para linhas com ação; `iv-row-muted` para inativas. Botão com texto só para a ação urgente; o resto no menu ⋮ (Excluir com `className: 'menu-danger'`).
Colunas secundárias com `className`/`headerClassName="iv-hide-sm"`. Paginação só acima de 25 linhas. Estado vazio com `EmptyState` + ação.

## Formulário (Dialog navy, 780px; 96vw no celular)
`<form className="iv-form">` com `<fieldset>` + `<legend>` por bloco; `.iv-form__grid` de 2 colunas; `FormField` (rótulo, `*`, dica ou erro).
Tipo em cartões `.iv-typecard` (`role="radio"`); rótulos e exemplos mudam com o tipo. Prévia ao vivo em `.iv-preview tone-*`.
Salvar sempre habilitado; erros aparecem no campo ao salvar. Rodapé: "* obrigatório" · Cancelar (text) · verbo específico ("Cadastrar", "Salvar alterações").
Exclusão com `confirmDialog` que nomeia o item e sugere a alternativa segura (ex.: "Prefira marcar como Desativado").

## Gráficos (Chart.js)
Uma pergunta por gráfico; título `.iv-section-label` + dica "clique para filtrar". Barras na cor primária (ler o token com `getComputedStyle`), raio 4, espessura ≤ 26px, um eixo, sem legenda em série única.
Tooltip com contagem + até 5 nomes; clique filtra (vira chip). `role="img"` + `aria-label` com os dados; poucos dados → frase em vez de gráfico vazio.

## Dados e privacidade
Exemplos e placeholders só com faixas de documentação (192.0.2.0/24, 198.51.100.0/24, `*.example`). Nada de IP, hostname ou domínio real do homelab.

## Ao terminar
`npm run typecheck --workspace apps/web` · `npm test --workspace apps/web` · `npm run build`. Não há lint configurado no projeto.
