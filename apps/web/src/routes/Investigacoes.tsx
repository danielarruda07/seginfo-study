import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { ClickCard } from '@/components/ui/ClickCard';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { DetailSection } from '@/components/ui/Detail';
import { Pill, StatusStrip } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { useDebounce } from '@/hooks/useDebounce';
import { listarPericias, getPericia, type PericiaItem, type PericiaEvento } from '@/services/pericia';

const dataHora = (v: string) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
const bytes = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
const acaoLabel: Record<string, string> = {
  login_ok: 'Acesso aceito pelo honeypot', login_falha: 'Tentativa de acesso', comando: 'Comando observado',
  download: 'Transferência observada', tunel: 'Túnel/proxy', scan: 'Reconhecimento', bloqueio: 'Bloqueio de rede',
};
const explicacaoArquivo = (caminho: string, tipo: string) => {
  if (tipo === 'elf') return 'Executável Linux: pode ser uma ferramenta ou carga. O laudo registra tipo e hash; isso não confirma execução.';
  if (tipo === 'pe') return 'Executável Windows: pode ser uma ferramenta ou carga. O laudo registra tipo e hash; isso não confirma execução.';
  if (tipo === 'script' || /\.(sh|py|pl|ps1|bat)$/i.test(caminho)) return 'Script: conteúdo ou metadados podem indicar a ação pretendida; a extensão sozinha não prova execução.';
  return 'Arquivo criado ou alterado desde o snapshot limpo. Compare caminho, horário e hash com os eventos da janela.';
};

function LinhaDoTempo({ evento }: { evento: PericiaEvento }) {
  const mitre = evento.mitre.flatMap((x) => x && typeof x === 'object' && 'id' in x && typeof x.id === 'string'
    ? [{ id: x.id, nome: 'nome' in x && typeof x.nome === 'string' ? x.nome : '' }] : []);
  return <li key={evento.id} className="iv-card" style={{ padding: '.75rem', marginBottom: '.5rem' }}>
    <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
      <strong>{acaoLabel[evento.acao] ?? evento.acao}</strong><time className="iv-muted tabular">{dataHora(evento.quando)}</time>
    </div>
    <p className="iv-muted" style={{ margin: '.35rem 0' }}>
      {evento.ip ?? 'origem não informada'}{evento.pais ? ` · ${evento.pais}` : ''} · {evento.servico ?? 'serviço não informado'}{evento.porta ? `:${evento.porta}` : ''} · {evento.fonte}
    </p>
    {evento.comando && <pre className="laudo-pre">{evento.comando}</pre>}
    {mitre.length > 0 && <div className="iv-row iv-wrap">{mitre.map((m) => <a key={m.id} href={`https://attack.mitre.org/techniques/${m.id.replace('.', '/')}/`} target="_blank" rel="noreferrer noopener" className="mono">{m.id}{m.nome ? ` · ${m.nome}` : ''}</a>)}</div>}
  </li>;
}

