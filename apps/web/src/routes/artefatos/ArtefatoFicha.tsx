import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { DetailSection, DetailFields } from '@/components/ui/Detail';
import { obterArtefato, obterOcorrencias, salvarArtefato, anexarAmostra, baixarAmostra, type ArtefatoDetalhe } from '@/services/artefatos';

const erroTexto = (e: unknown) => {
  const err = e as { response?: { data?: { error?: string } }; message?: string };
  return err.response?.data?.error ?? err.message ?? 'Não foi possível concluir.';
};
function Conteudo({ a }: { a: ArtefatoDetalhe }) {
  const client = useQueryClient(); const [notas, setNotas] = useState(a.notas); const [tags, setTags] = useState(a.tags.join(', '));
  const [favorito, setFavorito] = useState(a.favorito); const [mensagem, setMensagem] = useState(''); const [erro, setErro] = useState(''); const [busy, setBusy] = useState(false);
  const [revelado, setRevelado] = useState(false);
  const [pagina, setPagina] = useState(0);
  const ocorrencias = useQuery({ queryKey: ['artefatos', a.id, 'ocorrencias', pagina], queryFn: () => obterOcorrencias(a.id, pagina) });
  const executar = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setErro(''); setMensagem('');
    try { await fn(); setMensagem(ok); await client.invalidateQueries({ queryKey: ['artefatos'] }); }
    catch (e) { setErro(erroTexto(e)); } finally { setBusy(false); }
  };
  return <>
    {erro && <Message severity="error" text={erro} />}{mensagem && <Message severity="success" text={mensagem} />}
    <DetailSection title="Resumo para estudo · leitura estática">
      <p>{a.resumo}</p><p className="iv-muted">Padrões de texto sugerem comportamentos. Confirme a função no contexto; o resumo não identifica família de malware nem comprova sucesso.</p>
      <DetailFields items={[[ 'Categoria', a.categoria ], [ 'Formato', a.formato ], [ 'SHA-256', a.sha256 ?? 'Não coletado' ], ['Ocorrências preservadas', a._count.ocorrencias]]} />
    </DetailSection>
    <DetailSection title={a.tipo === 'arquivo' ? 'Conteúdo / prévia estática' : 'Comando ou trecho preservado'}>
      {a.conteudo ? <>
        <Button label={revelado ? 'Ocultar conteúdo' : 'Revelar conteúdo capturado'} outlined onClick={() => setRevelado(!revelado)} />
        {revelado && <pre className="laudo-pre" style={{ maxHeight: '28rem', overflow: 'auto', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{a.conteudo}</pre>}
        <p className="iv-muted">Conteúdo do ataque exibido como texto. Trechos periciais podem estar truncados; a prévia de arquivos limita texto a 64 KB ou extrai strings de até 1 MB.</p>
      </> : <p className="iv-muted">Somente metadados recebidos. Anexe a amostra de mesmo SHA-256 ou envie-a pelo coletor atualizado.</p>}
      {a.tipo === 'arquivo' && a.sha256 && <div className="iv-col">
        <p><a href={`https://www.virustotal.com/gui/file/${a.sha256}`} target="_blank" rel="noreferrer noopener">Consultar hash no VirusTotal</a></p>
        <label className="iv-section-label">Anexar amostra de mesmo hash (até 8 MB)
          <input type="file" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void executar(() => anexarAmostra(a.id, file, a.sha256!), 'Amostra conferida e armazenada.'); }} />
        </label>
        {a.temAmostra && <Button label="Baixar amostra .bin" icon="pi pi-download" outlined disabled={busy} onClick={() => void executar(() => baixarAmostra(a.id, a.sha256!), 'Download preparado.')} />}
      </div>}
    </DetailSection>
    <DetailSection title="Minhas anotações">
      <label><input type="checkbox" checked={favorito} onChange={(e) => setFavorito(e.target.checked)} /> Favorito para estudo</label>
      <p><label>Tags (separadas por vírgula)<input className="p-inputtext" style={{ width: '100%' }} value={tags} onChange={(e) => setTags(e.target.value)} /></label></p>
      <label>Análise e hipóteses<textarea className="p-inputtextarea p-inputtext" rows={7} style={{ width: '100%' }} maxLength={20000} value={notas} onChange={(e) => setNotas(e.target.value)} /></label>
      <Button label="Salvar anotações" disabled={busy} onClick={() => void executar(() => salvarArtefato(a.id, { notas, tags: tags.split(',').map((x) => x.trim()).filter(Boolean), favorito }), 'Anotações salvas.')} />
    </DetailSection>
    <DetailSection title={`Onde apareceu (${a._count.ocorrencias} ocorrências)`}>
      {ocorrencias.isLoading && <p>Carregando ocorrências…</p>}
      {ocorrencias.isError && <Message severity="error" text="Não foi possível carregar as ocorrências." />}
      {(ocorrencias.data ?? []).map((o) => <article className="iv-card" style={{ padding: '.75rem', marginBlock: '.5rem' }} key={o.id}>
        <strong>{o.alvo ?? 'Alvo não informado'}</strong> · {new Date(o.quando).toLocaleString('pt-BR')} · {o.origem}
        {o.caminho && <p><code>{o.caminho}</code></p>}{o.ip && <p>Origem: <code>{o.ip}</code></p>}{o.sessao && <p>Sessão: <code>{o.sessao}</code></p>}
        {o.origem === 'laudo' && <a href={`/investigacoes?laudo=${encodeURIComponent(o.referencia)}`}>Abrir investigação relacionada</a>}
        <details><summary>Contexto preservado</summary><pre className="laudo-pre">{JSON.stringify(o.contexto, null, 2)}</pre></details>
      </article>)}
      {a._count.ocorrencias > 25 && <div className="iv-row">
        <Button label="Anteriores" text disabled={pagina === 0} onClick={() => setPagina(pagina - 1)} />
        <span>Página {pagina + 1} de {Math.ceil(a._count.ocorrencias / 25)}</span>
        <Button label="Próximas" text disabled={(pagina + 1) * 25 >= a._count.ocorrencias} onClick={() => setPagina(pagina + 1)} />
      </div>}
    </DetailSection>
  </>;
}
export function ArtefatoFicha({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['artefatos', id], queryFn: () => obterArtefato(id) });
  if (q.isLoading) return <p>Carregando conteúdo e ocorrências…</p>;
  if (!q.data || q.isError) return <Message severity="error" text="Não foi possível carregar o artefato." />;
  return <Conteudo key={id} a={q.data} />;
}
