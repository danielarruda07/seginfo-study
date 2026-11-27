import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { Kpi, Pill, StatusStrip, EmptyState } from '@/components/InfraKit';
import { ExportarRelatorio } from '@/components/ExportarRelatorio';
import { baixarArquivo } from '@/services/scanner';
import {
  apagarVarredura, getVarredura, listarVarreduras, pedirVarredura, relatorioDaRevisao, totalAchados,
  ESFORCO_ROTULO, MODO_ROTULO, STATUS_ROTULO,
  type EsforcoVarredura, type ModoVarredura, type SevCodigo, type StatusVarredura, type VarreduraResumo,
} from '@/services/revisaoCodigo';

const TOM_SEV: Record<SevCodigo, 'danger' | 'serious' | 'warning' | 'info' | 'muted'> = {
  critica: 'danger', alta: 'serious', media: 'warning', baixa: 'info', info: 'muted',
};
const ROT_SEV: Record<SevCodigo, string> = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa', info: 'Info' };
const TOM_STATUS: Record<StatusVarredura, 'info' | 'warning' | 'ok' | 'danger'> = { fila: 'info', executando: 'warning', concluido: 'ok', erro: 'danger' };

const erroDe = (e: unknown, padrao: string) => (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;
const quando = (s: string | null) => (s ? new Date(s).toLocaleString('pt-BR') : '—');
const nomeArq = (s: string) => s.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_').slice(0, 60);

function Ficha({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['revisao-codigo', id], queryFn: () => getVarredura(id) });
  const v = q.data;
  return (
    <DetailDrawer wide onClose={onClose} kind={{ icon: 'pi-code', label: 'Revisão de código' }}
      status={v && <Pill tone={TOM_STATUS[v.status]} label={STATUS_ROTULO[v.status]} />}
      title={v?.repoUrl ?? 'Carregando…'}
      subtitle={v ? `${MODO_ROTULO[v.modo]} · esforço ${ESFORCO_ROTULO[v.esforco].toLowerCase()} · ${v.branch ?? 'branch padrão'}${v.commit ? ` · ${v.commit.slice(0, 10)}` : ''}` : undefined}
      actions={v?.status === 'concluido' && <ExportarRelatorio montar={() => relatorioDaRevisao(v)} nome={`revisao_${nomeArq(v.repoUrl)}`} />}
      ariaLabel="Ficha da revisão de código">
      {q.isError && <StatusStrip tone="warn" icon="pi-exclamation-triangle">Não foi possível carregar a revisão.</StatusStrip>}
      {v?.status === 'erro' && <StatusStrip tone="crit" icon="pi-times-circle">{v.erro ?? 'A varredura falhou.'}</StatusStrip>}
      {v && (v.status === 'fila' || v.status === 'executando') && (
        <StatusStrip tone="warn" icon="pi-spin pi-spinner">
          {v.status === 'fila' ? 'Aguardando o worker pegar o pedido.' : `Em execução desde ${quando(v.iniciadoEm)}. Pode levar de minutos a horas.`}
        </StatusStrip>
      )}
      {v?.status === 'concluido' && (
        <>
          <div className="iv-kpis">
            {(['critica', 'alta', 'media', 'baixa'] as const).map((s) => (
              <Kpi key={s} label={ROT_SEV[s]} icon="pi-flag" tone={(v.resumo[s] ?? 0) > 0 && s !== 'baixa' ? (s === 'media' ? 'warning' : 'danger') : undefined} value={v.resumo[s] ?? 0} />
            ))}
          </div>
          <h3 className="iv-section-label iv-mt">Achados ({v.achados.length})</h3>
          {v.achados.length === 0 ? <p className="iv-muted">Nenhum achado reportado.</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {v.achados.map((a) => (
                <li key={`${a.id}-${a.arquivo}-${a.linha}`} className="iv-card" style={{ marginBottom: '0.5rem' }}>
                  <div className="iv-row iv-wrap" style={{ gap: '0.4rem', alignItems: 'center' }}>
                    <Pill tone={TOM_SEV[a.severidade]} label={ROT_SEV[a.severidade]} />
                    <strong>{a.id} — {a.titulo}</strong>
                    {a.cwe.map((c) => <Pill key={c} tone="muted" label={c} />)}
                  </div>
                  {a.arquivo && <div className="iv-muted" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{a.arquivo}{a.linha ? `:${a.linha}` : ''}</div>}
                  {a.mensagem && <p style={{ margin: '0.3rem 0' }}>{a.mensagem}</p>}
                  {a.recomendacao && <p className="iv-muted" style={{ margin: 0 }}><strong>Recomendação:</strong> {a.recomendacao}</p>}
                </li>
              ))}
            </ul>
          )}
          {v.patches.length > 0 && (
            <>
              <h3 className="iv-section-label iv-mt">Patches sugeridos ({v.patches.length})</h3>
              <p className="iv-muted" style={{ marginTop: 0 }}>Nada é aplicado automaticamente. Revise e aplique um por PR: <code>git apply arquivo.patch</code></p>
              <div className="iv-row iv-wrap" style={{ gap: '0.3rem' }}>
                {v.patches.map((p) => (
                  <Button key={p.nome} label={p.nome} icon="pi pi-download" size="small" outlined
                    onClick={() => baixarArquivo(p.nome, p.conteudo, 'text/x-diff')} />
                ))}
              </div>
            </>
          )}
          {v.relatorioMd && (
            <div className="iv-mt">
              <Button label="Baixar relatório original (Markdown)" icon="pi pi-file" text size="small"
                onClick={() => baixarArquivo(`revisao_${nomeArq(v.repoUrl)}.md`, v.relatorioMd ?? '', 'text/markdown')} />
            </div>
          )}
        </>
      )}
    </DetailDrawer>
  );
}