function Dossie({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['pericia', id], queryFn: () => getPericia(id) });
  const [filtroEvento, setFiltroEvento] = useState('');
  if (q.isLoading) return <p className="iv-muted">Carregando evidências…</p>;
  if (q.isError || !q.data) return <Message severity="warn" text="Não foi possível carregar esta investigação." />;
  const p = q.data; const d = p.dados;
  const eventosVisiveis = p.linhaTempo.filter((e) => !filtroEvento ||
    `${e.acao} ${e.fonte} ${e.ip ?? ''} ${e.servico ?? ''} ${e.comando ?? ''} ${e.mitre.map((m) => JSON.stringify(m)).join(' ')}`.toLocaleLowerCase().includes(filtroEvento.toLocaleLowerCase()));
  return <>
    <StatusStrip icon="pi-info-circle">Linha do tempo correlaciona eventos do Radar no alvo e na janela deste laudo. Técnicas ATT&amp;CK vêm dos eventos quando disponíveis; relações sugeridas pelo arquivo são hipóteses, não confirmação de execução.</StatusStrip>
    {d.erros.length > 0 && <StatusStrip tone="warn" icon="pi-exclamation-triangle">Coleta parcial: {d.erros.join(' · ')}</StatusStrip>}
    <DetailSection title={`Caminho observado (${eventosVisiveis.length} de ${p.linhaTempo.length} eventos)`}>
      {p.linhaTempoTruncada && <StatusStrip tone="warn" icon="pi-exclamation-triangle">A janela teve mais eventos; mostrando os 2.000 mais recentes para manter a tela responsiva.</StatusStrip>}
      <SearchInput value={filtroEvento} onChange={setFiltroEvento} placeholder="Filtrar por ação, IP, serviço, técnica ou comando…" />
      {p.linhaTempo.length === 0 ? <p className="iv-muted">Não há eventos correlacionados ao sensor nesta janela.</p>
        : eventosVisiveis.length === 0 ? <p className="iv-muted">Nenhum evento corresponde à busca.</p>
          : <ol style={{ listStyle: 'none', padding: 0 }}>{eventosVisiveis.map((e) => <LinhaDoTempo key={e.id} evento={e} />)}</ol>}
    </DetailSection>
    <DetailSection title={`Arquivos criados ou alterados (${d.arquivos.length})`}>
      {d.arquivos.length === 0 ? <p className="iv-muted">Nenhum arquivo novo ou alterado foi registrado.</p> : d.arquivos.map((a) => <article key={a.caminho} className="laudo-arquivo">
        <div className="iv-row iv-wrap"><code>{a.caminho}</code><Pill label={a.tipo.toUpperCase()} /> <span>{bytes(a.tamanho)}</span></div>
        <p className="iv-muted">{explicacaoArquivo(a.caminho, a.tipo)}{a.modificadoEm ? ` Modificado em ${dataHora(a.modificadoEm)}.` : ''}</p>
        {a.sha256 && <p>SHA-256 <code>{a.sha256}</code> · <a href={`https://www.virustotal.com/gui/file/${a.sha256}`} target="_blank" rel="noreferrer noopener">Consultar no VirusTotal</a></p>}
      </article>)}
      <p className="iv-muted">O app guarda metadados e hashes. Amostras inertes ficam na VM do Wazuh e não são baixadas nem executadas pelo app.</p>
    </DetailSection>
    <DetailSection title={`Persistência encontrada (${d.persistencia.length})`}>
      {d.persistencia.length === 0 ? <p className="iv-muted">Nenhum mecanismo de persistência foi registrado.</p> : d.persistencia.map((x, i) => <article className="laudo-arquivo" key={`${x.onde}-${i}`}><Pill label={x.tipo} /><code>{x.onde}</code><p className="iv-muted">Possível mecanismo de inicialização automática; validar conteúdo, contexto e horário.</p><pre className="laudo-pre">{x.conteudo}</pre></article>)}
    </DetailSection>
    <DetailSection title={`Processos observados (${d.processos.length})`}>
      {d.processos.length === 0 ? <p className="iv-muted">Nenhum processo iniciado durante a janela permaneceu na coleta.</p> : d.processos.map((x) => <article className="laudo-arquivo" key={`${x.pid}-${x.comando}`}><strong>PID {x.pid}</strong> · {x.usuario ?? 'usuário não informado'}<pre className="laudo-pre">{x.comando}</pre></article>)}
    </DetailSection>
    <DetailSection title={`Conexões e saídas bloqueadas (${d.conexoes.length + d.saidas.length})`}>
      {d.conexoes.map((x, i) => <p key={`c${i}`}><code>{x.remoto}</code> · {x.estado ?? 'estado desconhecido'} · {x.processo ?? 'processo não informado'}</p>)}
      {d.saidas.map((x, i) => <p key={`s${i}`}><code>{x.destino}:{x.porta ?? '—'}/{x.protocolo ?? '—'}</code> · {x.tentativas} bloqueios · {dataHora(x.primeira)}–{dataHora(x.ultima)}</p>)}
      {d.conexoes.length + d.saidas.length === 0 && <p className="iv-muted">Nenhuma conexão registrada.</p>}
    </DetailSection>
    <DetailSection title={`Invasores correlacionados (${p.invasores.length})`}>
      {p.invasores.length === 0 ? <p className="iv-muted">Sem IP correlacionado aos eventos desta janela.</p> : p.invasores.map((x) => <p key={x.ip}><code>{x.ip}</code> {x.pais ? `· ${x.pais}` : ''} · {x.logins} acessos aceitos · {x.falhas} falhas · {x.reconhecimentos} reconhecimentos · {x.comandos} comandos · {x.arquivos} transferências · {dataHora(x.primeira)}–{dataHora(x.ultima)}</p>)}
    </DetailSection>
    {d.observacoes.length > 0 && <DetailSection title="Observações do coletor"><ul>{d.observacoes.map((x, i) => <li key={i}>{x}</li>)}</ul></DetailSection>}
  </>;
}

