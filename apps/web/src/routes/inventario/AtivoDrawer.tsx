import { Link } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import type { Ativo } from '@seginfo/shared';
import { DetailFields } from '@/components/ui/Detail';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { Pill } from '@/components/InfraKit';
import { copyToClipboard } from '@/lib/clipboard';
import { idadeConfirmacao } from '@/lib/confirmacao';
import { labsDoAtivo } from '@/services/inventario';
import { DOMINIO_LAB, TIPO_ATIVO_LABEL } from '@/theme/status';
import { CRITICIDADE_META, ESTADO_META, TIPO_ICON } from './regras';

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

  if (!ativo) return null;
  const estado = ESTADO_META[ativo.estado];
  const labs = labsDoAtivo(ativo.id);
  const detalhes = Object.entries(ativo.detalhes);
  const confirmacao = idadeConfirmacao(ativo.confirmadoEm);

  return (
    <DetailDrawer index={index} total={total} onIndex={onIndex} onClose={onClose} ariaLabel={`Ficha de ${ativo.nome}`}
      kind={{ icon: TIPO_ICON[ativo.tipo], label: TIPO_ATIVO_LABEL[ativo.tipo] }}
      status={<Pill label={estado.label} tone={estado.tone} icon={estado.icon} />}
      title={ativo.nome}
      subtitle={ativo.funcao || 'Sem função descrita'}
      actions={<>
        <Button label="Editar" icon="pi pi-pencil" onClick={() => onEdit(ativo)} />
        <Button label="Remover" icon="pi pi-trash" severity="danger" outlined onClick={() => onRemove(ativo)} />
      </>}>
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
          ['Criticidade operacional', ativo.criticidade ? CRITICIDADE_META[ativo.criticidade].label : ''],
          ['Exposição', ativo.exposicao ? ({ publica: 'Pública / internet', interna: 'Interna', restrita: 'Restrita / administrativa', isolada: 'Isolada' }[ativo.exposicao]) : ''],
          ['Tags', ativo.tags.length ? <span className="iv-row iv-wrap">{ativo.tags.map((t) => <Pill key={t} label={t} />)}</span> : ''],
          ['Credencial no Cofre', temCredencial ? 'Sim (conteúdo não exibido aqui)' : ''],
          ['Confirmado em', confirmacao.rever && ativo.confirmadoEm ? `${confirmacao.texto} · vale conferir de novo` : confirmacao.texto],
          ['Fonte', ativo.fonte ?? ''],
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
        {labs.length === 0 ? <p className="iv-muted" style={{ margin: 0, fontSize: '.875rem' }}>Nenhum lab vinculado. <Link to="/labs">Ver Labs Práticos</Link></p> : (
          <ul className="iv-col" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {labs.map((l) => (
              <li key={l.id} className="iv-row" style={{ justifyContent: 'space-between', fontSize: '.875rem' }}>
                <Link to="/labs">{l.titulo}</Link>
                <Pill label={DOMINIO_LAB[l.dominio].label} color={DOMINIO_LAB[l.dominio].color} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </DetailDrawer>
  );
}
