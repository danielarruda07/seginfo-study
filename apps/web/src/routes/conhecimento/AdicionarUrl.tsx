import { useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { Pill } from '@/components/InfraKit';
import { salvarUrl, buscarUrl } from '@/services/biblioteca';
import { processar, metadadosDaUrl } from '@/services/textProcess';

const URL_INVALIDA = 'Informe uma URL válida (com http:// ou https://).';
function validarUrl(u: string): boolean {
  try { new URL(u); return true; } catch { return false; }
}

/** Caixa "cole uma URL": busca a página pela API (ou aceita o texto colado), mostra a prévia e salva. */
export function AdicionarUrl({ onSaved }: { onSaved: (titulo: string) => void }) {
  const [url, setUrl] = useState('');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof processar> | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);

  async function buscarAutomatico() {
    setErro(''); setAviso('');
    if (!validarUrl(url)) return setErro(URL_INVALIDA);
    setBuscando(true);
    try {
      const r = await buscarUrl(url);
      const corpo = [r.descricao, r.texto].filter(Boolean).join('\n\n');
      setTexto(corpo);
      if (r.titulo) setTitulo(r.titulo);
      setPreview(processar(corpo));
      setAberto(true);
    } catch {
      setAviso('Não consegui buscar a página automaticamente (API offline ou o site bloqueou). Cole o texto manualmente abaixo.');
      setAberto(true);
    } finally {
      setBuscando(false);
    }
  }

  function salvar() {
    setErro('');
    if (!validarUrl(url)) return setErro(URL_INVALIDA);
    const item = salvarUrl({ url, titulo: titulo || undefined, texto });
    setUrl(''); setTitulo(''); setTexto(''); setPreview(null); setAberto(false); setAviso('');
    onSaved(item.titulo || item.url);
  }

  const meta = url && validarUrl(url) ? metadadosDaUrl(url) : null;

  return (
    <div className="iv-card co-add">
      <form className="co-add__linha" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <span className="p-input-icon-left co-grow">
          <i className="pi pi-link" aria-hidden="true" />
          <InputText value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole a URL aqui (ex.: https://exemplo.example/artigo)"
            aria-label="URL para salvar" className="co-w100" onFocus={() => setAberto(true)} />
        </span>
        <Button type="button" label="Buscar" icon={buscando ? 'pi pi-spinner pi-spin' : 'pi pi-download'} outlined onClick={buscarAutomatico}
          disabled={!url || buscando} tooltip="Busca a página e preenche título e texto (precisa da API)" />
        <Button type="submit" label="Salvar" icon="pi pi-plus" disabled={!url} />
      </form>

      {erro && <Message severity="error" text={erro} className="co-w100 iv-mt" />}
      {aviso && <Message severity="warn" text={aviso} className="co-w100 iv-mt" />}

      {aberto && (
        <div className="iv-col co-gap-sm iv-mt">
          {meta && <p className="co-nota">Domínio: <strong>{meta.dominio}</strong> · título provável: {meta.tituloProvavel || '—'}</p>}
          <label className="co-label" htmlFor="co-add-titulo">Título (opcional; a busca automática preenche)</label>
          <InputText id="co-add-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do artigo ou post" />
          <label className="co-label" htmlFor="co-add-texto">Texto da página (opcional, recomendado): é dele que saem o resumo, o assunto e as tags</label>
          <InputTextarea id="co-add-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} placeholder="Cole aqui o conteúdo do artigo ou o trecho interessante…" />
          <div className="iv-row">
            <Button type="button" label="Ver prévia" icon="pi pi-eye" outlined size="small" onClick={() => setPreview(processar(texto))} disabled={!texto.trim()} />
            <Button type="button" label="Fechar" text size="small" onClick={() => setAberto(false)} />
          </div>

          {preview && (
            <div className="iv-preview">
              <div className="iv-row iv-wrap"><Pill label={preview.categoriaLabel} /></div>
              <h4 className="iv-section-label iv-mt">Resumo automático</h4>
              <p className="co-paragrafo">{preview.resumo}</p>
              <h4 className="iv-section-label iv-mt">Tags sugeridas</h4>
              <div className="iv-row iv-wrap">{preview.tagsSugeridas.map((t) => <Pill key={t} label={`#${t}`} tone="muted" />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
