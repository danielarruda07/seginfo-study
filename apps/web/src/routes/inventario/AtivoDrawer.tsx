import { useEffect } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { Button } from 'primereact/button';
import type { Ativo } from '@seginfo/shared';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { labsDoAtivo } from '@/services/inventario';
import { DOMINIO_LAB, TIPO_ATIVO_LABEL } from '@/theme/status';
import { ESTADO_META, TIPO_ICON } from './regras';

interface Props {
  lista: Ativo[];
  index: number;
  temCredencial: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
  onEdit: (a: Ativo) => void;
  onRemove: (a: Ativo) => void;
}

/** Ficha do ativo à direita, com ↑/↓ entre os itens da lista filtrada. */
export function AtivoDrawer({ lista, index, temCredencial, onIndex, onClose, onEdit, onRemove }: Props) {
  const ativo = lista[index];
  const total = lista.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowDown' && index < total - 1) { e.preventDefault(); onIndex(index + 1); }
      if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); onIndex(index - 1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, total, onIndex]);

  if (!ativo) return null;
  const estado = ESTADO_META[ativo.estado];
  const labs = labsDoAtivo(ativo.id);
  const detalhes = Object.entries(ativo.detalhes);

  return (
    <Sidebar visible position="right" onHide={onClose} className="iv-drawer" showCloseIcon={false} aria-label={`Ficha de ${ativo.nome}`}>
      <div className="iv-drawer__nav">
        <Button label="Voltar" icon="pi pi-arrow-left" text size="small" onClick={onClose} />
        <span className="iv-drawer__kind"><i className={`pi ${TIPO_ICON[ativo.tipo]}`} aria-hidden="true" />{TIPO_ATIVO_LABEL[ativo.tipo]}</span>
        <span className="iv-row">
          <span className="iv-drawer__pos">{index + 1} de {total}</span>
          <Button icon="pi pi-chevron-up" text size="small" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Ativo anterior" tooltip="Anterior (↑)" />
          <Button icon="pi pi-chevron-down" text size="small" disabled={index >= total - 1} onClick={() => onIndex(index + 1)} aria-label="Próximo ativo" tooltip="Próximo (↓)" />
        </span>
      </div>

      <div className="iv-drawer__head">
        <span><Pill label={estado.label} tone={estado.tone} icon={estado.icon} /></span>
        <h2 className="iv-drawer__title">{ativo.nome}</h2>
        <p className="iv-drawer__sub">{ativo.funcao || 'Sem função descrita'}</p>
        <div className="iv-drawer__actions">
          <Button label="Editar" icon="pi pi-pencil" onClick={() => onEdit(ativo)} />
          <Button label="Remover" icon="pi pi-trash" severity="danger" outlined onClick={() => onRemove(ativo)} />
        </div>
      </div>

      <section>
        <h3 className="iv-section-label">Identificação</h3>
        <DetailFields items={[
          ['Endereço', ativo.endereco ? (
            <span className="iv-row">
              <span className="mono">{ativo.endereco}</span>
              <Button icon="pi pi-copy" text size="small" aria-label="Copiar endereço" tooltip="Copiar" onClick={() => copyToClipboard(ativo.endereco)} />
            </span>
          ) : ''],
          ['Tipo', TIPO_ATIVO_LABEL[ativo.tipo]],
          ['Tags', ativo.tags.length ? <span className="iv-row iv-wrap">{ativo.tags.map((t) => <Pill key={t} label={t} />)}</span> : ''],
          ['Credencial no Cofre', temCredencial ? 'Sim (conteúdo não exibido aqui)' : ''],
        ]} />
      </section>

      {detalhes.length > 0 && (
        <section>
          <h3 className="iv-section-label">Detalhes técnicos</h3>
          <DetailFields items={detalhes.map(([k, v]) => [k, v])} />
        </section>
      )}

      <section>
        <h3 className="iv-section-label">Labs que usam este ativo</h3>
        {labs.length === 0 ? <p className="iv-muted" style={{ margin: 0, fontSize: '.875rem' }}>Nenhum lab vinculado.</p> : (
          <ul className="iv-col" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {labs.map((l) => (
              <li key={l.id} className="iv-row" style={{ justifyContent: 'space-between', fontSize: '.875rem' }}>
                <span>{l.titulo}</span>
                <Pill label={DOMINIO_LAB[l.dominio].label} color={DOMINIO_LAB[l.dominio].color} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Sidebar>
  );
}
