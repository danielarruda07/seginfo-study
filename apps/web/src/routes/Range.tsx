import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { TabView, TabPanel } from 'primereact/tabview';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Checkbox } from 'primereact/checkbox';
import { Sidebar } from 'primereact/sidebar';
import { Button } from 'primereact/button';
import type { RangeAlvo, RangeChecklistItem, RangeProgressoItem } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { DetailLayout, DetailHeader, DetailSection } from '@/components/ui/Detail';
import { Chip, Pill, StatusStrip, Bar } from '@/components/InfraKit';
import { CATEGORIA_RANGE_LABEL, CRITICIDADE_COLOR, DOMINIO_LAB, GRUPO_CHECKLIST_LABEL } from '@/theme/status';
import {
  getLabVars, getProgressoChecklist, getPromptEditado, listProgressoChecklist, listRangeAlvos,
  listRangeChecklist, listRangeExercicios, resumoChecklist, resumoExercicios, saveLabVars,
  saveProgressoChecklist, savePromptEditado,
} from '@/services/range';
import { faltandoNoPrompt, montarPrompt, preencher, valorVar, type LabVars } from '@/services/rangePrompt';
import { GRUPO_LAB_VAR_LABEL, GRUPOS_LAB_VAR, LAB_VARS, PEDIDOS_GERAIS, TIPO_RECURSO_LABEL } from '@/data/rangeLab';
import { copyToClipboard } from '@/lib/clipboard';

type Dominio = RangeAlvo['dominio'];
const DOMINIOS: Dominio[] = ['blue', 'red', 'purple', 'infra'];

function DominioPill({ dominio }: { dominio: Dominio }) {
  return <Pill label={DOMINIO_LAB[dominio].label} color={DOMINIO_LAB[dominio].color} />;
}

const ABA_CONFIGURAR = 0;
const ABA_ALVOS = 1;
const ABA_CHECKLIST = 2;
const ABA_EXERCICIOS = 3;

export function Range() {
  const [aba, setAba] = useState(ABA_CONFIGURAR);
  const [vars, setVars] = useState<LabVars>(() => getLabVars());
  function salvarVars(novas: LabVars) {
    saveLabVars(novas);
    setVars(novas);
  }

  const faltandoVars = LAB_VARS.filter((v) => !valorVar(v.chave, vars)).length;
  const prep = resumoChecklist();
  const exerc = resumoExercicios();

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

      <StatusStrip tone="ok" icon="pi-directions">
        O Range organiza a preparação e o isolamento do laboratório. Os modelos <strong>Operador do FortiGate</strong>,{' '}
        <strong>Operador do Catalyst 2960</strong> e <strong>Operador do Proxmox</strong> em <Link to="/agents">Agents</Link> executam
        o checklist abaixo com aprovação sua; eventos reais continuam no <Link to="/radar">Radar</Link>.
      </StatusStrip>

      <div className="iv-row iv-wrap iv-mt" style={{ gap: '1.5rem' }}>
        <ProgressoResumo label="Ambiente configurado" pct={faltandoVars === 0 ? 100 : Math.round(((LAB_VARS.length - faltandoVars) / LAB_VARS.length) * 100)}
          hint={faltandoVars === 0 ? 'Tudo preenchido' : `${faltandoVars} em branco`} onClick={() => setAba(ABA_CONFIGURAR)} />
        <ProgressoResumo label="Checklist de preparação" pct={prep.pct} hint={`${prep.concluidos}/${prep.total}`} onClick={() => setAba(ABA_CHECKLIST)} />
        <ProgressoResumo label="Exercícios" pct={exerc.pct} hint={`${exerc.concluidos}/${exerc.total}`} onClick={() => setAba(ABA_EXERCICIOS)} />
      </div>

      <TabView className="iv-mt" activeIndex={aba} onTabChange={(e) => setAba(e.index)}>
        <TabPanel header="Configurar meu ambiente">
          <LabVarsPanel vars={vars} onChange={salvarVars} />
        </TabPanel>
        <TabPanel header="Alvos do range">
          <AlvosPanel />
        </TabPanel>
        <TabPanel header="Checklist &amp; documentação">
          <ChecklistPanel vars={vars} onAbrirLab={() => setAba(ABA_CONFIGURAR)} />
        </TabPanel>
        <TabPanel header="Exercícios">
          <ExerciciosPanel vars={vars} onAbrirLab={() => setAba(ABA_CONFIGURAR)} />
        </TabPanel>
      </TabView>
    </div>
  );
}

