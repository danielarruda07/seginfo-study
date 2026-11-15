import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { confirmDialog } from 'primereact/confirmdialog';
import { MIDIA_ACEITA, type RascunhoLinkedin } from '@seginfo/shared';
import { mensagemErro } from '@/services/linkedin';
import { enviarMidia, removerMidia, tituloDaMidia, urlDaMidia } from '@/services/linkedinPipeline';

const ACEITA = Object.keys(MIDIA_ACEITA).join(',');
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

/** Validação no navegador (o servidor confere de novo pelo conteúdo do arquivo). */
export function problemaDoArquivo(f: Pick<File, 'type' | 'size'>): string | null {
  const regra = MIDIA_ACEITA[f.type];
  if (!regra) return 'Use PNG, JPG ou GIF (imagem) ou PDF (carrossel).';
  if (f.size > regra.max) return `Arquivo grande demais: o limite é ${mb(regra.max)}.`;
  return null;
}

/**
 * Arquivo que vai junto no post publicado pela API: uma imagem ou o PDF do carrossel
 * (o LinkedIn mostra o PDF como documento que se folheia). Anexar ou trocar ajusta o formato
 * do post e, se ele estava aprovado, devolve para "rascunho".
 */
export function MidiaRascunho({ rascunho: r, onAtualizado }: {
  /** null: rascunho ainda não salvo */
  rascunho: RascunhoLinkedin | null;
  onAtualizado: (r: RascunhoLinkedin) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState('');
  const [erro, setErro] = useState('');
  const [titulo, setTitulo] = useState(r?.midia?.titulo ?? '');
  useEffect(() => { setTitulo(r?.midia?.titulo ?? ''); setErro(''); }, [r?.id, r?.midia?.sha256, r?.midia?.titulo]);

  if (!r) return <p className="iv-muted ca-small ca-mb0"><i className="pi pi-info-circle" aria-hidden="true" /> Salve o rascunho para anexar a imagem ou o PDF.</p>;
  const fechado = r.status === 'publicado' || r.status === 'publicando';
  const m = r.midia;

  async function executar(rotulo: string, acao: () => Promise<RascunhoLinkedin>) {
    setOcupado(rotulo); setErro('');
    try { onAtualizado(await acao()); } catch (e) { setErro(mensagemErro(e)); } finally { setOcupado(''); }
  }

  function escolher(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const problema = problemaDoArquivo(f);
    if (problema) return setErro(problema);
    void executar('Enviando…', () => enviarMidia(r!.id, f, MIDIA_ACEITA[f.type]?.tipo === 'documento' ? titulo || undefined : undefined));
  }

  function remover() {
    confirmDialog({
      header: 'Tirar o arquivo', message: <span>Tirar <strong>{m?.nome}</strong> deste post?</span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Tirar', rejectLabel: 'Cancelar',
      accept: () => executar('Removendo…', () => removerMidia(r!.id)),
    });
  }

  return (
    <div className="iv-col iv-gap" aria-label="Arquivo do post">
      <strong>Arquivo para publicar pela API</strong>
      {m ? (
        <div className="li-midia">
          {m.tipo === 'imagem'
            ? <img className="li-midia__previa" src={urlDaMidia(r.id, m.sha256)} alt={r.textoAlternativo || `Imagem anexada: ${m.nome}`} />
            : <a className="li-midia__pdf" href={urlDaMidia(r.id, m.sha256)} target="_blank" rel="noreferrer"><i className="pi pi-file-pdf" aria-hidden="true" /> Abrir PDF</a>}
          <div className="iv-col">
            <span className="mono ca-small">{m.nome}</span>
            <span className="iv-muted ca-small">{m.tipo === 'imagem' ? 'Imagem' : 'Documento (carrossel)'} · {mb(m.tamanho)}</span>
          </div>
        </div>
      ) : <p className="iv-muted ca-small ca-mb0">Nenhum arquivo. Sem ele, este post só sai pelo lembrete (você sobe a mídia à mão).</p>}

      {m?.tipo === 'documento' && (
        <div className="iv-row iv-wrap">
          <InputText value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="Título do documento no LinkedIn"
            aria-label="Título do documento no LinkedIn" disabled={fechado || !!ocupado} style={{ minWidth: 260 }} />
          <Button label="Salvar título" size="small" outlined disabled={fechado || !!ocupado || titulo.trim() === m.titulo}
            onClick={() => executar('Salvando…', () => tituloDaMidia(r.id, titulo.trim()))} />
        </div>
      )}

      {!fechado && (
        <div className="iv-row iv-wrap">
          <Button label={m ? 'Trocar arquivo' : 'Anexar imagem ou PDF'} icon="pi pi-paperclip" size="small" outlined loading={ocupado === 'Enviando…'}
            disabled={!!ocupado} onClick={() => entrada.current?.click()} />
          {m && <Button label="Tirar arquivo" icon="pi pi-times" size="small" text severity="danger" disabled={!!ocupado} onClick={remover} />}
          <input ref={entrada} type="file" accept={ACEITA} hidden onChange={escolher} />
          <small className="iv-muted">Imagem PNG, JPG ou GIF até 8 MB; PDF até 20 MB.</small>
        </div>
      )}
      {ocupado && <span className="iv-muted ca-small" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> {ocupado}</span>}
      {erro && <small className="iv-field__error" role="alert">{erro}</small>}
    </div>
  );
}
