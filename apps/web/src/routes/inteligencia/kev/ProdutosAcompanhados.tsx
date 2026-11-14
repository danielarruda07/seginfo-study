import { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Chip } from '@/components/InfraKit';
import { TERMOS_PADRAO } from '@/services/kev';

/**
 * Produtos acompanhados: no modo normal os chips filtram a lista (com a contagem);
 * em "Editar lista" viram chips de remover + campo para adicionar.
 */
export function ProdutosAcompanhados({ termos, contagem, filtro, onFiltro, onSalvar }: {
  termos: string[];
  contagem: (termo: string) => number | undefined;
  filtro: string | null;
  onFiltro: (t: string | null) => void;
  onSalvar: (lista: string[]) => void;
}) {
  const [editando, setEditando] = useState(termos.length === 0);
  const [novo, setNovo] = useState('');
  const adicionar = () => { if (novo.trim().length >= 2) { onSalvar([...termos, novo]); setNovo(''); } };

  return (
    <div className="in-produtos">
      <div className="in-produtos__linha" role="group" aria-label={editando ? 'Remover produtos acompanhados' : 'Filtrar por produto'}>
        <span className="iv-muted in-produtos__rotulo">Produtos:</span>
        {editando
          ? termos.map((t) => <Chip key={t} label={<>{t} <span className="in-sr">(remover)</span></>} icon="pi-times" onClick={() => onSalvar(termos.filter((x) => x !== t))} />)
          : termos.map((t) => {
            const n = contagem(t);
            return <Chip key={t} label={n === undefined ? t : `${t} (${n})`} active={filtro === t} onClick={() => onFiltro(filtro === t ? null : t)} />;
          })}
        <Button label={editando ? 'Concluir' : 'Editar lista'} icon={editando ? 'pi pi-check' : 'pi pi-pencil'} text size="small"
          onClick={() => setEditando(!editando)} aria-expanded={editando} />
      </div>
      {editando && (
        <div className="in-produtos__linha iv-mt">
          <InputText value={novo} onChange={(e) => setNovo(e.target.value)} maxLength={60} placeholder="Ex.: Fortinet, Cisco IOS"
            aria-label="Adicionar produto ou fabricante" onKeyDown={(e) => { if (e.key === 'Enter') adicionar(); }} />
          <Button label="Adicionar" icon="pi pi-plus" outlined onClick={adicionar} />
          <Button label="Restaurar padrão" severity="secondary" text onClick={() => onSalvar(TERMOS_PADRAO)} />
          <span className="in-muted-p">Use os nomes como aparecem no catálogo. Fica salvo neste navegador.</span>
        </div>
      )}
    </div>
  );
}
