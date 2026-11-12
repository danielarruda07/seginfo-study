import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TabView, TabPanel } from 'primereact/tabview';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Checkbox } from 'primereact/checkbox';
import { Sidebar } from 'primereact/sidebar';
import type { RangeAlvo, RangeChecklistItem, RangeProgressoItem } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { DetailLayout, DetailHeader, DetailSection } from '@/components/ui/Detail';
import { Chip, Pill, StatusStrip, Bar } from '@/components/InfraKit';
import { CATEGORIA_RANGE_LABEL, CRITICIDADE_COLOR, DOMINIO_LAB, GRUPO_CHECKLIST_LABEL } from '@/theme/status';
import {
  getProgressoChecklist, getRangeAlvo, listProgressoChecklist, listRangeAlvos,
  listRangeChecklist, resumoChecklist, saveProgressoChecklist,
} from '@/services/range';

type Dominio = RangeAlvo['dominio'];
const DOMINIOS: Dominio[] = ['blue', 'red', 'purple', 'infra'];

function DominioPill({ dominio }: { dominio: Dominio }) {
  return <Pill label={DOMINIO_LAB[dominio].label} color={DOMINIO_LAB[dominio].color} />;
}

export function Range() {
  return (
    <div>
      <PageHeader
        title="Range Vulnerável"
        subtitle="Ambiente controlado, propositalmente exposto, para treinar Blue, Red e Purple Team dentro do seu homelab — isolado de produção e da internet."
      />
      <StatusStrip tone="warn" icon="pi-exclamation-triangle">
        <strong>Regra de ouro:</strong> este segmento nunca tem rota para produção/gerência nem saída direta
        para a internet. Use sempre uma VLAN própria, snapshots e credenciais exclusivas do range.
        Veja <code>docs/IDEIAS_LAB.md</code> (Lab 8 e Lab 9) para o contexto completo.
      </StatusStrip>

      <TabView className="iv-mt">
        <TabPanel header="Alvos do range">
          <AlvosPanel />
        </TabPanel>
        <TabPanel header="Checklist &amp; documentação">
          <ChecklistPanel />
        </TabPanel>
      </TabView>
    </div>
  );
}

// ===================== Aba 1: Alvos (menu de VMs/portas/serviços) =====================