export function Investigacoes() {
  const q = useQuery({ queryKey: ['pericias'], queryFn: listarPericias, refetchInterval: 60_000 });
  const [buscaRaw, setBuscaRaw] = useState(''); const busca = useDebounce(buscaRaw, 300);
  const [sistema, setSistema] = useState('todos');
  const [periodo, setPeriodo] = useState('90');
  const [evidencia, setEvidencia] = useState('todas');
  const lista = useMemo(() => (q.data ?? []).filter((p) => (sistema === 'todos' || p.sistema === sistema)
    && (periodo === 'todos' || new Date(p.janelaFim).getTime() >= Date.now() - Number(periodo) * 86_400_000)
    && (evidencia === 'todas' || (evidencia === 'arquivos' && p.resumo.arquivos > 0)
      || (evidencia === 'executaveis' && p.resumo.executaveis > 0)
      || (evidencia === 'persistencia' && p.resumo.persistencia > 0)
      || (evidencia === 'rede' && (p.resumo.conexoes > 0 || p.resumo.saidasBloqueadas > 0)))
    && (!busca || `${p.alvo} ${p.sensor ?? ''} ${p.sistema}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase()))), [q.data, sistema, periodo, evidencia, busca]);
  const sel = useDrawerSelection(lista);
  const open = sel.open;
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('laudo');
    if (id && lista.some((p) => p.id === id)) open(id);
  }, [lista, open]);
  return <div>
    <PageHeader title="Investigações de ataques" subtitle="Dossiês por janela: eventos do Radar, arquivos, persistência, processos, conexões e técnicas observadas." />
    <StatusStrip icon="pi-info-circle">A Matriz ATT&amp;CK usa as técnicas registradas nos eventos do Radar. Os laudos ampliam o contexto com evidências do alvo; a correlação temporal não prova, sozinha, que um IP específico criou cada artefato.</StatusStrip>
    <div className="iv-card iv-mt"><div className="iv-toolbar"><SearchInput value={buscaRaw} onChange={setBuscaRaw} placeholder="Buscar alvo ou sensor…" />
      <select aria-label="Filtrar sistema" value={sistema} onChange={(e) => setSistema(e.target.value)}><option value="todos">Todos os sistemas</option><option value="linux">Linux</option><option value="windows">Windows</option></select>
      <select aria-label="Filtrar período" value={periodo} onChange={(e) => setPeriodo(e.target.value)}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="todos">Todo o período carregado</option></select>
      <select aria-label="Filtrar evidência" value={evidencia} onChange={(e) => setEvidencia(e.target.value)}><option value="todas">Todas as evidências</option><option value="arquivos">Com arquivos</option><option value="executaveis">Com executáveis</option><option value="persistencia">Com persistência</option><option value="rede">Com atividade de rede</option></select>
      <span className="iv-toolbar__count">{lista.length} investigações</span></div>
      {q.isError && <Message severity="warn" text="API indisponível; não foi possível listar os dossiês." />}
      {q.isLoading && <p className="iv-muted">Carregando investigações…</p>}
      {q.isSuccess && lista.length === 0 && <p className="iv-muted">Nenhum dossiê corresponde aos filtros.</p>}
      <div className="grid-cards">{lista.map((p: PericiaItem) => <ClickCard key={p.id} selected={sel.isOpen(p.id)} onOpen={() => sel.open(p.id)} label={`Abrir investigação ${p.alvo}`}>
        <div className="iv-row" style={{ justifyContent: 'space-between' }}><strong>{p.alvo}</strong><Pill label={p.sistema === 'linux' ? 'Linux' : 'Windows'} /></div>
        <p className="iv-muted">{dataHora(p.janelaInicio)} → {dataHora(p.janelaFim)}</p>
        <div className="laudo-numeros"><span><strong>{p.resumo.arquivos}</strong> arquivos</span><span><strong>{p.resumo.executaveis}</strong> executáveis</span><span><strong>{p.resumo.persistencia}</strong> persistências</span><span><strong>{p.resumo.saidasBloqueadas}</strong> bloqueios</span></div>
      </ClickCard>)}</div>
    </div>
    {sel.item && <DetailDrawer {...sel.nav} wide kind={{ icon: 'pi-search', label: 'Dossiê de ataque' }} title={sel.item.alvo}
      subtitle={`${sel.item.sistema === 'linux' ? 'Linux' : 'Windows'} · janela ${dataHora(sel.item.janelaInicio)} → ${dataHora(sel.item.janelaFim)}`} ariaLabel={`Investigação de ${sel.item.alvo}`}>
      <Dossie id={sel.item.id} />
    </DetailDrawer>}
  </div>;
}
