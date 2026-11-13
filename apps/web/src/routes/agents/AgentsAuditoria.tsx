import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { Sidebar } from 'primereact/sidebar';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { Kpi, StatusStrip, Pill } from '@/components/InfraKit';
import { DetailLayout, DetailHeader, DetailSection } from '@/components/ui/Detail';
import { listAgentes, listAuditoria, type AcaoAuditoria } from '@/services/agentes';

const DECISAO_LABEL: Record<AcaoAuditoria['decisao'], string> = {
  automatica: 'Leitura (automática)', aprovada: 'Escrita aprovada', negada: 'Escrita negada',
};
const DECISAO_COR: Record<AcaoAuditoria['decisao'], string> = {
  automatica: '#64748b', aprovada: '#16a34a', negada: '#ef4444',
};

/**
 * Painel de auditoria dos agentes: toda ação de ferramenta (leitura e escrita), de todas as
 * execuções, numa lista única. Serve dois públicos:
 *  - você, enquanto não há SIEM central para isto (Wazuh não recebe estes eventos hoje);
 *  - outra IA/agente, que pode ler GET /api/agentes/auditoria (mesmo formato desta tela) para
 *    decidir o que fazer com pendências — ver docs/AGENTS.md.
 */
export function AgentsAuditoria() {
  const agentes = useQuery({ queryKey: ['agentes'], queryFn: listAgentes });
  const [agenteId, setAgenteId] = useState<string | undefined>();
  const [somenteEscrita, setSomenteEscrita] = useState(false);
  const [somenteErro, setSomenteErro] = useState(false);
  const [sel, setSel] = useState<AcaoAuditoria | null>(null);

  const filtro = useMemo(() => ({ agenteId, somenteEscrita: somenteEscrita || undefined, somenteErro: somenteErro || undefined, limite: 300 }), [agenteId, somenteEscrita, somenteErro]);
  const auditoria = useQuery({ queryKey: ['agentes-auditoria', filtro], queryFn: () => listAuditoria(filtro) });

  const acoes = auditoria.data?.acoes ?? [];
  const aprovadas = acoes.filter((a) => a.decisao === 'aprovada').length;
  const negadas = acoes.filter((a) => a.decisao === 'negada').length;
  const erros = acoes.filter((a) => a.erro).length;

  return (
    <div>
      <PageHeader
        title="Auditoria dos agentes"
        subtitle="Toda ação que um agente executou de verdade: o que pediu, o que o servidor devolveu, e se foi aprovada por você."
      />

      {auditoria.isError && (
        <Message severity="warn" style={{ width: '100%', marginBottom: '1rem' }} text="API indisponível." />
      )}

      <StatusStrip tone="warn" icon="pi-exclamation-triangle">
        Você ainda não tem um SIEM central (Wazuh) recebendo estes eventos. Esta tela — e o endpoint
        <code> GET /api/agentes/auditoria</code> que a alimenta — é a visão de auditoria por enquanto, documentada em
        <code> docs/AGENTS.md</code> para que outra IA ou agente também possa consultar pendências aqui.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Ações no período" value={auditoria.data?.total ?? 0} />
        <Kpi label="Escritas aprovadas" value={aprovadas} tone="ok" />
        <Kpi label="Escritas negadas" value={negadas} />
        <Kpi label="Com erro" value={erros} tone={erros > 0 ? 'warning' : 'ok'} />
      </div>

      <div className="iv-row iv-wrap iv-mt" style={{ gap: '.6rem' }}>
        <Dropdown value={agenteId} options={(agentes.data ?? []).map((a) => ({ label: a.nome, value: a.id }))}
          onChange={(e) => setAgenteId(e.value)} placeholder="Todos os agentes" showClear style={{ minWidth: 240 }} aria-label="Filtrar por agente" />
        <label className="iv-row" style={{ gap: '.4rem' }}>
          <Checkbox checked={somenteEscrita} onChange={(e) => setSomenteEscrita(!!e.checked)} /> Só ações de escrita
        </label>
        <label className="iv-row" style={{ gap: '.4rem' }}>
          <Checkbox checked={somenteErro} onChange={(e) => setSomenteErro(!!e.checked)} /> Só com erro
        </label>
      </div>

      <div className="iv-card iv-mt">
        <DataTable value={acoes} dataKey="execucaoId" paginator rows={20} rowHover
          onRowClick={(e) => setSel(e.data as AcaoAuditoria)} emptyMessage="Nenhuma ação registrada ainda.">
          <Column header="Quando" body={(a: AcaoAuditoria) => a.decididoEm ? new Date(a.decididoEm).toLocaleString('pt-BR') : <span className="iv-muted">—</span>} style={{ width: 170 }} />
          <Column header="Agente" field="agenteNome" />
          <Column header="Ferramenta" field="ferramenta" />
          <Column header="Decisão" body={(a: AcaoAuditoria) => <Pill label={DECISAO_LABEL[a.decisao]} color={DECISAO_COR[a.decisao]} />} />
          <Column header="Resultado" body={(a: AcaoAuditoria) => a.erro ? <Pill label="Erro" color="#ef4444" /> : <Pill label="OK" color="#16a34a" />} style={{ width: 90 }} />
        </DataTable>
      </div>

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 'min(600px, 100vw)' }}>
        {sel && (
          <DetailLayout>
            <DetailHeader title={sel.ferramenta}>
              <Pill label={DECISAO_LABEL[sel.decisao]} color={DECISAO_COR[sel.decisao]} />
              {sel.erro && <Pill label="Erro" color="#ef4444" />}
            </DetailHeader>
            <p className="iv-muted">Agente: {sel.agenteNome} · execução {sel.execucaoId} · {sel.ms} ms</p>
            <DetailSection title="Parâmetros (entrada validada)">
              <pre style={{ background: '#0d0c2b', color: '#e2e8f0', padding: '.7rem', borderRadius: 8, overflow: 'auto', fontSize: '.8rem' }}>
                {JSON.stringify(sel.entrada, null, 2)}
              </pre>
            </DetailSection>
            <DetailSection title="Resultado devolvido ao modelo">
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '.85rem' }}>{sel.saida}</pre>
            </DetailSection>
          </DetailLayout>
        )}
      </Sidebar>
    </div>
  );
}