export function RevisaoCodigo() {
  const qc = useQueryClient();
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [modo, setModo] = useState<ModoVarredura>('codebase');
  const [esforco, setEsforco] = useState<EsforcoVarredura>('medium');
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const lista = useQuery({
    queryKey: ['revisoes-codigo'],
    queryFn: listarVarreduras,
    retry: false,
    // atualiza sozinho enquanto houver pedido na fila ou em execução
    refetchInterval: (q) => ((q.state.data ?? []).some((v: VarreduraResumo) => v.status === 'fila' || v.status === 'executando') ? 15_000 : false),
  });

  const pedir = useMutation({
    mutationFn: () => pedirVarredura({ repoUrl: repoUrl.trim(), branch: branch.trim() || undefined, modo, esforco }),
    onSuccess: (r) => { setErro(null); setRepoUrl(''); setBranch(''); void qc.invalidateQueries({ queryKey: ['revisoes-codigo'] }); setAberta(r.id); },
    onError: (e) => setErro(erroDe(e, 'Não foi possível criar o pedido.')),
  });

  const apagar = useMutation({
    mutationFn: apagarVarredura,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['revisoes-codigo'] }),
    onError: (e) => setErro(erroDe(e, 'Não foi possível apagar.')),
  });

  const itens = lista.data ?? [];

  return (
    <div>
      <PageHeader title="Revisão de código (IA)"
        subtitle="Varredura profunda de segurança de um repositório com o plugin oficial claude-security: lê o código e raciocina sobre autenticação, autorização, injeção e lógica — não só padrões. Roda num worker isolado, fora do app." />

      <StatusStrip tone="crit" icon="pi-shield">
        <strong>Uso autorizado apenas.</strong> Só repositórios seus ou de cliente dentro do escopo contratado. O código é lido num sandbox
        (sem rede além do modelo) e o clone é apagado ao fim. Cada varredura consome tokens da API — a profunda pode custar bem mais.
      </StatusStrip>

      <div className="iv-card iv-mt">
        <div className="iv-row iv-wrap" style={{ gap: '0.6rem', alignItems: 'center' }}>
          <span className="p-input-icon-left" style={{ flex: '2 1 320px' }}>
            <i className="pi pi-github" />
            <InputText value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/dono/repo  ou  git@github.com:dono/repo.git"
              style={{ width: '100%' }} aria-label="URL do repositório" />
          </span>
          <InputText value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="branch (opcional)" style={{ flex: '1 1 160px' }} aria-label="Branch" />
        </div>
        <div className="iv-row iv-wrap iv-mt" style={{ gap: '0.6rem', alignItems: 'center' }}>
          <Dropdown value={modo} onChange={(e) => setModo(e.value as ModoVarredura)} aria-label="Modo da varredura"
            options={(Object.keys(MODO_ROTULO) as ModoVarredura[]).map((m) => ({ label: MODO_ROTULO[m], value: m }))} />
          <Dropdown value={esforco} onChange={(e) => setEsforco(e.value as EsforcoVarredura)} aria-label="Esforço"
            options={(Object.keys(ESFORCO_ROTULO) as EsforcoVarredura[]).map((x) => ({ label: `Esforço ${ESFORCO_ROTULO[x].toLowerCase()}`, value: x }))}
            disabled={modo === 'attack-surface'} />
          <Button label={pedir.isPending ? 'Enviando…' : 'Pedir varredura'} icon="pi pi-send" onClick={() => pedir.mutate()}
            disabled={pedir.isPending || !repoUrl.trim() || (modo === 'changes' && !branch.trim())} />
        </div>
        {modo === 'changes' && <p className="iv-muted" style={{ marginBottom: 0 }}>Compara a branch informada com a base e analisa só o que mudou — bom para revisar um PR.</p>}
        {modo === 'attack-surface' && <p className="iv-muted" style={{ marginBottom: 0 }}>Auditoria em três estágios do plugin, a mais profunda e a mais cara. Pode levar de 1 a 2,5 horas.</p>}
        {erro && <StatusStrip tone="warn" icon="pi-exclamation-triangle">{erro}</StatusStrip>}
      </div>

      <div className="iv-card iv-mt">
        <h2 className="iv-section-label">Varreduras</h2>
        {lista.isError && <StatusStrip tone="warn" icon="pi-exclamation-triangle">Não foi possível carregar a lista (a API está no ar?).</StatusStrip>}
        {itens.length === 0 && !lista.isLoading ? (
          <EmptyState icon="pi-code" title="Nenhuma varredura ainda" text="Peça a primeira acima. O worker pega o pedido em até 30 segundos." />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {itens.map((v) => (
              <li key={v.id} className="iv-row iv-wrap" style={{ gap: '0.5rem', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid var(--surface-border, #ddd)' }}>
                <Pill tone={TOM_STATUS[v.status]} label={STATUS_ROTULO[v.status]} />
                <button type="button" onClick={() => setAberta(v.id)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}>
                  {v.repoUrl}{v.branch ? ` @ ${v.branch}` : ''}
                </button>
                <span className="iv-muted">{MODO_ROTULO[v.modo]} · {quando(v.criadoEm)}</span>
                {v.status === 'concluido' && (
                  <>
                    {(v.resumo.critica ?? 0) > 0 && <Pill tone="danger" label={`${v.resumo.critica} crítica(s)`} />}
                    {(v.resumo.alta ?? 0) > 0 && <Pill tone="serious" label={`${v.resumo.alta} alta(s)`} />}
                    <span className="iv-muted">{totalAchados(v.resumo)} achado(s)</span>
                  </>
                )}
                {v.status !== 'executando' && (
                  <Button icon="pi pi-trash" text rounded aria-label="Apagar varredura" style={{ marginLeft: 'auto' }}
                    onClick={() => apagar.mutate(v.id)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {aberta && <Ficha id={aberta} onClose={() => setAberta(null)} />}
    </div>
  );
}
