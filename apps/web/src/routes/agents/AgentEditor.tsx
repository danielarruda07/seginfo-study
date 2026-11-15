import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { TabView, TabPanel } from 'primereact/tabview';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { SelectButton } from 'primereact/selectbutton';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import {
  AUTONOMIAS, CANAIS_AGENTE, CANAIS_ENTRADA_DE_TERCEIROS, especificacaoMarkdown, revisarAgente, ROTULO_AUTONOMIA,
  type AgenteConfig, type AgenteFerramenta, type AgenteStatus, type CanalAgente,
} from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { Chip, Pill, StatusStrip } from '@/components/InfraKit';
import { getAgente, updateAgente, deleteAgente, listTagsBase, erroApi, problemasApi } from '@/services/agentes';
import { FERRAMENTAS_CATALOGO, RISCO_LABEL } from '@/data/agentesFerramentas';
import { CANAL_LABEL, RISCO_TONE } from './regras';
import '@/styles/telas/agents.css';
import { STATUS_LABEL } from './home/regras';

interface Form { nome: string; resumo: string; status: AgenteStatus; config: AgenteConfig }
type Secao = Exclude<keyof AgenteConfig, 'ferramentas'>;

const STATUS_OPTS = (Object.keys(STATUS_LABEL) as AgenteStatus[]).map((v) => ({ label: STATUS_LABEL[v], value: v }));

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="iv-col" style={{ gap: '.3rem' }}>
      <span style={{ fontSize: '.84rem', fontWeight: 600 }}>{rotulo}</span>
      {children}
      {dica && <small className="iv-muted">{dica}</small>}
    </label>
  );
}

