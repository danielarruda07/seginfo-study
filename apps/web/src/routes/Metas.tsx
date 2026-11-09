import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusStrip, Pill } from '@/components/InfraKit';
import { listMetas, addMeta, toggleMeta, removeMeta } from '@/services/sessoes';
import { listTrilhas, trilhaOptions } from '@/services/catalog';
import { todayISO } from '@/services/store';
import { useInvalidate } from '@/hooks/useInvalidate';
import { usageTone } from '@/theme/status';

export function Metas() {
  const invalidate = useInvalidate();
  const { data } = useQuery({ queryKey: ['metas'], queryFn: listMetas });
  const trilhas = listTrilhas();
  const trilhaOpts = trilhaOptions();

  const [titulo, setTitulo] = useState('');
  const [prazo, setPrazo] = useState(todayISO);
  const [trilhaId, setTrilhaId] = useState<string | undefined>();

  function salvar() {
    if (!titulo.trim()) return;
    addMeta({ titulo, prazo, trilhaId, concluida: false });
    setTitulo('');
    invalidate('metas', 'dashboard');
  }
  function toggle(id: string) { toggleMeta(id); invalidate('metas', 'dashboard'); }
  function excluir(id: string) { removeMeta(id); invalidate('metas', 'dashboard'); }

  const hoje = todayISO();
  const abertas = (data ?? []).filter((m) => !m.concluida);
  const nomeTrilha = (id?: string) => trilhas.find((t) => t.id === id)?.titulo;

  function diasRestantes(prazo: string) {
    return Math.ceil((new Date(prazo).getTime() - new Date(hoje).getTime()) / 86400000);
  }

  return (
    <div>
      <PageHeader title="Metas & Prazos" subtitle="Defina objetivos de estudo com data-alvo." />
      <StatusStrip tone={abertas.length > 5 ? 'warn' : 'ok'} icon="pi-flag">{abertas.length} metas abertas.</StatusStrip>

      <div className="iv-card iv-mt">
        <h3 style={{ marginTop: 0 }}>Nova meta</h3>
        <div className="iv-row iv-wrap iv-gap">
          <InputText value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Concluir trilha de SIEM" style={{ flex: 1, minWidth: 240 }} />
          <InputText type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
          <Dropdown value={trilhaId} options={trilhaOpts} onChange={(e) => setTrilhaId(e.value)} placeholder="Trilha (opcional)" showClear style={{ minWidth: 220 }} />
          <Button label="Adicionar" icon="pi pi-plus" onClick={salvar} />
        </div>
      </div>

      <div className="iv-col iv-gap iv-mt">
        {(data ?? []).map((m) => {
          const dias = diasRestantes(m.prazo);
          const tone = m.concluida ? 'ok' : usageTone(dias < 0 ? 100 : dias <= 7 ? 70 : 30);
          const trilhaNome = nomeTrilha(m.trilhaId);
          return (
            <div key={m.id} className="iv-card iv-row" style={{ justifyContent: 'space-between' }}>
              <div className="iv-row">
                <Checkbox checked={m.concluida} onChange={() => toggle(m.id)} />
                <div>
                  <div style={{ fontWeight: 600, textDecoration: m.concluida ? 'line-through' : 'none' }}>{m.titulo}</div>
                  <div className="iv-row iv-wrap" style={{ marginTop: 4 }}>
                    {trilhaNome && <Pill label={trilhaNome} />}
                    <span className="iv-muted" style={{ fontSize: '.82rem' }}>
                      Prazo: {m.prazo} {!m.concluida && <>· <span style={{ color: `var(--iv-${tone})` }}>{dias < 0 ? `${-dias}d atrasada` : `${dias}d restantes`}</span></>}
                    </span>
                  </div>
                </div>
              </div>
              <Button icon="pi pi-trash" text severity="danger" onClick={() => excluir(m.id)} />
            </div>
          );
        })}
        {(data ?? []).length === 0 && <p className="iv-muted">Nenhuma meta ainda.</p>}
      </div>
    </div>
  );
}
