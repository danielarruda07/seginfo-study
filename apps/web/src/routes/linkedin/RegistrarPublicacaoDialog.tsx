import { useState, type FormEvent } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import type { RascunhoLinkedin } from '@seginfo/shared';
import { FormField } from '@/components/ui/FormField';
import { isUrlLinkedin, mensagemErro } from '@/services/linkedin';
import { registrarPublicacao } from '@/services/linkedinPipeline';
import { todayISO } from '@/services/store';

/**
 * "Publiquei à mão": guarda o link e a data. O servidor cria o registro em Publicados com o texto
 * do rascunho e fecha o rascunho, então dá para saber qual rascunho virou qual post.
 */
export function RegistrarPublicacaoDialog({ rascunho, onClose, onRegistrado }: {
  rascunho: RascunhoLinkedin;
  onClose: () => void;
  onRegistrado: () => void;
}) {
  const [url, setUrl] = useState('');
  const [data, setData] = useState(todayISO);
  const [erroUrl, setErroUrl] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(ev?: FormEvent) {
    ev?.preventDefault();
    if (!isUrlLinkedin(url)) return setErroUrl('Cole o link do post (começa com https://www.linkedin.com/...).');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro('Informe a data da publicação.');
    setErroUrl(''); setErro(''); setSalvando(true);
    try {
      await registrarPublicacao(rascunho.id, { url: url.trim(), publicadoEm: data });
      onRegistrado();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog header="Registrar publicação" visible onHide={onClose} className="ca-dialog" style={{ width: 'min(560px, 96vw)' }}
      footer={(
        <div className="iv-form__footer">
          <small>* obrigatório</small>
          <Button label="Cancelar" text onClick={onClose} />
          <Button label="Registrar" icon="pi pi-send" loading={salvando} onClick={() => salvar()} />
        </div>
      )}>
      <form className="iv-form" onSubmit={salvar}>
        <p className="iv-muted ca-small ca-mb0">Rascunho: <strong>{rascunho.titulo}</strong>. O texto dele vai para Publicados, pronto para a IA organizar e para você anotar as métricas depois.</p>
        <div className="iv-form__grid">
          <FormField id="reg-url" label="Link do post" required full error={erroUrl} hint='No LinkedIn: menu ⋯ do post → "Copiar link da publicação".'>
            <InputText id="reg-url" value={url} onChange={(e) => { setUrl(e.target.value); setErroUrl(''); }} placeholder="https://www.linkedin.com/posts/..." autoFocus />
          </FormField>
          <FormField id="reg-data" label="Publicado em" required>
            <InputText id="reg-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </FormField>
        </div>
        {erro && <small className="iv-field__error" role="alert">{erro}</small>}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
