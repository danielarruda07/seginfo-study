import { InputText } from 'primereact/inputtext';

/** Campo de busca da iv-toolbar (flex 1). O debounce de 300 ms fica na tela, via useDebounce. */
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <span className="p-input-icon-left iv-toolbar__search">
      <i className="pi pi-search" aria-hidden="true" />
      <InputText value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder ?? 'Buscar'} />
    </span>
  );
}
