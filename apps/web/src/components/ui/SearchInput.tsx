import { InputText } from 'primereact/inputtext';

/** Campo de busca da iv-toolbar (o debounce fica na tela, via useDebounce). */
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <span className="p-input-icon-left">
      <i className="pi pi-search" />
      <InputText value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </span>
  );
}