export function AgentEditor() {
  const { agenteId } = useParams({ strict: false }) as { agenteId?: string };
  const navigate = useNavigate();
  const qc = useQueryClient();

  const agente = useQuery({ queryKey: ['agente', agenteId], queryFn: () => getAgente(agenteId as string), enabled: !!agenteId });
  const tagsBase = useQuery({ queryKey: ['agentes-base-tags'], queryFn: listTagsBase });

  const [form, setForm] = useState<Form | null>(null);
  const [aba, setAba] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ sev: 'success' | 'error'; texto: string; problemas?: string[] } | null>(null);
  const [tagNova, setTagNova] = useState('');
  const [catalogoSel, setCatalogoSel] = useState<string | null>(null);

  useEffect(() => {
    if (agente.data) {
      const { nome, resumo, status, config } = agente.data;
      setForm({ nome, resumo, status, config });
    }
  }, [agente.data]);

  const revisao = useMemo(() => (form ? revisarAgente(form.config) : []), [form]);
  const markdown = useMemo(() => (form ? especificacaoMarkdown(form.nome, form.resumo, form.status, form.config) : ''), [form]);

  if (agente.isError) {
    return (
      <div>
        <PageHeader title="Agente não encontrado" subtitle="Ele pode ter sido excluído, ou a API está indisponível." />
        <Link to="/agents">Voltar para Agents</Link>
      </div>
    );
  }
  if (!form) return <div className="route-loading" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Carregando agente…</div>;

  const cfg = form.config;
  const alterar = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  function secao<K extends Secao>(k: K, patch: Partial<AgenteConfig[K]>) {
    setForm((f) => (f ? { ...f, config: { ...f.config, [k]: { ...f.config[k], ...patch } } as AgenteConfig } : f));
  }
  const setFerramentas = (ferramentas: AgenteFerramenta[]) => setForm((f) => (f ? { ...f, config: { ...f.config, ferramentas } } : f));

  const catalogoDisponivel = FERRAMENTAS_CATALOGO.filter((c) => !cfg.ferramentas.some((f) => f.id === c.id));

  function adicionarDoCatalogo() {
    const c = FERRAMENTAS_CATALOGO.find((x) => x.id === catalogoSel);
    if (!c) return;
    setFerramentas([...cfg.ferramentas, {
      id: c.id, nome: c.nome, permissao: c.permissaoSugerida, exigeAprovacao: c.aprovacaoSugerida, observacao: '',
    }]);
    setCatalogoSel(null);
  }
  const alterarFerramenta = (i: number, patch: Partial<AgenteFerramenta>) =>
    setFerramentas(cfg.ferramentas.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  function alternarTag(tag: string) {
    const tags = cfg.conhecimento.tags.includes(tag) ? cfg.conhecimento.tags.filter((t) => t !== tag) : [...cfg.conhecimento.tags, tag];
    secao('conhecimento', { tags });
  }
  function adicionarTag() {
    const t = tagNova.trim().toLowerCase();
    if (t && !cfg.conhecimento.tags.includes(t)) secao('conhecimento', { tags: [...cfg.conhecimento.tags, t] });
    setTagNova('');
  }
  const alternarCanal = (c: CanalAgente) =>
    secao('interface', { canais: cfg.interface.canais.includes(c) ? cfg.interface.canais.filter((x) => x !== c) : [...cfg.interface.canais, c] });

  async function salvar() {
    if (!form || !agenteId) return;
    setSalvando(true); setMsg(null);
    try {
      await updateAgente(agenteId, { nome: form.nome, resumo: form.resumo, status: form.status, config: form.config });
      setMsg({ sev: 'success', texto: 'Agente salvo.' });
      qc.invalidateQueries({ queryKey: ['agentes'] });
      qc.invalidateQueries({ queryKey: ['agente', agenteId] });
    } catch (e) {
      setMsg({ sev: 'error', texto: erroApi(e, 'Falha ao salvar.'), problemas: problemasApi(e) });
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!agenteId || !window.confirm('Excluir este agente e as avaliações dele? Isso não tem volta.')) return;
    try {
      await deleteAgente(agenteId);
      qc.invalidateQueries({ queryKey: ['agentes'] });
      navigate({ to: '/agents' });
    } catch (e) {
      setMsg({ sev: 'error', texto: erroApi(e, 'Falha ao excluir.') });
    }
  }

  function baixar() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agente-${(form?.nome || 'sem-nome').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agente'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const erros = revisao.filter((r) => r.nivel === 'erro').length;
  const area = { width: '100%' } as const;

  return (
    <div>
      <PageHeader
        title={form.nome || 'Agente'}
        subtitle="Preencha os pilares na ordem do infográfico. A aba final mostra a revisão de segurança e a especificação."
        actions={
          <div className="iv-row iv-wrap">
            <Button label="Salvar" icon="pi pi-save" onClick={salvar} loading={salvando} />
            {agenteId && form.status !== 'arquivado' && (
              <Link to="/agents/agente/$agenteId/playground" params={{ agenteId }} search={{}} className="ag-btn"><i className="pi pi-play" aria-hidden="true" /> Executar</Link>
            )}
            <Link to="/agents" className="ag-btn"><i className="pi pi-arrow-left" aria-hidden="true" /> Voltar</Link>
            {form.status === 'arquivado' && <Button label="Excluir definitivamente" icon="pi pi-trash" severity="danger" outlined onClick={excluir} />}
          </div>
        }
      />

      {msg && (
        <Message severity={msg.sev} style={{ width: '100%', marginBottom: '1rem' }}
          content={<div><div>{msg.texto}</div>{msg.problemas && msg.problemas.length > 0 && <ul style={{ margin: '.4rem 0 0', paddingLeft: '1.1rem' }}>{msg.problemas.map((p) => <li key={p}>{p}</li>)}</ul>}</div>} />
      )}

      <div className="iv-card">
        <div className="iv-row iv-wrap" style={{ alignItems: 'flex-end', gap: '1rem' }}>
          <div style={{ flex: 2, minWidth: 220 }}>
            <Campo rotulo="Nome"><InputText value={form.nome} maxLength={80} onChange={(e) => alterar({ nome: e.target.value })} /></Campo>
          </div>
          <div style={{ flex: 3, minWidth: 260 }}>
            <Campo rotulo="Resumo"><InputText value={form.resumo} maxLength={300} onChange={(e) => alterar({ resumo: e.target.value })} /></Campo>
          </div>
          <div style={{ minWidth: 160 }}>
            <Campo rotulo="Status"><Dropdown value={form.status} options={STATUS_OPTS} onChange={(e) => alterar({ status: e.value })} /></Campo>
          </div>
        </div>
        {form.status === 'ativo' && erros > 0 && (
          <p className="ag-erro" role="alert">
            Há {erros} pendência(s) grave(s): o servidor não deixa salvar como Ativo até resolvê-las (veja a última aba).
          </p>
        )}
      </div>

      <TabView activeIndex={aba} onTabChange={(e) => setAba(e.index)} className="iv-mt" scrollable>
        <TabPanel header="1 Propósito" leftIcon="pi pi-bullseye mr-2">
          <div className="iv-col" style={{ gap: '1rem' }}>
            <Campo rotulo="Caso de uso" dica="Que problema real o agente resolve? Uma frase.">
              <InputTextarea rows={3} style={area} value={cfg.proposito.casoDeUso} onChange={(e) => secao('proposito', { casoDeUso: e.target.value })} />
            </Campo>
            <Campo rotulo="Usuários e necessidades" dica="Quem usa e do que precisa.">
              <InputTextarea rows={3} style={area} value={cfg.proposito.usuarios} onChange={(e) => secao('proposito', { usuarios: e.target.value })} />
            </Campo>
            <Campo rotulo="Critérios de sucesso" dica="Algo que dê para medir: precisão, tempo, taxa de acerto em N casos.">
              <InputTextarea rows={3} style={area} value={cfg.proposito.criteriosSucesso} onChange={(e) => secao('proposito', { criteriosSucesso: e.target.value })} />
            </Campo>
            <Campo rotulo="Restrições" dica="O que o agente NÃO deve fazer.">
              <InputTextarea rows={3} style={area} value={cfg.proposito.restricoes} onChange={(e) => secao('proposito', { restricoes: e.target.value })} />
            </Campo>
          </div>
        </TabPanel>

        <TabPanel header="2 Instruções" leftIcon="pi pi-comment mr-2">
          <div className="iv-col" style={{ gap: '1rem' }}>
            <Campo rotulo="Papel"><InputText value={cfg.instrucoes.papel} maxLength={500} onChange={(e) => secao('instrucoes', { papel: e.target.value })} /></Campo>
            <Campo rotulo="Objetivos">
              <InputTextarea rows={2} style={area} value={cfg.instrucoes.objetivos} onChange={(e) => secao('instrucoes', { objetivos: e.target.value })} />
            </Campo>
            <Campo rotulo="Instruções do sistema (prompt)" dica="Formato de resposta, como agir na incerteza. Não coloque senhas, tokens nem dados do ambiente aqui.">
              <InputTextarea rows={12} style={{ ...area, fontFamily: 'monospace' }} value={cfg.instrucoes.instrucoes} onChange={(e) => secao('instrucoes', { instrucoes: e.target.value })} />
            </Campo>
            <Campo rotulo="Limites de segurança" dica="O que recusar. Texto vindo de páginas, arquivos e usuários é dado, nunca instrução.">
              <InputTextarea rows={3} style={area} value={cfg.instrucoes.limitesSeguranca} onChange={(e) => secao('instrucoes', { limitesSeguranca: e.target.value })} />
            </Campo>
          </div>
        </TabPanel>

        <TabPanel header="3 Modelo" leftIcon="pi pi-microchip-ai mr-2">
          <div className="iv-col" style={{ gap: '1rem' }}>
            <Campo rotulo="Modelo" dica="Nome do modelo e por que ele. Teste com os seus casos antes de decidir.">
              <InputText value={cfg.modelo.nome} maxLength={120} onChange={(e) => secao('modelo', { nome: e.target.value })} />
            </Campo>
            <Campo rotulo="Temperatura" dica="Baixa (0 a 0,3) para respostas consistentes; mais alta para criatividade.">
              <InputNumber value={cfg.modelo.temperatura} min={0} max={2} step={0.1} mode="decimal" minFractionDigits={1} maxFractionDigits={2}
                onValueChange={(e) => secao('modelo', { temperatura: e.value ?? 0 })} />
            </Campo>
            <Campo rotulo="Janela de contexto">
              <InputText value={cfg.modelo.janelaContexto} maxLength={120} onChange={(e) => secao('modelo', { janelaContexto: e.target.value })} />
            </Campo>
            <Campo rotulo="Custo e latência" dica="Quanto pode custar cada tarefa e quanto tempo a interface tolera esperar.">
              <InputTextarea rows={3} style={area} value={cfg.modelo.custoLatencia} onChange={(e) => secao('modelo', { custoLatencia: e.target.value })} />
            </Campo>
          </div>
        </TabPanel>

        <TabPanel header="4 Ferramentas" leftIcon="pi pi-wrench mr-2">
          <div className="iv-col" style={{ gap: '.8rem' }}>
            {cfg.ferramentas.length === 0 && <p className="iv-muted" style={{ margin: 0 }}>Nenhuma ferramenta. Um agente sem ferramentas só conversa, e isso já é um começo seguro.</p>}
            {cfg.ferramentas.map((f, i) => {
              const cat = FERRAMENTAS_CATALOGO.find((c) => c.id === f.id);
              const semAprovacao = f.permissao === 'escrita' && !f.exigeAprovacao;
              return (
                <div key={`${f.id}-${i}`} className="iv-card" style={{ padding: '.8rem 1rem' }}>
                  <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
                    <strong>{f.nome}</strong>
                    <div className="iv-row">
                      {cat && <Pill label={`risco ${RISCO_LABEL[cat.risco].toLowerCase()}`} tone={RISCO_TONE[cat.risco]} />}
                      <Button icon="pi pi-trash" text severity="danger" aria-label={`Remover ${f.nome}`} onClick={() => setFerramentas(cfg.ferramentas.filter((_, j) => j !== i))} />
                    </div>
                  </div>
                  {cat && <p className="iv-muted" style={{ margin: '.2rem 0 .6rem', fontSize: '.82rem' }}>{cat.cuidados}</p>}
                  <div className="iv-row iv-wrap" style={{ gap: '1rem' }}>
                    <Dropdown value={f.permissao} options={[{ label: 'Leitura', value: 'leitura' }, { label: 'Escrita', value: 'escrita' }]}
                      onChange={(e) => alterarFerramenta(i, { permissao: e.value, exigeAprovacao: e.value === 'escrita' ? true : f.exigeAprovacao })} aria-label="Permissão" />
                    <label className="iv-row" style={{ gap: '.4rem' }}>
                      <Checkbox checked={f.exigeAprovacao} onChange={(e) => alterarFerramenta(i, { exigeAprovacao: !!e.checked })} />
                      <span>Exige aprovação humana</span>
                    </label>
                    <InputText style={{ flex: 1, minWidth: 200 }} value={f.observacao} maxLength={300} placeholder="Observação (escopo, limites)" aria-label="Observação"
                      onChange={(e) => alterarFerramenta(i, { observacao: e.target.value })} />
                  </div>
                  {semAprovacao && <p className="ag-erro">Escrita sem aprovação humana: o servidor bloqueia o status Ativo.</p>}
                </div>
              );
            })}
            <div className="iv-row iv-wrap" style={{ gap: '.6rem' }}>
              <Dropdown value={catalogoSel} options={catalogoDisponivel.map((c) => ({ label: c.nome, value: c.id }))} onChange={(e) => setCatalogoSel(e.value)}
                placeholder="Adicionar do catálogo" filter style={{ minWidth: 320 }} aria-label="Adicionar ferramenta do catálogo" />
              <Button label="Adicionar" icon="pi pi-plus" outlined onClick={adicionarDoCatalogo} disabled={!catalogoSel} />
              <Link to="/agents/ferramentas">Ver o catálogo e os cuidados</Link>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="5 Memória" leftIcon="pi pi-database mr-2">
          <div className="iv-col" style={{ gap: '1rem' }}>
            {([
              ['episodica', 'Episódica', 'Lembra conversas anteriores.'],
              ['trabalho', 'Memória de trabalho', 'Contexto da tarefa em andamento.'],
              ['vetorial', 'Banco vetorial', 'Busca por significado em muitos documentos.'],
              ['sql', 'Banco SQL / estruturado', 'Fatos e registros consultáveis.'],
              ['arquivos', 'Armazenamento de arquivos', 'Documentos e saídas guardados.'],
            ] as const).map(([chave, titulo, dica]) => (
              <label key={chave} className="iv-row" style={{ gap: '.6rem', alignItems: 'flex-start' }}>
                <Checkbox checked={cfg.memoria[chave]} onChange={(e) => secao('memoria', { [chave]: !!e.checked } as Partial<AgenteConfig['memoria']>)} />
                <span><strong>{titulo}</strong><br /><small className="iv-muted">{dica}</small></span>
              </label>
            ))}
            <Campo rotulo="Privacidade e retenção" dica="O que pode ser guardado, por quanto tempo, e o que nunca entra.">
              <InputTextarea rows={3} style={area} value={cfg.memoria.privacidade} onChange={(e) => secao('memoria', { privacidade: e.target.value })} />
            </Campo>

            <div className="iv-card">
              <h4 style={{ margin: '0 0 .3rem' }}>Base de conhecimento</h4>
              <p className="iv-muted" style={{ marginTop: 0, fontSize: '.84rem' }}>
                Escolha as tags do Segundo Cérebro que este agente pode consultar. Sem tags, a base é vazia. Só entram notas pessoais; material corporativo fica de fora.
              </p>
              <div className="iv-row iv-wrap">
                {(tagsBase.data ?? []).map((t) => (
                  <Chip key={t.tag} label={`${t.tag} (${t.total})`} active={cfg.conhecimento.tags.includes(t.tag)} onClick={() => alternarTag(t.tag)} />
                ))}
                {cfg.conhecimento.tags.filter((t) => !(tagsBase.data ?? []).some((x) => x.tag === t)).map((t) => (
                  <Chip key={t} label={`${t} (sem notas)`} active onClick={() => alternarTag(t)} />
                ))}
                {(tagsBase.data ?? []).length === 0 && cfg.conhecimento.tags.length === 0 && <span className="iv-muted" style={{ fontSize: '.84rem' }}>Ainda não há tags no Segundo Cérebro.</span>}
              </div>
              <div className="iv-row iv-mt" style={{ gap: '.5rem' }}>
                <InputText value={tagNova} placeholder="Outra tag (Enter)" aria-label="Adicionar tag" onChange={(e) => setTagNova(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && adicionarTag()} />
                <Link to="/agents/base">Testar a base</Link>
                <Link to="/cerebro">Abrir o Segundo Cérebro</Link>
              </div>
              <Campo rotulo="Notas sobre a base">
                <InputTextarea rows={2} style={area} value={cfg.conhecimento.observacao} onChange={(e) => secao('conhecimento', { observacao: e.target.value })} />
              </Campo>
            </div>
          </div>
        </TabPanel>

        <TabPanel header="6 Orquestração" leftIcon="pi pi-sitemap mr-2">
          <div className="iv-col" style={{ gap: '1rem' }}>
            <Campo rotulo="Fluxo" dica="Os passos, em ordem. Prefira um fluxo fixo antes de dar autonomia.">
              <InputTextarea rows={4} style={area} value={cfg.orquestracao.fluxo} onChange={(e) => secao('orquestracao', { fluxo: e.target.value })} />
            </Campo>
            <Campo rotulo="Gatilhos" dica="O que inicia o agente: pedido manual, horário, evento.">
              <InputTextarea rows={2} style={area} value={cfg.orquestracao.gatilhos} onChange={(e) => secao('orquestracao', { gatilhos: e.target.value })} />
            </Campo>
            <Campo rotulo="Tratamento de erros" dica="Timeouts, número de tentativas, limite de passos e de custo, o que fazer ao falhar.">
              <InputTextarea rows={3} style={area} value={cfg.orquestracao.tratamentoErros} onChange={(e) => secao('orquestracao', { tratamentoErros: e.target.value })} />
            </Campo>
            <Campo rotulo="Vários agentes" dica="Se houver, quem delega a quem e com que permissões.">
              <InputTextarea rows={2} style={area} value={cfg.orquestracao.multiAgente} onChange={(e) => secao('orquestracao', { multiAgente: e.target.value })} />
            </Campo>
          </div>
        </TabPanel>

        <TabPanel header="7 Interface" leftIcon="pi pi-desktop mr-2">
          <div className="iv-col" style={{ gap: '1rem' }}>
            <div>
              <strong>Canais</strong>
              <div className="iv-row iv-wrap iv-mt">
                {CANAIS_AGENTE.map((c) => (
                  <Chip key={c} label={CANAL_LABEL[c] + (CANAIS_ENTRADA_DE_TERCEIROS.includes(c) ? ' (terceiros)' : '')}
                    active={cfg.interface.canais.includes(c)} onClick={() => alternarCanal(c)} />
                ))}
              </div>
              <small className="iv-muted">Canais marcados "terceiros" recebem texto de pessoas fora do seu controle: trate como hostil.</small>
            </div>
            <Campo rotulo="Notas da interface" dica="Quem tem acesso, como se autentica, o que o usuário vê do que o agente fez.">
              <InputTextarea rows={3} style={area} value={cfg.interface.notas} onChange={(e) => secao('interface', { notas: e.target.value })} />
            </Campo>
          </div>
        </TabPanel>

        <TabPanel header="Supervisão" leftIcon="pi pi-eye mr-2">
          <div className="iv-col" style={{ gap: '1rem' }}>
            <Campo rotulo="Decisões que exigem um humano" dica="Autonomia precisa de limites. Liste o que nunca acontece sem aprovação.">
              <InputTextarea rows={4} style={area} value={cfg.supervisao.decisoesCriticas} onChange={(e) => secao('supervisao', { decisoesCriticas: e.target.value })} />
            </Campo>
            <Campo rotulo="Autonomia nas ações de escrita" dica="Quem decide o que é leve é o servidor, pelos parâmetros de cada ação. Apagar, reverter snapshot, desligar à força, ativar policy e comandos livres dentro das VMs sempre pedem aprovação.">
              <SelectButton value={cfg.supervisao.autonomia} options={AUTONOMIAS.map((v) => ({ label: ROTULO_AUTONOMIA[v], value: v }))}
                onChange={(e) => e.value && secao('supervisao', { autonomia: e.value })} aria-label="Autonomia nas ações de escrita" />
            </Campo>
            <label className="iv-row" style={{ gap: '.6rem' }}>
              <Checkbox checked={cfg.supervisao.registroAuditoria} onChange={(e) => secao('supervisao', { registroAuditoria: !!e.checked })} />
              <span><strong>Registro de auditoria</strong><br /><small className="iv-muted">Guardar quem pediu o quê, o que o agente fez e quando.</small></span>
            </label>
            <Link to="/agents/avaliacoes" search={{ agente: agenteId }}>Registrar testes e avaliações deste agente</Link>
          </div>
        </TabPanel>

        <TabPanel header="Revisão e especificação" leftIcon="pi pi-check-square mr-2">
          <div className="iv-col" style={{ gap: '1rem' }}>
            <StatusStrip tone={erros > 0 ? 'crit' : revisao.length > 0 ? 'warn' : 'ok'} icon="pi-shield">
              {revisao.length === 0 ? 'Nenhuma pendência. O projeto cobre os pilares e os limites de segurança.' : `${erros} pendência(s) grave(s) e ${revisao.length - erros} aviso(s).`}
            </StatusStrip>
            {revisao.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {revisao.map((r) => (
                  <li key={r.codigo} style={{ marginBottom: '.35rem' }}>
                    <Pill label={r.nivel === 'erro' ? 'Grave' : 'Aviso'} tone={r.nivel === 'erro' ? 'danger' : 'warning'} icon={r.nivel === 'erro' ? 'pi-exclamation-circle' : 'pi-info-circle'} /> {r.texto}
                  </li>
                ))}
              </ul>
            )}
            <div className="iv-row iv-wrap">
              <Button label="Copiar especificação" icon="pi pi-copy" outlined onClick={() => navigator.clipboard?.writeText(markdown)} />
              <Button label="Baixar .md" icon="pi pi-download" outlined onClick={baixar} />
            </div>
            <pre className="agd-code agd-code--alto" tabIndex={0} aria-label="Especificação em Markdown">{markdown}</pre>
          </div>
        </TabPanel>
      </TabView>
    </div>
  );
}
