import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailFields } from '@/components/ui/Detail';
import { Pill } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { copyToClipboard } from '@/lib/clipboard';
import type { BackupItem } from '@/services/armazenamento';
import { fmtData, fmtTam, situacaoNaRetencao } from './regras';

const selo = (b: BackupItem) => (b.status === 'ok'
  ? <Pill label="Enviado" tone="ok" icon="pi-check" />
  : <Pill label="Erro" tone="danger" icon="pi-times" />);

/** Histórico de execuções; a linha abre a ficha do backup (arquivo, tamanho, erro completo, retenção). */
export function Historico({ backups, retencao }: { backups: BackupItem[]; retencao: number }) {
  const sel = useDrawerSelection(backups);
  const b = sel.item;
  return (
    <section className="iv-card iv-mt" aria-labelledby="ca-hist-titulo">
      <h3 id="ca-hist-titulo" className="iv-section-label">Histórico de backups · clique numa linha para detalhes</h3>
      <DataTable value={backups} dataKey="id" emptyMessage="Nenhum backup ainda." paginator={backups.length > 25} rows={25}
        onRowClick={(e) => sel.open((e.data as BackupItem).id)} rowHover className="ca-tabela-click"
        rowClassName={(r: BackupItem) => (r.status === 'erro' ? 'iv-row-alert tone-danger' : '')}>
        <Column header="Status" style={{ width: 120 }} body={selo} />
        <Column header="Quando (UTC)" body={(r: BackupItem) => fmtData(r.criadoEm)} />
        <Column header="Arquivo" className="iv-hide-sm" headerClassName="iv-hide-sm" body={(r: BackupItem) => <span className="mono ca-small">{r.nomeArquivo}</span>} />
        <Column header="Tamanho" className="iv-num iv-hide-sm" headerClassName="iv-hide-sm" body={(r: BackupItem) => (r.status === 'ok' ? fmtTam(r.tamanhoBytes) : '—')} />
        <Column header="" style={{ width: 48 }} body={(r: BackupItem) => (
          <Button icon="pi pi-angle-right" text rounded size="small" aria-label={`Detalhes do backup de ${fmtData(r.criadoEm)}`} onClick={() => sel.open(r.id)} />
        )} />
      </DataTable>

      {b && (
        <DetailDrawer {...sel.nav} kind={{ icon: 'pi-history', label: 'Execução de backup' }} ariaLabel={`Ficha do backup de ${fmtData(b.criadoEm)}`}
          status={selo(b)} title={fmtData(b.criadoEm)} subtitle={situacaoNaRetencao(backups, b.id, retencao)}
          actions={<Button label="Copiar nome do arquivo" icon="pi pi-copy" size="small" outlined onClick={() => copyToClipboard(b.nomeArquivo)} />}>
          <section>
            <h3 className="iv-section-label">Arquivo</h3>
            <DetailFields items={[
              ['Nome', <span className="mono">{b.nomeArquivo}</span>],
              ['Tamanho', b.status === 'ok' ? `${fmtTam(b.tamanhoBytes)} (${b.tamanhoBytes.toLocaleString('pt-BR')} bytes)` : ''],
              ['Quando', fmtData(b.criadoEm)],
              ['Para restaurar', b.status === 'ok' ? 'Baixe o .sgb do OneDrive e decifre com a chave privada (docs/ARMAZENAMENTO.md).' : ''],
            ]} />
          </section>
          {b.erro && (
            <section>
              <h3 className="iv-section-label">Erro</h3>
              <div className="ca-texto mono">{b.erro}</div>
            </section>
          )}
        </DetailDrawer>
      )}
    </section>
  );
}