/** Pílula clicável de progresso agregado, no cabeçalho, para orientar por onde continuar. */
function ProgressoResumo({ label, pct, hint, onClick }: { label: string; pct: number; hint: string; onClick: () => void }) {
  const tone = pct === 100 ? 'ok' : pct > 0 ? 'warn' : 'crit';
  return (
    <button type="button" onClick={onClick} className="iv-card" style={{ padding: '.6rem .9rem', minWidth: 190, textAlign: 'left', cursor: 'pointer', border: 0 }}>
      <div className="iv-muted" style={{ fontSize: '.78rem' }}>{label}</div>
      <div className="iv-row" style={{ gap: '.5rem', alignItems: 'baseline' }}>
        <strong style={{ fontSize: '1.1rem' }}>{pct}%</strong>
        <span className="iv-muted" style={{ fontSize: '.78rem' }}>{hint}</span>
      </div>
      <Bar pct={pct} tone={tone} />
    </button>
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

// ===================== Aba 3: Checklist de preparação =====================

const GRUPOS: RangeChecklistItem['grupo'][] = ['rede', 'firewall', 'vms', 'monitoramento', 'seguranca_operacional'];

function ChecklistPanel({ vars, onAbrirLab }: { vars: LabVars; onAbrirLab: () => void }) {
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
                    <button type="button" className="p-button p-button-text p-button-sm" style={{ padding: '.15rem 0', marginTop: '.2rem' }} onClick={() => setSel(item)}>
                      <i className="pi pi-sparkles" style={{ marginRight: '.35rem' }} />
                      {(item.recursos ?? []).length} recursos a criar · prompt pronto
                    </button>
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

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 'min(760px, 100vw)' }}>
        {sel && (
          <ChecklistDetalhe key={sel.id} item={sel} vars={vars}
            progresso={progresso[sel.id] ?? getProgressoChecklist(sel.id)}
            onSave={(p) => salvar(sel.id, p)}
            onAbrirLab={() => { setSel(null); onAbrirLab(); }} />
        )}
      </Sidebar>
    </div>
  );
}

// ===================== Aba 4: Exercícios (Lab 9 e Atomic/Caldera) =====================