function AlvosPanel() {
  const { data } = useQuery({ queryKey: ['range-alvos'], queryFn: listRangeAlvos });
  const [dominio, setDominio] = useState<Dominio | undefined>();
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<RangeAlvo | null>(null);

  const alvos = (data ?? []).filter((a) =>
    (!dominio || a.dominio === dominio) &&
    (!search || `${a.nome} ${a.descricao}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())),
  );

  return (
    <div>
      <div className="iv-row iv-wrap iv-mt">
        <Chip label="Todos" active={!dominio} onClick={() => setDominio(undefined)} />
        {DOMINIOS.map((d) => (
          <Chip key={d} label={DOMINIO_LAB[d].label} active={dominio === d} onClick={() => setDominio(d)} />
        ))}
      </div>
      <div className="iv-row iv-wrap iv-mt">
        <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar VM, porta ou serviço…" aria-label="Buscar alvos do range" />
      </div>

      <div className="grid-cards iv-mt">
        {alvos.map((a) => (
          <div key={a.id} className="iv-card trilha-card lab-card" role="button" tabIndex={0}
            onClick={() => setSel(a)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(a); } }}>
            <div className="iv-row" style={{ justifyContent: 'space-between' }}>
              <DominioPill dominio={a.dominio} />
              <Pill label={CATEGORIA_RANGE_LABEL[a.categoria]} />
            </div>
            <h3 style={{ margin: '.6rem 0 .25rem', color: 'var(--alvoar-navy)' }}>{a.nome}</h3>
            <p className="iv-muted" style={{ margin: 0, fontSize: '.88rem' }}>{a.descricao}</p>
            {a.portas.length > 0 && (
              <div className="iv-row iv-wrap iv-mt">
                {a.portas.slice(0, 3).map((p) => <Pill key={p} label={p} />)}
                {a.portas.length > 3 && <Pill label={`+${a.portas.length - 3}`} />}
              </div>
            )}
          </div>
        ))}
      </div>

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 520 }}>
        {sel && <AlvoDetalhe alvo={sel} />}
      </Sidebar>
    </div>
  );
}

function AlvoDetalhe({ alvo }: { alvo: RangeAlvo }) {
  return (
    <DetailLayout>
      <DetailHeader title={alvo.nome}>
        <DominioPill dominio={alvo.dominio} />
        <Pill label={CATEGORIA_RANGE_LABEL[alvo.categoria]} />
      </DetailHeader>
      <p>{alvo.descricao}</p>
      {alvo.vlan && <p><strong>Segmento:</strong> {alvo.vlan}</p>}

      {alvo.portas.length > 0 && (
        <DetailSection title="Portas/serviços deliberadamente abertos">
          <div className="iv-row iv-wrap">{alvo.portas.map((p) => <Pill key={p} label={p} />)}</div>
        </DetailSection>
      )}

      {alvo.ferramentas.length > 0 && (
        <DetailSection title="Ferramentas/agentes">
          <div className="iv-row iv-wrap">{alvo.ferramentas.map((f) => <Pill key={f} label={f} />)}</div>
        </DetailSection>
      )}

      {(alvo.mitre ?? []).length > 0 && (
        <DetailSection title="Técnicas ATT&CK relacionadas">
          <div className="iv-row iv-wrap">
            {(alvo.mitre ?? []).map((t) => <Pill key={t} label={t} />)}
          </div>
        </DetailSection>
      )}
    </DetailLayout>
  );
}

// ===================== Aba 2: Checklist + documentação =====================

const GRUPOS: RangeChecklistItem['grupo'][] = ['rede', 'firewall', 'vms', 'monitoramento', 'seguranca_operacional', 'exercicio'];

function ChecklistPanel() {
  const { data } = useQuery({ queryKey: ['range-checklist'], queryFn: listRangeChecklist });
  const [grupo, setGrupo] = useState<RangeChecklistItem['grupo'] | undefined>();
  const [sel, setSel] = useState<RangeChecklistItem | null>(null);
  const [progresso, setProgresso] = useState<Record<string, RangeProgressoItem>>(() => listProgressoChecklist());
  const resumo = useMemo(() => resumoChecklist(), [progresso]);

  const itens = (data ?? []).filter((c) => !grupo || c.grupo === grupo);

  function salvar(id: string, novo: RangeProgressoItem) {
    saveProgressoChecklist(id, novo);
    setProgresso((atual) => ({ ...atual, [id]: getProgressoChecklist(id) }));
  }

  return (
    <div>
      <StatusStrip tone={resumo.pct === 100 ? 'ok' : resumo.pct > 0 ? 'warn' : 'crit'} icon="pi-list-check">
        {resumo.concluidos} de {resumo.total} atividades concluídas ({resumo.pct}%).
      </StatusStrip>
      <div className="iv-mt"><Bar pct={resumo.pct} tone={resumo.pct === 100 ? 'ok' : resumo.pct > 0 ? 'warn' : 'crit'} /></div>

      <div className="iv-row iv-wrap iv-mt">
        <Chip label="Todos" active={!grupo} onClick={() => setGrupo(undefined)} />
        {GRUPOS.map((g) => (
          <Chip key={g} label={GRUPO_CHECKLIST_LABEL[g]} active={grupo === g} onClick={() => setGrupo(g)} />
        ))}
      </div>

      <div className="iv-col iv-mt" style={{ gap: '.5rem' }}>
        {itens.map((item) => {
          const p = progresso[item.id] ?? { concluido: false, notas: '' };
          return (
            <div key={item.id} className="iv-card" style={{ padding: '.7rem .9rem' }}>
              <div className="iv-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="iv-row" style={{ gap: '.6rem', alignItems: 'flex-start' }}>
                  <Checkbox checked={p.concluido} onChange={(e) => salvar(item.id, { ...p, concluido: !!e.checked })} aria-label={`Marcar "${item.titulo}" como concluído`} />
                  <div>
                    <div style={{ fontWeight: 600, cursor: 'pointer' }} role="button" tabIndex={0}
                      onClick={() => setSel(item)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSel(item); }}>
                      {item.titulo}
                    </div>
                    <div className="iv-muted" style={{ fontSize: '.84rem' }}>{item.descricao}</div>
                  </div>
                </div>
                <div className="iv-row iv-wrap" style={{ flexShrink: 0 }}>
                  <DominioPill dominio={item.dominio} />
                  <Pill label={item.criticidade} color={CRITICIDADE_COLOR[item.criticidade]} />
                </div>
              </div>
              {p.concluidoEm && <p className="iv-muted" style={{ fontSize: '.8rem', margin: '.3rem 0 0' }}>Concluído em {p.concluidoEm}</p>}
            </div>
          );
        })}
      </div>

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 520 }}>
        {sel && <ChecklistDetalhe item={sel} progresso={progresso[sel.id] ?? getProgressoChecklist(sel.id)} onSave={(p) => salvar(sel.id, p)} />}
      </Sidebar>
    </div>
  );
}

function ChecklistDetalhe({ item, progresso, onSave }: { item: RangeChecklistItem; progresso: RangeProgressoItem; onSave: (p: RangeProgressoItem) => void }) {
  return (
    <DetailLayout>
      <DetailHeader title={item.titulo}>
        <DominioPill dominio={item.dominio} />
        <Pill label={GRUPO_CHECKLIST_LABEL[item.grupo]} />
        <Pill label={`Criticidade: ${item.criticidade}`} color={CRITICIDADE_COLOR[item.criticidade]} />
      </DetailHeader>
      <p>{item.descricao}</p>
      {item.referencia && <p className="iv-muted" style={{ fontSize: '.84rem' }}>Referência: {item.referencia}</p>}

      <DetailSection title="Passos para executar e dar check">
        <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
          {item.passos.map((p, i) => <li key={i} style={{ marginBottom: '.35rem' }}>{p}</li>)}
        </ol>
      </DetailSection>

      <DetailSection title="Seu progresso">
        <label className="iv-row" style={{ gap: '.5rem' }}>
          <Checkbox checked={progresso.concluido} onChange={(e) => onSave({ ...progresso, concluido: !!e.checked })} />
          Marcar como concluído
        </label>
        {progresso.concluidoEm && <p className="iv-muted">Concluído em {progresso.concluidoEm}</p>}
        <label className="iv-col iv-mt">Notas (sem credenciais ou dados sensíveis)
          <InputTextarea value={progresso.notas} rows={4} autoResize
            onChange={(e) => onSave({ ...progresso, notas: e.target.value })}
            placeholder="Ex.: regra criada no FortiGate com ID 42, testada e funcionando." />
        </label>
      </DetailSection>
    </DetailLayout>
  );
}
