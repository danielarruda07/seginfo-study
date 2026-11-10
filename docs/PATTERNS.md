# 4–8. Componentes, anatomia, filtros, arquitetura e checklist

## 4. Componentes React

### `src/components/InfraKit.tsx` — átomos do design system

Átomos: `Kpi`, `Chip`, `Pill`, `Meter`, `Bar`, `StatusStrip`.

**Regra de ouro:** *KPI com `onClick` vira filtro.* Um `Kpi` que recebe `onClick`
automaticamente ganha `data-clickable` e, quando o filtro correspondente está
ligado, `data-active`. Clicar alterna o filtro daquela métrica.

```tsx
<Kpi label="Tópicos críticos" value={12}
     active={filter === 'crit'}
     onClick={() => toggle('crit')} />
```

### `src/components/ui/` — moléculas reutilizáveis

| Componente | Responsabilidade |
| --- | --- |
| `PageHeader` | Título, subtítulo e ações da tela (topo canônico) |
| `DataTableWrapper` | Planejado; ainda não existe no código |
| `FormField` | Planejado; ainda não existe no código |
| `ActiveFiltersBar` | Mostra os filtros ativos como chips removíveis |

Os exemplos e a anatomia abaixo são convenções desejadas para novas telas; as telas
existentes ainda não seguem todas essas etapas nem usam paginação lazy de forma uniforme.

## 5. Anatomia de tela — ordem canônica

Toda tela de listagem segue este esqueleto, nesta ordem:

```
PageHeader
└─ StatusStrip            (resumo do estado geral da tela)
└─ faixa de KPIs          (iv-kpis > Kpi[]; clicáveis viram filtro)
└─ cards                  (blocos de contexto/gráficos, opcional)
└─ iv-card
   ├─ iv-toolbar          (busca + chips de filtro + ações)
   ├─ ActiveFiltersBar    (filtros ativos)
   └─ DataTableWrapper    (tabela com paginação lazy)
└─ Drawer                 (detalhe/edição do item selecionado)
```

## 6. Padrão de filtros

- **Toggle nos KPIs/chips:** clicar liga/desliga aquele filtro.
- **Debounce na busca:** 300ms antes de disparar a consulta.
- **Reset de paginação:** qualquer mudança de filtro volta para a página 1.
- **Barra de filtros ativos:** `ActiveFiltersBar` lista o que está aplicado.
- **Filtragem no servidor via `queryKey`:** os filtros entram no `queryKey` do
  react-query; mudar o filtro muda a key e dispara novo fetch. No MVP local, a
  mesma `queryKey` alimenta a função que filtra o `localStorage`.

```ts
useQuery({
  queryKey: ['topicos', { search, status, trilhaId, page }],
  queryFn: () => listTopicos({ search, status, trilhaId, page }),
});
```

## 7. Convenções de arquitetura

```
apps/web/src/
├─ main.tsx                 # bootstrap: providers + estilos
├─ router.tsx              # TanStack Router, code-based
├─ routes/                 # uma pasta por tela
├─ components/
│  ├─ InfraKit.tsx         # átomos iv-*
│  └─ ui/                  # moléculas (PageHeader, etc.)
├─ services/
│  ├─ http.ts              # instância axios + interceptors
│  └─ *.ts                 # um service por domínio
├─ data/                   # conteúdo de estudo (seed de segurança)
├─ theme/status.ts         # STATUS_COLOR + usageTone()
└─ styles/                 # tokens.css + iv.css
```

- **Router TanStack code-based:** rotas declaradas em TS, sem geração de arquivo.
- **Service axios com interceptors:** base URL, auth futura e tratamento de erro
  centralizados em `http.ts`.
- **react-query:** toda leitura de dado passa por `useQuery`/`useMutation`.
- **Nomenclatura:** componentes em PascalCase, hooks `useX`, services `verbNoun`
  (`listTopicos`, `saveMeta`), tipos no `packages/shared`.

## 8. Checklist (5 itens antes de dar uma tela por pronta)

1. Segue a **ordem canônica** da anatomia de tela (seção 5).
2. KPIs clicáveis funcionam como **filtro** e refletem `data-active`.
3. Busca tem **debounce** e qualquer filtro **reseta a paginação**.
4. Estados de **loading / vazio / erro** tratados via react-query.
5. Cores de status vêm de **`usageTone()` / `STATUS_COLOR`**, nunca hardcoded na tela.