function ExerciciosPanel({ vars, onAbrirLab }: { vars: LabVars; onAbrirLab: () => void }) {
  const { data } = useQuery({ queryKey: ['range-exercicios'], queryFn: listRangeExercicios });
  const [sel, setSel] = useState<RangeChecklistItem | null>(null);
  const [progresso, setProgresso] = useState<Record<string, RangeProgressoItem>>(() => listProgressoChecklist());
  const resumo = useMemo(() => resumoExercicios(), [progresso]);
  const prep = useMemo(() => resumoChecklist(), [progresso]);

  function salvar(id: string, novo: RangeProgressoItem) {
    saveProgressoChecklist(id, novo);
    setProgresso((atual) => ({ ...atual, [id]: getProgressoChecklist(id) }));
  }

  return (
    <div>
      <StatusStrip tone="warn" icon="pi-shield">
        Estes são os exercícios ofensivos/purple do range (infecção simulada, emulação de adversário). Só execute depois
        de concluir o checklist de preparação (isolamento, snapshots, credenciais) — hoje {prep.concluidos}/{prep.total}
        {' '}({prep.pct}%). Tudo acontece só dentro da VLAN do range, nunca em produção.
      </StatusStrip>
      <div className="iv-mt"><Bar pct={resumo.pct} tone={resumo.pct === 100 ? 'ok' : resumo.pct > 0 ? 'warn' : 'crit'} /></div>

      <div className="iv-col iv-mt" style={{ gap: '.5rem' }}>
        {(data ?? []).map((item) => {
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
                    <button type="button" className="p-button p-button-text p-button-sm" style={{ padding: '.15rem 0', marginTop: '.2rem' }} onClick={() => setSel(item)}>
                      <i className="pi pi-sparkles" style={{ marginRight: '.35rem' }} />
                      {(item.recursos ?? []).length} recursos a criar · prompt pronto
                    </button>
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

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 'min(760px, 100vw)' }}>
        {sel && (
          <ChecklistDetalhe key={sel.id} item={sel} vars={vars}
            progresso={progresso[sel.id] ?? getProgressoChecklist(sel.id)}
            onSave={(p) => salvar(sel.id, p)}
            onAbrirLab={() => { setSel(null); onAbrirLab(); }} />
        )}
      </Sidebar>
    </div>
  );
}

function ChecklistDetalhe({ item, vars, progresso, onSave, onAbrirLab }: {
  item: RangeChecklistItem; vars: LabVars; progresso: RangeProgressoItem;
  onSave: (p: RangeProgressoItem) => void; onAbrirLab: () => void;
}) {
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

      {(item.recursos ?? []).length > 0 && (
        <DetailSection title="O que você vai criar no ambiente">
          <div className="iv-col" style={{ gap: '.5rem' }}>
            {(item.recursos ?? []).map((r, i) => (
              <div key={i} style={{ fontSize: '.88rem' }}>
                <div className="iv-row iv-wrap" style={{ gap: '.4rem' }}>
                  <Pill label={TIPO_RECURSO_LABEL[r.tipo]} />
                  <strong>{preencher(r.nome, vars)}</strong>
                </div>
                <div className="iv-muted">{preencher(r.onde, vars)} — {preencher(r.detalhe, vars)}</div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      <PromptEtapa item={item} vars={vars} onAbrirLab={onAbrirLab} />

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

// ===================== Prompt pronto de cada etapa =====================

function PromptEtapa({ item, vars, onAbrirLab }: { item: RangeChecklistItem; vars: LabVars; onAbrirLab: () => void }) {
  const [marcados, setMarcados] = useState<string[]>([]);
  const [pedidoLivre, setPedidoLivre] = useState('');
  const [editado, setEditado] = useState<string | undefined>(() => getPromptEditado(item.id));
  const [copiado, setCopiado] = useState(false);

  const pedidos = [...(item.prompt?.pedidos ?? []), ...PEDIDOS_GERAIS];
  const gerado = useMemo(
    () => montarPrompt(item, vars, { pedidos: marcados.map((p) => preencher(p, vars)), pedidoLivre }),
    [item, vars, marcados, pedidoLivre],
  );
  const faltando = useMemo(() => faltandoNoPrompt(item, vars), [item, vars]);
  const texto = editado ?? gerado;

  function alternar(pedido: string) {
    setMarcados((atual) => (atual.includes(pedido) ? atual.filter((p) => p !== pedido) : [...atual, pedido]));
  }
  function editar(novo: string) {
    const valor = novo === gerado ? undefined : novo;
    savePromptEditado(item.id, valor);
    setEditado(valor);
  }
  function copiar() {
    copyToClipboard(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <DetailSection title="Prompt pronto para a IA">
      {faltando.length > 0 && (
        <StatusStrip tone="warn" icon="pi-exclamation-triangle">
          Faltam {faltando.length} dados do seu lab neste prompt (aparecem como [PREENCHER]).{' '}
          <button type="button" className="p-button p-button-text p-button-sm" style={{ padding: 0 }} onClick={onAbrirLab}>
            Preencher em "Meu lab"
          </button>
        </StatusStrip>
      )}

      {editado === undefined ? (
        <>
          <p className="iv-muted" style={{ fontSize: '.84rem', margin: '.6rem 0 .3rem' }}>Acrescentar pedidos (opcional):</p>
          <div className="iv-col" style={{ gap: '.3rem' }}>
            {pedidos.map((p) => (
              <label key={p} className="iv-row" style={{ gap: '.5rem', alignItems: 'flex-start', fontSize: '.86rem' }}>
                <Checkbox checked={marcados.includes(p)} onChange={() => alternar(p)} />
                <span>{preencher(p, vars)}</span>
              </label>
            ))}
          </div>
          <label className="iv-col iv-mt">Seu pedido (opcional)
            <InputTextarea value={pedidoLivre} rows={2} autoResize onChange={(e) => setPedidoLivre(e.target.value)}
              placeholder="Ex.: quero fazer tudo pela interface gráfica; ou: já criei a VLAN, falta só o trunk." />
          </label>
        </>
      ) : (
        <p className="iv-muted" style={{ fontSize: '.84rem' }}>
          Você editou este prompt à mão; a versão editada fica salva neste navegador. Restaure o gerado para voltar a usar
          os pedidos rápidos e os dados de "Meu lab".
        </p>
      )}

      <label className="iv-col iv-mt">Prompt (pode editar antes de copiar)
        <InputTextarea value={texto} rows={18} onChange={(e) => editar(e.target.value)}
          style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '.8rem', width: '100%' }} />
      </label>
      <div className="iv-row iv-wrap iv-mt">
        <Button label={copiado ? 'Copiado' : 'Copiar prompt'} icon={copiado ? 'pi pi-check' : 'pi pi-copy'} size="small" onClick={copiar} />
        {editado !== undefined && (
          <Button label="Restaurar o gerado" icon="pi pi-refresh" size="small" outlined onClick={() => editar(gerado)} />
        )}
      </div>
    </DetailSection>
  );
}

// ===================== Aba 3: variáveis do lab =====================

function LabVarsPanel({ vars, onChange }: { vars: LabVars; onChange: (v: LabVars) => void }) {
  const faltando = LAB_VARS.filter((v) => !valorVar(v.chave, vars)).length;
  return (
    <div>
      <StatusStrip tone={faltando ? 'warn' : 'ok'} icon="pi-sliders-h">
        {faltando ? `${faltando} de ${LAB_VARS.length} dados ainda em branco.` : 'Todos os dados preenchidos.'}{' '}
        Eles entram nos prompts e na lista de recursos de cada etapa e ficam salvos só neste navegador. Não coloque senhas aqui.
      </StatusStrip>
      <div className="iv-row iv-mt">
        <label className="p-button p-component p-button-outlined p-button-sm" style={{ cursor: 'pointer' }}>
          <span className="p-button-icon p-button-icon-left pi pi-upload" />
          <span className="p-button-label">Importar arquivo</span>
          <input type="file" accept="application/json,.json" hidden onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            void file.text().then((texto) => {
              const dados: unknown = JSON.parse(texto);
              if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return;
              const validos = Object.entries(dados).filter(([k, v]) => typeof v === 'string' && LAB_VARS.some((d) => d.chave === k));
              onChange({ ...vars, ...Object.fromEntries(validos) as LabVars });
            }).catch(() => undefined);
          }} />
        </label>
        <span className="iv-muted" style={{ fontSize: '.82rem' }}>Carrega os dados levantados direto nos equipamentos.</span>
      </div>
      <div className="iv-form iv-mt">
        {GRUPOS_LAB_VAR.map((g) => (
          <fieldset key={g}>
            <legend>{GRUPO_LAB_VAR_LABEL[g]}</legend>
            <div className="iv-form__grid">
              {LAB_VARS.filter((v) => v.grupo === g).map((v) => (
                <div key={v.chave} className="iv-field">
                  <label htmlFor={`labvar-${v.chave}`}>{v.rotulo}</label>
                  <InputText id={`labvar-${v.chave}`} value={vars[v.chave] ?? v.padrao ?? ''} placeholder={`Ex.: ${v.exemplo}`}
                    onChange={(e) => onChange({ ...vars, [v.chave]: e.target.value })} />
                  {v.dica && <span className="iv-field__hint">{v.dica}</span>}
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
