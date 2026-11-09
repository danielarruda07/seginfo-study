import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Kpi, StatusStrip } from '@/components/InfraKit';
import { listSessoes, addSessao, removeSessao, totalMinutos } from '@/services/sessoes';
import { listTrilhas, trilhaOptions } from '@/services/catalog';
import { todayISO } from '@/services/store';
import { useInvalidate } from '@/hooks/useInvalidate';

export function Sessoes() {
  const invalidate = useInvalidate();
  const { data } = useQuery({ queryKey: ['sessoes'], queryFn: () => ({ sessoes: listSessoes(), minutos: totalMinutos() }) });
  const trilhas = listTrilhas();

  const [data_, setData_] = useState(todayISO);
  const [minutos, setMinutos] = useState<number | null>(60);
  const [trilhaId, setTrilhaId] = useState<string | undefined>();
  const [nota, setNota] = useState('');

  function salvar() {
    if (!minutos || minutos <= 0) return;
    addSessao({ data: data_, minutos, trilhaId, nota });
    setNota(''); setMinutos(60);
    invalidate('sessoes', 'dashboard');
  }
  function excluir(id: string) {
    removeSessao(id);
    invalidate('sessoes', 'dashboard');
  }

  const horas = ((data?.minutos ?? 0) / 60).toFixed(1);
  const trilhaOpts = trilhaOptions();
  const nomeTrilha = (id?: string) => trilhas.find((t) => t.id === id)?.titulo ?? '—';

  return (
    <div>
      <PageHeader title="Registro de Sessões" subtitle="Log do que você estudou e por quanto tempo." />
      <StatusStrip tone="ok" icon="pi-clock">Total acumulado: <strong>{horas}h</strong> em {data?.sessoes.length ?? 0} sessões.</StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Horas totais" value={horas} />
        <Kpi label="Sessões" value={data?.sessoes.length ?? 0} />
      </div>

      <div className="iv-card iv-mt">
        <h3 style={{ marginTop: 0 }}>Nova sessão</h3>
        <div className="iv-row iv-wrap iv-gap">
          <InputText type="date" value={data_} onChange={(e) => setData_(e.target.value)} />
          <InputNumber value={minutos} onValueChange={(e) => setMinutos(e.value ?? null)} suffix=" min" min={1} />
          <Dropdown value={trilhaId} options={trilhaOpts} onChange={(e) => setTrilhaId(e.value)} placeholder="Trilha (opcional)" showClear style={{ minWidth: 220 }} />
          <InputText value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que estudou?" style={{ flex: 1, minWidth: 200 }} />
          <Button label="Registrar" icon="pi pi-plus" onClick={salvar} />
        </div>
      </div>

      <div className="iv-card iv-mt">
        <DataTable value={data?.sessoes ?? []} paginator rows={10} emptyMessage="Nenhuma sessão registrada.">
          <Column field="data" header="Data" style={{ width: 120 }} />
          <Column header="Trilha" body={(r) => nomeTrilha(r.trilhaId)} />
          <Column field="minutos" header="Minutos" style={{ width: 110 }} />
          <Column field="nota" header="Nota" />
          <Column style={{ width: 70 }} body={(r) => <Button icon="pi pi-trash" text severity="danger" onClick={() => excluir(r.id)} />} />
        </DataTable>
      </div>
    </div>
  );
}
